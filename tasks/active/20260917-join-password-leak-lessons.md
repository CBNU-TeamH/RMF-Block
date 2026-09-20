# Join form leaks the workspace password via a GET fallback — lessons

**Created**: 2026-09-17

## What surprised us

- The issue's own "possible directions" section slightly understated option 1's cost: `join()` reads values via `new FormData(form)`, which collects by `name`. Removing `name` without also changing how `join()` reads values would silently break the working, hydrated path too (`FormData` would collect nothing) — not just degrade password-manager autofill as the issue implied.
- This app has no Server Action usage anywhere, but the bundled Next 16.2.12 docs (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`) flag that Server Action IDs rotate on redeploy and can produce "Failed to find Server Action" for a client on a stale bundle — a real risk for this app specifically, since the host restarts the Docker container mid-session rather than deploying behind a stable rollout.
- Every other form in the app (`document-actions.tsx`, `document-list.tsx`, `documents/[id]/editor.tsx`) already avoids `name` entirely, reading from controlled state with refs used only for focus. `join-form.tsx` was the sole outlier — the fix aligns it with an existing house convention rather than introducing one.

## What we would do differently

- The task doc should have been written before starting the build (per `AGENTS.md`'s SDD ordering), not after code was already passing lint/test/build. Caught mid-task; no rework needed since the plan (already reviewed and approved via the plan-mode flow) matched what got built, but the ordering itself was skipped.

## Worth extracting

- Consider a line in `docs/conventions.md`: inputs should not carry `name` unless the component is deliberately relying on native form semantics (an actual `action`/no-JS support) — otherwise `name` is a needless liability on any form that touches a secret. This task is the second time (`join-form.tsx` here) an app-only-if-JS form used `FormData`; worth naming the convention explicitly rather than leaving it as something four components happen to agree on.
