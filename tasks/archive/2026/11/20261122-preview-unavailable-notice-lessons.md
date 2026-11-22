# Say 미리보기 불가 where a file cannot be previewed — lessons

**Created**: 2026-11-22

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The chat panel's file list and the message list both render `li` elements that name the same file, so `chat.locator("li").filter({ hasText: name })` matched two. A list row is the `li` without `data-message-id`.

## What we would do differently

- Run the new E2E assertion on the real stack before the first push; the strict-mode clash showed only there, not in the component tests.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing yet.
