# Focus following — lessons

**Created**: 2026-09-01

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

*Two entries below predate the build — they were found while planning and are recorded here
rather than lost, since both are things the next person would otherwise hit the hard way.*

- **The editor has never had a scroll container, and a long document is simply unreachable.**
  `app/(workspace)/layout.tsx:105` is `<main …overflow-hidden…>` and `editor.tsx` renders a
  plain `flex flex-col`, so anything past the first screenful is clipped with no way to reach
  it. It took planning a scroll-dependent feature to notice, because no test document had ever
  been longer than the window. **A feature that reads a value nobody has produced yet is a
  good way to find out the value does not exist** — the same shape as the chat task's
  milestone 0, where planning attachments surfaced that chat had no idea who was talking.

- **Yorkie presence values are `JSON.stringify`d per key, so `undefined` cannot clear a
  field.** `toPresence` (`node_modules/@yorkie-js/sdk/dist/yorkie-js-sdk.es.js:15989`) builds
  a `map<string, string>` with `JSON.stringify(value)` for each key and `fromPresence` reads it
  back with `JSON.parse`. `JSON.stringify(undefined)` is not a string, so an optional presence
  field set to `undefined` does not round-trip. **`null` is the only safe clear**, which is why
  `presenting` is typed `| null` rather than left merely optional. Worth checking whether
  anything else we put on presence later assumes otherwise.

## What we would do differently

- ...

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- ...
