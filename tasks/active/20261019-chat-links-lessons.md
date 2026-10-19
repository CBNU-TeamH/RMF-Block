# Chat links: document and block links that jump, URLs, and a 링크 tab — lessons

**Created**: 2026-10-19

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- `pnpm comments` measures what is committed (`git show HEAD:path`), not the working tree. It said clean before the commit and failed after. A file already over the 30% budget fails as soon as it is touched at all, so its rationale has to move to `docs/` in the same change.
- The editor's `blocks` state does not follow typing (the editor says so: order is all it is reliable for). Anything that wants a block's text now reads the live document.
- `navigator.clipboard.readText()` asks for permission. Calling it from a test script hung the tab's evaluation; check what was copied by wrapping `writeText` instead.

## What we would do differently

- Put a transient notice outside any hover-only wrapper from the start. The click that triggers it is usually the moment the pointer leaves.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- `copyText` (`ui.tsx`) is the copy to use anywhere a guest might be on plain HTTP.
