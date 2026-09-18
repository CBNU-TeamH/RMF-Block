# Harness diagrams

Open any generated `.html` file directly in a desktop browser. Each artifact is
self-contained and supports theme switching, story playback, evidence links,
trace motion, and export without running the application.

## Overview

- [RMF-Block harness overview](rmf-block-harness.html) — the complete authoring,
  review, verification, and delivery lifecycle.

## Detailed subdiagrams

- [Code review sub-agent fan-out](subdiagrams/code-review-fanout.html) — free
  checks, the Simplify sub-agent, five parallel reviewer roles, confidence-80
  filtering, and PR/issue handoff.
- [Docs and harness review loop](subdiagrams/docs-review-loop.html) — the
  Improver and Revise sub-agents, deterministic documentation checks, task
  lessons, and the explicit `AGENTS.md` target guard.
- [SDD and sub-agent delegation](subdiagrams/sdd-delegation.html) — the task
  lifecycle, the Explore-style fact-finding boundary, evidence return, and the
  decisions that remain owned by the main agent.
- [Local quality and CI gates](subdiagrams/quality-ci-gates.html) — Git hooks,
  tests, production build, Docker validation, required CI jobs, and the merge
  gate. These are deterministic automation, not sub-agents.

The adjacent `.architecture.json` files are the editable Archify sources.
The `.visual-check.json` files record the latest automated browser-evidence
attempt for each artifact.
