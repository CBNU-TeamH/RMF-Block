# Workspace file manager (UC-050) — lessons

**Created**: 2026-10-18

## What surprised us

- Yorkie's `GetDocuments` is a project API: called with the admin token, 0.7.23 drops the connection instead of answering 401. It wants `API-Key <project secret>`, which `GetProject` hands out after an admin login.
- It leaves out a key it holds no document for rather than failing, so the whole catalogue can be asked for at once.
- The chat panel loads its history only when its socket opens, so a test that lands on a message needs a socket that fires `open`.

## What we would do differently

- Measure the Admin API's answer on a disposable Yorkie before designing around it — the root's shape and the missing-key behaviour both decided the parser.
- Try a reused interaction where it will be used before settling on it: the floating view was free to reuse for 미리보기, and in use it got in the way of looking through a list.

## Worth extracting

- Nothing global: `flash` in `ui.tsx` is the one shared piece, and its two callers are in this task.
