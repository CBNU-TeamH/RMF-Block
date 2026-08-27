# ADR-003: Yorkie, Next.js App Router, and the small choices around them

- **Status**: Proposed. Parts of this are **reconstructed after the fact** — see *What this ADR does not claim*.
- **Date**: 2026-08-26
- **Related**: [ADR-001](001-realtime-sync.md) (which components own what), [ADR-002](002-persistence-on-yorkie-mongo.md) (where state lives), [`docs/SRS-ko.md`](../SRS-ko.md) §2.1, [`docs/design/architecture.md`](../design/architecture.md)

## Context

ADR-001 and ADR-002 record *which component owns which concern*. Neither records *why we build with these particular tools*.

`docs/SRS-ko.md` is silent on four of the five choices below — grep it for Next.js, React, pnpm or Tailwind and nothing comes back. **Yorkie is the exception**: the SRS names it 43 times and fixes it in §2.1 as the CRDT library, from its very first commit. Decision 1 is therefore not a decision this ADR is free to make, and says so.

That gap has started to cost us. "Why Next and not React with a separate backend?" came up during the workspace-home work and had to be answered from first principles on the spot; the same question will come from a teammate or a reviewer again. A decision nobody wrote down gets re-argued every time somebody new reads the repo.

One decision per ADR is the usual shape, and this one breaks it deliberately: **these choices only make sense as a chain.** Yorkie owning realtime and persistence is what makes our server thin; a thin server is what makes a server-rendered framework a better fit than an API-tier framework; a framework that renders on the server is why there is no client-side data layer to manage. Split across three documents, each link reads as arbitrary.

## Decision

### 1. Yorkie as the CRDT engine — already settled, reasoning recorded here

**This one was decided before the ADR process existed, and the requirements document is where it landed.** `docs/SRS-ko.md` §2.1 names Yorkie outright — "본 시스템은 CRDT 라이브러리 Yorkie의 실시간 문서 동기화 기능과…" — and goes on to name it 43 times, including in the component table and the out-of-scope list. Yjs and Automerge appear nowhere in it.

Two things follow. First, what this section records is the **reasoning** the SRS captured only as an outcome; the comparison happened, but before anything in `docs/adr/` existed to hold it. Second, and more usefully: because the choice sits in a team-agreed document, **moving off Yorkie now needs an SRS revision** (`AGENTS.md` §5), not just a new ADR. That is a stronger constraint than the other four decisions carry, and worth knowing before anyone proposes a swap.

The reasoning, then. SRS §2.1 also rules out implementing CRDT/OT ourselves, which leaves the question of *whose* implementation.

**Yorkie ships a system; Yjs and Automerge ship an algorithm.** That is the whole of it. With Yorkie, one `docker compose` service is a working sync server, and `@yorkie-js/sdk` arrives with the transport, presence, document attachment lifecycle, and a revision API already in it. With Yjs or Automerge we would own — and have to design, build, and debug — the server, the transport and reconnection, the presence channel, and the persistence wiring, before writing a single line of the product.

For a four-person capstone on a fixed schedule, **the amount of infrastructure we do not write is the deciding factor**, and it is not close.

Two consequences of the choice are already visible in the repo:

- The browser talks to Yorkie **directly**, over Connect / gRPC-Web on ordinary HTTP (`WatchDocument` is a server-streaming response, not a socket). Our server is not on the realtime path at all — see [issue #36](https://github.com/CBNU-TeamH/RMF-Block/issues/36), where SOIR001's "WebSocket 기반" wording turned out not to describe what actually happens.
- Yorkie is a younger ecosystem than Yjs, and that was **weighed and accepted, not discovered afterwards**: a project this size will have to follow releases and take version bumps that a settled library would not ask for. The upside was judged larger, and it still is. What the cost looks like in practice: `package.json` pins `@yorkie-js/sdk@0.7.13` and carries **two patches**, because both Yorkie packages ship an ESM build while declaring only the UMD one — without the patched `exports` map the bundler loads two copies of every ProseMirror class. `next.config.ts` records that incident, and the patches come out as soon as upstream declares its own `exports`.

**Alternatives considered** — weighed at the time, before the SRS fixed the answer.

- **Yjs** — the most mature of the three, with the largest provider ecosystem. Rejected because every one of those providers is a separate decision we would then own: which server, which persistence adapter, how reconnection behaves, how presence is modelled.
- **Automerge** — the strongest correctness story and a genuinely nice document model. Rejected for the same reason as Yjs, more so: less turnkey server tooling at the time of choosing.
- **Writing our own** — excluded by SRS §2.1 before we started.

### 2. Next.js App Router, not a React SPA with a separate backend

**The deployment model is not the reason.** One container on one port, with guests joining by typing `IP:3000`, works exactly the same way with a React build served by a backend framework. Anyone justifying this choice by "the host runs Docker and guests just connect" is justifying something that does not discriminate between the options.

The reason is that **decision 1 left our server with very little to do.** Realtime is Yorkie's. Document persistence and history are Yorkie's. What remains on our side is authentication, a few JSON files under `.data/`, and one socket. A framework built around a substantial API tier — NestJS and its modules, providers, guards and interceptors — would be structure with nothing to put in it, which is the same mistake as an interface with one implementation.

What server components buy us concretely, measured against the same screens built client-side:

| Client-rendered would need | With server components |
| --- | --- |
| `GET /api/workspace` to fetch the document list | The page reads the store directly; no endpoint exists because nothing would call it |
| Loading and error states for that fetch | The list is in the HTML on first paint |
| A client cache once more than one screen reads it | No client-side server state to cache |
| A route guard that renders, discovers you are signed out, then redirects | The server redirects before anything renders |

For a two-screen app built by four people, deleting that layer is worth more than the flexibility of owning it.

**What it costs us, honestly:**

- WebSocket upgrades never reach a Next Route Handler, so `server/index.mts` is a custom server. That **cannot coexist with `output: "standalone"`**, so the runtime image installs the full production `node_modules` instead of a traced subset. A separate backend would not have paid this.
- The usual "SSR saves round trips" argument is weak here. A LAN round trip is about a millisecond.

**What keeps the choice cheap to reverse:** `lib/` has **zero** imports from `next` — the session registry, the member and chat stores, the presence roster, the workspace config are all plain TypeScript. Moving to another framework would rewrite the roughly eight files under `app/`, and that number does not grow as long as this rule holds. **Keep business logic out of `app/`.**

**Alternatives considered**

- **React (Vite) + NestJS** — the shape `wafflebase` uses, and a good fit for a product with a real API tier and more than one client. Rejected above.
- **React (Vite) + a thin Express/Fastify server** — lighter than Nest and closer to what we actually need, but it still puts every read behind an endpoint the browser has to call, which is the layer we are trying not to build.

### 3. pnpm over npm

Chosen on pnpm's general merits rather than for any one feature of this project:

- **A content-addressed store with hard links.** One copy of a package version on the machine, linked into each project, instead of a full copy per `node_modules`. On a laptop already hosting Docker, MongoDB and Yorkie, that is disk worth having back — and installs are faster for the same reason.
- **Strict resolution.** npm's flat `node_modules` lets a file import a package the project never declared, because a transitive dependency happened to hoist it there. pnpm's layout makes that fail, so `package.json` is the truth about what this project depends on rather than an approximation of it.

One thing turned that choice load-bearing after the fact: `package.json` carries `patchedDependencies` for both Yorkie packages (decision 1), and `pnpm patch` keeps those as checked-in, reviewable diffs instead of a `postinstall` script rewriting `node_modules` in place. That was not why pnpm was picked, but it is why leaving it now would cost something.

### 4. `node --test`, no test framework

`pnpm test` is `node --test`, tests are `*.test.mts`, and there is no Jest, Vitest, or assertion library. Node's own runner covers what we need — `describe`/`it` and `assert/strict` — and Node 24 strips the types out of a `.mts` file with no flag and no transform step.

What it buys: **no test dependency, no config file, and no second module system to reconcile** — which matters more than usual here, because this repo already runs two module loaders in one process (Next's bundler and Node's native loader, see the `globalThis` caches in `server/ws-hub.mts` and `lib/auth/session-registry.ts`).

**What it does not cover, and the trigger to revisit.** Every test we have is pure logic under `lib/` and `server/`. Nothing renders. That is a fair match for where the code is — the interesting behaviour has been in stores and registries — but it stops being one as soon as behaviour moves into components: three bugs in the workspace-home work were of the kind only a rendering test catches, and review caught all three instead. The `container smoke test` job does not help there, because it asserts on server-rendered HTML with `curl` and cannot see anything that goes wrong after hydration.

So `node --test` is the default, not the ceiling. Adding a component runner alongside it — Vitest and Testing Library are the likely shape — is tracked as [issue #39](https://github.com/CBNU-TeamH/RMF-Block/issues/39), and the block editor (FR-022) is the point where deferring it starts costing time. Note that this is an **addition, not a migration**: 88 passing tests that need no DOM have nothing to gain from being rewritten.

### 5. Tailwind CSS — arrived by scaffold, kept on purpose

Tailwind came in with `create-next-app`, so it was not chosen against anything at the start. It was weighed properly on 2026-08-26, before the workspace home was styled, against **Emotion**. This section is that comparison, because "it was already there" is a reason to keep something only until somebody asks whether it should be.

**Why Emotion came up:** wanting to work with what modern teams work with. That is a fair motive and worth writing down rather than dressing up — the useful thing is where it points.

**Where Emotion genuinely wins.** Styles that come from runtime values. This codebase already has them: `style={{ backgroundColor: member.colorTag }}` on the presence avatars, because Tailwind cannot express an arbitrary value as a class. Emotion's `css={{ background: member.colorTag }}` is the natural form of that, and the case grows if block/text colour ([issue #6](https://github.com/CBNU-TeamH/RMF-Block/issues/6)) lands. Long `className` strings are also plainly harder to read than a style object.

**Why it still loses here, and would lose starting from zero.** Emotion is a *runtime*: it evaluates styles while rendering, which server components do not support. Every component that styles anything would need `"use client"`, plus an SSR registry. `app/(workspace)/layout.tsx` and `page.tsx` are server components today and would both go client-side.

That is not a migration cost — it is a structural conflict with decision 2. **The two decisions pull the server/client boundary in opposite directions**, and the more of the app that renders on the server, the wider that gap gets rather than narrower.

Three smaller reasons point the same way: the design tokens already exist once, as `@theme` in `app/globals.css` mapped from the team's confirmed artboard (`docs/ui/dashboard/`) — Emotion would want the same palette defined again as a theme object; the host is a laptop already running Docker, MongoDB and Yorkie, so runtime style injection buys nothing; and for four people without a design-system habit, Tailwind's fixed scale is a constraint that helps.

**Worth knowing about the motive.** Runtime CSS-in-JS peaked around 2018–2021 and has been receding since, for the two reasons above — RSC incompatibility and render-time cost. The direction the ecosystem actually went is *zero-runtime*: Tailwind, CSS Modules, vanilla-extract, Panda CSS. So the instinct was sound and the target was one generation off; this project is already where it was aiming. If someone wants the CSS-in-JS authoring experience without the runtime, **vanilla-extract** and **Panda CSS** are the versions of that idea that survive server components — not something to adopt mid-project, but the right thing to reach for next time.

**If this were a client-rendered SPA, this section would say "either works, pick by taste."** It is the server-component architecture that makes it one-sided.

## Consequences

- **Our server is not on the realtime path**, and every design conversation should start there. Features that feel like they need a socket usually need a Yorkie document instead.
- **`lib/` stays framework-free.** This is the property that keeps decision 2 reversible, and it is worth defending in review.
- **We are pinned to a patched SDK.** The patches should be dropped the moment upstream declares its `exports` map; until then, an SDK upgrade is not a version bump alone.
- **A test needs no setup**, so there is no excuse for logic arriving without one.

## What this ADR does not claim

Decisions 1 and 3 record reasoning the team actually held. Both needed correcting after a first draft: decision 3 guessed the Yorkie patches were why pnpm was picked, when the choice had been made on pnpm's own merits; and decision 1 asserted the SRS "names no stack at all" and framed Yorkie as an open three-way call, when the SRS had named Yorkie 43 times since its first commit. Neither error survived review, but both were the same mistake — writing down a plausible story instead of checking the document being cited. **Decisions 2 and 4 are reconstructed**: Next and `node --test` were in the repo before anyone wrote down why, and what is above is the case for keeping them, assembled while answering the question in review. For decision 4 in particular, nobody weighed Jest or Vitest and turned them down — the repo simply started with what Node already had, and the case for it was made afterwards.

**Decision 5 is half and half.** Tailwind arrived by scaffold, but the comparison against Emotion is real and dated. It was made by one maintainer thinking it through, not by the team in a room — enough to record, not enough to call settled if someone wants to reopen it. That is a fair basis for an ADR — an ADR records why a decision stands, and these stand — but it is not the same as minutes from the meeting where they were made.

If a teammate remembers a different reason, theirs is the record and this document should be corrected rather than defended.
