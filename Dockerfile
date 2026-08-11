# The image the host receives and runs (SRS UC-010 사전 조건, HIR001, SOIR002).
# Three stages so the shipped layer carries no pnpm store and no dev dependencies.

FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
# `patches/` must land before install — pnpm applies the @yorkie-js patches during it.
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Next binds 0.0.0.0 so the published port is reachable from the LAN, not just
# from inside the container — that is what lets a guest type IP:port (UC-020).
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
