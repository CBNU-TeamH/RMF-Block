# Chat links: document and block links that jump, URLs, and a 링크 tab

**Created**: 2026-10-19
**Issue**: #147
**Design**: [Chat](../../docs/design/chat.md)

## Milestones

### 1. A message can carry a link

- **What**: a chat message can carry a link to a document or one block in it (FR-060-03). Clicking it opens the document at that block and highlights it (FR-060-06, E7a). A link whose document is gone shows the name it was sent with, dimmed, and does nothing.
- **Files**: `lib/chat/types.ts`, `lib/chat/chat-service.ts`, `lib/chat/links.ts`, `app/api/chat/route.ts`, `app/(workspace)/chat-message.tsx`, `app/(workspace)/chat-panel.tsx`, `app/(workspace)/chat-window.tsx`, `app/(workspace)/layout.tsx`.
- **Reuse**:
  - the file attachment's rule that the server describes what the request only names (here the document's name, from the catalogue);
  - `goToBlock` from the file manager;
  - the layout's server-rendered `documents`, kept current by the sidebar's `router.refresh()`.
- **Done**: a link sent from one browser opens the right block in another, and a deleted document's link is dimmed.

### 2. Three ways to attach one

- **What**: the user can attach a link three ways:
  - a block's ··· menu in the editor → 채팅으로 보내기 opens the chat with that block attached;
  - the same menu → 링크 복사 copies `/documents/<id>#block=<blockId>`, and pasting such a URL into the chat input attaches it instead of typing it;
  - a 문서 링크 button in the chat input picks a document.

  The copied URL also opens the block when used outside the chat.
- **Files**: `app/(workspace)/documents/[id]/editor.tsx`, `app/(workspace)/document-row-menu.tsx` (reused as is), `app/(workspace)/ui.tsx` (`copyText`), `app/(workspace)/chat-panel.tsx`, `app/(workspace)/focus-follow-provider.tsx` (the `#block=` landing).
- **Reuse**:
  - `DocumentRowMenu` for the block menu;
  - the scroll target with `highlight` for the landing.
- **Done**: each way attaches the same link. Copying works over plain HTTP, where `navigator.clipboard` is absent.

### 3. URLs, and a 링크 tab

- **What**: an `http(s)` URL in a message's text is a link that opens in a new tab (FR-060-01). The chat file list gains a 링크 tab listing document and block links and URLs, newest first (FR-061-01).
- **Files**: `lib/chat/links.ts`, `app/(workspace)/chat-message.tsx`, `app/(workspace)/chat-files.tsx`.
- **Reuse**: the file list's tabs and rows.
- **Done**: a URL is clickable and listed, and only `http` and `https` become links.

## Test selection

- Vitest (logic / component / server / route):
- Browser E2E (`e2e/`):
- Container smoke (`.github/workflows/ci.yml`):
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] A document or block link sent in chat opens its target (and highlights a block) in another browser; a deleted document's link is dimmed and inert.
- [ ] 채팅으로 보내기, 링크 복사 + paste, and the 문서 링크 picker each attach a link; the copied URL also opens the block directly.
- [ ] URLs in messages open in a new tab, and the 링크 tab lists links and URLs.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm verify:docs`, `pnpm comments` pass.

## Cross-cutting

FR-060-01/03/06, UC-060 E7a, FR-061-01. Resolves `chat.md`'s open question on what a link attachment stores. The SRS is unchanged. Follow-up, not here: pasting a copied block link into a document could create the `block-link` block, which has no creator yet (`document-editing.md`).

## Review

Filled in at the end.
