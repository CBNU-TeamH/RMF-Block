# Performance criteria doc — apply review findings and move under docs/

**Created**: 2026-09-23
**Issue**: none — follows a review of `fb18cfe` (competitive network-congestion benchmark section)
**Design**: none — the doc being fixed, `docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`, is itself the design

## Milestones

### 1. Move the doc under docs/

- **What**: `PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md` moves from the repo root to `docs/`, content unchanged.
- **Files**: the doc; `AGENTS.md` (§4 routing row, §5 language line); `ROADMAP.md` Phase 5; `docs/design/architecture.md` §4.
- **Reuse**: `pnpm verify:docs` — once the file sits in `docs/`, its backtick paths get checked too.
- **Done**: `git log --stat` shows the move as a pure rename; no link to the old root path remains.

### 2. Close the NFR-PER measurement gaps

- **What**: fix the criteria that could not be executed as written.
- **Files**: the doc only.
- **Reuse**: nothing new — rewrites existing sections.
- **Done**:
  - [ ] Class B's "server clock + ack" alternative is scoped to NFR-PER-004 (chat over the App WS). NFR-PER-002/005 go straight to Yorkie (`app/(workspace)/presence-provider.tsx`), so they get a sender-clock round-trip echo instead.
  - [ ] How `t0` gets attached is split by path: chat payload, a block-edit marker string, the scroll value itself.
  - [ ] The NTP procedure orders "sync → confirm → then (re)load pages", because `timeOrigin` is fixed at load. A measured tab must be in the foreground.
  - [ ] NFR-PER-001 observes Yorkie stream disconnects (`doc.subscribe("connection")`) as well as the app WS. Only unexpected 4xx/5xx count as errors. The p95 wording goes, the 0/20 rule gets its rule-of-three reading, and the cost is stated.
  - [ ] NFR-PER-006 is judged on the Chrome Task Manager memory footprint, sampled periodically, not on a heap snapshot.

### 3. Make the competitive benchmark measurable and fair

- **What**: the Notion / Google Docs comparison gets a measurement that works on tools we cannot instrument, and emulation that doesn't penalize one side.
- **Files**: the doc only.
- **Reuse**: the Writer/Reader method from Dang & Ignat (IFIP Networking 2016).
- **Done**:
  - [ ] The primary metric is automated Writer/Reader propagation delay, with Writer and Reader on the same PC. Human total task time becomes secondary.
  - [ ] Server-side `tc netem` is excluded from the comparison. Emulation is applied at the client or a shared gateway, and the doc says it reproduces only AP-segment congestion.
  - [ ] DevTools throttling limits are stated: request-level, and its loss parameters are for WebRTC.
  - [ ] Repetition and statistics no longer contradict common principle 3.
  - [ ] Citations fixed: the 30 s grace period lives in the UC-022 note; Tsinghua supports latency only; the Etherpad study measures redundancy and error rate; the Google Docs delay paper moves off the SUS row.
  - [ ] The collision/duplication metric is redefined against the final document.
  - [ ] The preface covers both questions the doc answers.

## Acceptance

- [ ] `pnpm verify:docs` clean
- [ ] `grep -rn "PERFORMANCE-QUANTIFICATION" --exclude-dir=node_modules --exclude-dir=.git .` shows only `docs/` paths
- [ ] Each review finding (1–11) maps to a commit on this branch

## Cross-cutting

- NFR-PER-001..006 (`docs/SRS-ko.md` §3.4.1), FR-022-12 / UC-022. `docs/SRS-ko.md` itself is not edited (`AGENTS.md` §5).
- The doc stays in Korean. Its "pending translation" status in `AGENTS.md` §5 is unchanged.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
