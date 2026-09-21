# Runtime diagrams

Open `rmf-block-runtime.html` or `rmf-block-runtime-detail.html` directly in a
desktop browser. Each artifact is self-contained.

The `.architecture.json` files are the editable Archify sources (same convention as
[`docs/diagrams/harness/README.md`](../harness/README.md)).

**Known stale as of 2026-09-21**: `rmf-block-runtime.architecture.json` and
`rmf-block-runtime-detail.architecture.json` were hand-edited to add the WebSocket-upgrade
auth gate (ADR-006, #107/#110) and fix drifted `sources` line citations, but Archify wasn't
available to regenerate the matching `.html` in the same pass. The rendered HTML still reflects
the pre-2026-09-21 diagram — re-run Archify against the current `.architecture.json` before
treating the `.html` as accurate.
