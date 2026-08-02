# ADR-001: Realtime sync on Yorkie, business logic on the App/WS Server, Git off the realtime path

- **Status**: Accepted
- **Date**: 2026-08-02
- **Related**: [`docs/SRS-ko.md`](../SRS-ko.md) §2.1 (시스템 구성 요소), §2.3.2 (의존 관계); [`docs/design/architecture.md`](../design/architecture.md)

## Context

The system supports LAN-based, same-room document collaboration for up to 8 users. Two independent needs collide in the design:

1. **Live collaboration** — block edits, cursor/occupancy, presence, and focus-following must reach every connected client in well under a second (NFR-PER-002/005), with concurrent-edit conflicts resolved without a custom merge algorithm (SRS §2.1 explicitly excludes implementing CRDT/OT ourselves).
2. **Durability and history** — documents must survive a server restart (NFR-REL-002), recover from abnormal termination (NFR-SAF-003), and keep a change history. SRS §2.3.2 commits to Git as that history mechanism.

These two needs have different natural cadences: collaboration needs sub-second fan-out; history needs a commit per meaningful change, not per keystroke. Driving both off the same mechanism forces a bad trade-off — either commit on every micro-edit (Git as a realtime bus, far too slow and noisy) or lose the low latency collaboration requires.

## Decision

Split the two needs across three components with one owning each concern, and make the boundary between them explicit:

1. **Yorkie (self-hosted, CRDT) owns realtime sync.** All document content sync, concurrent-edit conflict resolution, and Presence (cursor, selection/occupancy, connected-user state) go through Yorkie's client SDK and self-hosted server. We do not implement a merge algorithm or a competing realtime channel for document content.
2. **The Application/WS Server owns business logic and relay.** Workspace lifecycle (create/join/password/kick), document tree operations (create/rename/move/delete), file upload/download, chat, and any collaboration feature Yorkie's document/presence model doesn't natively express (e.g. focus-following session state, floating-view bookkeeping) are handled here. This server also owns the Git write path.
3. **The local Git repository is a persistence and history layer, not a sync path.** It is intentionally off the realtime edit path. On a delayed-write cadence, the server materializes the current Yorkie document state to Markdown (`.md`) files on the server filesystem, then commits the changed files to a local Git repository. Git commits are the recovery baseline (last commit = restore point after a crash or restart) and the audit trail of document history — never the mechanism by which one user's edit reaches another user.

```
Client(s) ──CRDT sync / Presence──▶ Yorkie Server (self-hosted)
Client(s) ──API / WebSocket──▶ App/WS Server ──business logic, relay
App/WS Server ──delayed write──▶ server filesystem (.md) ──commit──▶ local Git repo
```

## Consequences

**Positive**

- No custom conflict-resolution or realtime-sync code to build or maintain — matches the explicit out-of-scope items in SRS §2.1.
- Git history stays meaningful (one commit per delayed-write batch) instead of being flooded by per-keystroke noise.
- The recovery story is simple: on restart, restore from the last commit, then let Yorkie's live state (if the session survived) reconcile forward.

**Trade-offs / new open questions**

- Git history granularity is coarser than actual edit history — it reflects write-debounce batches, not individual edits. Acceptable per SRS §2.3.2, but the debounce interval itself is undecided (tracked in `AGENTS.md` §7).
- The Yorkie document → Markdown materialization (and the reverse, on restore) is a real translation layer per block type; it needs its own module design when the Git Management Component is built — not specified here.
- The App/WS Server is a single point of failure for both relay and persistence (accepted under SRS §2.3.1's assumption that the host's server is up for the duration of collaboration).

## Alternatives considered

- **Implement CRDT/OT sync ourselves** — rejected; explicitly out of scope in SRS §2.1, and duplicates what Yorkie already provides.
- **Use Git as the realtime sync path** (commit-per-edit, diff/merge to reconcile) — rejected; commit-per-keystroke is both too slow for NFR-PER-002 and not a merge strategy suited to concurrent block edits.
- **No durable persistence, in-memory document state only** — rejected; violates NFR-SAF-001/003 and NFR-REL-002 (no recovery after restart or crash).
