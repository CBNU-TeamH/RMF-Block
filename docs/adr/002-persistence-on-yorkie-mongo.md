# ADR-002: Persistence and history on Yorkie + MongoDB, app state as host-held JSON

- **Status**: Accepted
- **Date**: 2026-08-24
- **Supersedes**: [ADR-001](001-realtime-sync.md), partially — see "What this replaces" below.
- **Related**: [`docs/SRS-ko.md`](../SRS-ko.md) §2.1, §2.3.2; [`docs/design/architecture.md`](../design/architecture.md); issue #18

## Context

ADR-001 split three concerns across three components: Yorkie for realtime sync, the App/WS Server for business logic, and a local Git repository for durability and history. The first two have held up. The third has not.

ADR-001's Context argued that collaboration and history have different natural cadences, and that driving both off one mechanism forces a bad trade-off. **That premise was wrong.** It was true only because Yorkie was assumed to run on its in-memory store (MemDB), which made Yorkie volatile and left Git as the only durable option. Once Yorkie runs on MongoDB, one mechanism serves both cadences: Yorkie persists continuously at sync speed, and its revision API records history points at whatever granularity we choose.

ADR-001's own third rejected alternative already contains the argument — "no durable persistence, in-memory document state only — rejected; violates NFR-SAF-001/003 and NFR-REL-002". That rejection was satisfied by bolting Git on. It is satisfied more directly by not running Yorkie on MemDB in the first place.

Two further facts settled this:

- The Yorkie revision API (`createRevision` / `listRevisions` / `getRevision` / `restoreRevision`, snapshots in YSON) exists in the pinned `@yorkie-js/sdk@0.7.13`. History does not need to be built; it needs to be persisted.
- The Git path required a round-trippable Markdown mapping for every block type — a translation layer ADR-001 deferred to "its own module design". It was the largest unbuilt piece of the persistence design, and it bought nothing the revision API does not already provide.

## Decision

1. **Yorkie owns document persistence and version history.** The Yorkie server runs with MongoDB as its backend store (`--mongo-connection-uri`), not MemDB. Document state survives restart because Yorkie persists it; version history is recorded through the revision API. There is no delayed write, no materialization to files, and no commit step.

2. **The App/WS Server owns its own state as JSON files under `.data/`.** Chat history, workspace metadata, and auth records are written as plain JSON on the host filesystem — the pattern `lib/chat/chat-repository.ts` already establishes. This state is not CRDT document content and does not belong to Yorkie.

3. **MongoDB is Yorkie's internal store and nothing else.** The App/WS Server never connects to it. Document state and revisions are reachable only through Yorkie. This boundary is stated explicitly because the alternative — the app writing its own collections into Yorkie's database — is the obvious wrong turn.

```
Client(s) ──CRDT sync / Presence──▶ Yorkie Server ──▶ MongoDB (documents + revisions)
Client(s) ──API / WebSocket──▶ App/WS Server ──▶ .data/*.json (chat, workspace, auth)
App/WS Server ──revision API──▶ Yorkie Server
```

## What this replaces

**Superseded in ADR-001:**

- Decision 3 in full — the local Git repository as persistence and history layer.
- Decision 2's final sentence, "This server also owns the Git write path."
- Context ¶2's clause committing to Git as the history mechanism, and ¶3's premise that the two cadences must be driven by separate mechanisms.
- Positive consequences 2 and 3 (meaningful Git history; restore-from-last-commit recovery).
- All three trade-off bullets. The third is narrowed rather than dropped: the App/WS Server remains a single point of failure for relay and for `.data/`, but document persistence is no longer its responsibility — that moves to the Yorkie + MongoDB pair.

**Still standing in ADR-001:**

- Decision 1 in full. Yorkie owns realtime sync, conflict resolution, and Presence; we implement no merge algorithm. Unchanged.
- Decision 2 minus its final sentence. The App/WS Server's business-logic scope is identical.
- Context ¶1 — the live-collaboration requirement.
- Positive consequence 1 — no custom conflict-resolution code.
- All three rejected alternatives, with the third re-cited above as the reason Yorkie must not run on MemDB.

## Consequences

**Positive**

- The Yorkie → Markdown → Yorkie translation layer is cancelled outright, and with it the constraint that every block type must round-trip to Markdown. Block types are now free to carry any structure Yorkie can represent.
- Recovery needs no code: Yorkie reloads its own state from MongoDB on start. `restoreLatest` has no caller.
- History granularity becomes a deliberate choice — an explicit `createRevision` call — instead of a side effect of a write-debounce window.

**Trade-offs / new open questions**

- MongoDB becomes a required service. Until `docker-compose.yml` adds it and passes `--mongo-connection-uri`, Yorkie still runs on MemDB and NFR-SAF-003 / NFR-REL-002 / SOIR002 are unsatisfiable — the Git safety net is gone before its replacement is wired. This is the immediate follow-up to this ADR.
- `.data/` needs the same durability attention: it is currently written inside the container with no volume bound to it, so app-owned state does not survive container recreation.
- **Open: when revisions are created.** Automatic (server-driven, on some cadence) or explicit (user- or event-triggered) is undecided. No FR or UC currently covers version history at all, so nothing forces the answer yet.
- **Open: whether the App/WS Server stays a Yorkie client.** Its `Watch` subscription existed to drive `scheduleWrite`. If revisions are explicit and nothing else needs it, the server stops subscribing to documents entirely — but the Admin API for active editors (`api.md` §2) and FR-040 presence may still want it. Decide alongside the question above.
- Markdown export, if ever wanted, must be re-derived as a one-way feature. It is no longer a correctness constraint, so nothing in the system depends on it being lossless.

## Alternatives considered

- **Keep Git, add MongoDB anyway** — rejected; two durable stores for the same data, with the Markdown translation layer still to build, and no remaining question that Git answers better.
- **Put app state (chat, auth) into Yorkie's MongoDB** — rejected; it makes the app a client of another service's private store, couples our schema to Yorkie's deployment, and buys nothing over JSON files at this scale (up to 8 users).
- **Model app state as Yorkie documents so it persists for free** — rejected for chat and auth in this ADR, since neither needs CRDT merge semantics. Chat specifically has a separate open proposal (`api.md` §5 version B) that is decided on its own merits, not here.
