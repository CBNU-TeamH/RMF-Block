# Docs: move persistence and history from Git to Yorkie + MongoDB — lessons

**Created**: 2026-08-24

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The SRS §2.1 diagram had shown `Yorkie 메인 DB: MongoDB` all along, and it was the *only* Mongo mention in 1443 lines. The prose and the diagram had been contradicting each other since the SRS was written; `AGENTS.md` §7 had logged it as an open item rather than a defect.
- One sentence in §2.3.2 ("Git은 … 영속 계층이자 버전 이력 관리 수단") was the load-bearing durability contract for nine other requirements — FR-010-05, SIR001, SOIR002, NFR-SAF-001/003, NFR-REL-002 among them. Deleting it without a replacement in the same edit would have quietly removed the basis for all of them.
- The Markdown round-trip constraint — "every block type must map round-trippably to Markdown", the largest unbuilt piece of the persistence design — was stated in exactly one place, and it existed only to let `restoreLatest` rebuild a document from a commit. Removing its one caller removed the whole constraint.
- ADR-001's own third rejected alternative ("no durable persistence, in-memory only — rejected") was already the argument for this change. Git was bolted on to satisfy it; running Yorkie on Mongo satisfies it directly. The reversal was derivable from the ADR that is being superseded.

## What we would do differently

- The Mermaid `style Repo …` rule outlived the node it styled by being 30 lines away from it. Deleting a diagram node means grepping the node id, not just deleting the definition line — Mermaid renders a phantom node instead of erroring.
- Numbered lists in the SRS (§2.1 components, §2.3.2 dependencies) make deletion a renumbering cascade. Worth knowing before the edit, not during.

## Worth extracting

- ADRs get a `Status` line pointing at their successor. Everything else in a superseded ADR stays untouched — the record is the point — but without that one mutable line, readers keep treating it as current. This is now how ADR-001 reads.
- When a decision is reversed, the new ADR should name what *survives* as explicitly as what it replaces. ADR-001 Decision 1 is untouched, and saying so is what stops a future reader assuming the whole document is dead.
