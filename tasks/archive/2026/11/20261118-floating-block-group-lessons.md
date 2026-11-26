# Several selected blocks in one floating view — lessons

**Created**: 2026-11-18

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- A button that acts on the block selection has to survive the press: the selection ends on any mousedown and on its hidden textarea's blur, both before the click. Marking the button `data-selection-action` and preventing the mousedown default (the focus move) keeps both.

## What we would do differently

- ...

## Worth extracting

- ...
