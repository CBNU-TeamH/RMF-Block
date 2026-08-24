# The image the host receives and runs (SRS UC-010 사전 조건, HIR001, SOIR002).
# Four stages so the shipped layer carries no pnpm store and no dev dependencies,
# even though (unlike before) it needs the full production node_modules — see
# the runtime stage below for why `output: "standalone"` is no longer used.

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

# Separate from `deps`: this installs production dependencies only (no
# typescript/eslint/tailwind), so the runtime image doesn't carry them.
FROM node:24-alpine AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Next binds 0.0.0.0 so the published port is reachable from the LAN, not just
# from inside the container — that is what lets a guest type IP:port (UC-020).
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# No `output: "standalone"`: it generates its own `server.js`, which cannot
# coexist with our custom `server/index.mts` (needed for WebSocket upgrades —
# see `docs/design/chat.md`). So instead of copying a pre-traced minimal
# subset, the full production `node_modules` is installed here.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
# `server/index.mts` is run by Node directly, not bundled by Next, so every
# module it imports has to exist on disk here — including `lib/`, which it
# reaches for the session cookie parser. Listing server files one by one but not
# lib/ is how that broke once: it resolved fine under `pnpm dev` and the
# container exited on startup.
COPY --from=build /app/server/index.mts /app/server/ws-hub.mts ./server/
COPY --from=build /app/lib ./lib
COPY --from=build /app/next.config.ts /app/package.json ./
# `.data/` is the app's own state directory (ADR-002) — chat today, workspace
# metadata and auth records later. Everything else above is COPYed in as root,
# so without this the `node` user below can't create it — first chat message
# would 500.
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
EXPOSE 3000
CMD ["node", "server/index.mts"]
