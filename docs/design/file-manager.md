# File manager — Module Design

- **Status**: Agreed 2026-10-18 with a maintainer (#164). Built: the page, its list API, and
  jumping to a file's block or chat message.
- **Owns**: `app/(workspace)/files/`, `app/api/files/route.ts`, `lib/files/workspace-files.ts`.
- **Related**: [`docs/SRS-ko.md`](../SRS-ko.md) UC-050, FR-050-01..06; [`chat.md`](chat.md) (the
  file store, and UC-061's chat file list this one sits beside); [`floating-view.md`](floating-view.md)
  (the preview); [`presence-and-focus.md`](presence-and-focus.md) (the scroll target a jump reuses);
  [`api.md`](api.md).

## Scope

Every file the workspace holds in one list: what a live document block embeds, and what chat
messages carry. Grouped by type, previewed, downloaded, and followed back to where it came from.

## The page

A dedicated page, `/files`, opened from **파일** at the sidebar's foot, above 관리자 and shown to
everyone. It is not a tab: the document tab bar holds document ids only, and nothing here needed
it to hold anything else. On it:

- **Type tabs** — 이미지, PDF, 기타 — each with its count (FR-050-01). The classification is the
  chat file list's (`kindOf` in `lib/chat/attachments.ts`), so a file sits under the same tab in
  both places; here the third is named 기타, since "문서" would read as the file's source.
- **A table**, newest first: name, source, size, uploaded by, date (FR-050-02).
- **Per row**: 미리보기 opens the floating view (FR-050-03) for the types the preview route serves
  inline — images and PDFs; 기타 is download-only until UC-080's viewers exist. 원본 위치 (E3-3)
  and 내려받기 (FR-050-04).

The list is fetched when the page opens. Nothing asks for it to update live.

## Chat files are listed too

UC-050 is worded for files embedded in documents; chat attachments are UC-061's, in the chat
window. Both are listed here because someone looking for a file rarely knows which of the two it
went through — the maintainer's call when this was designed. The source column tells them apart
(the document's name, or 채팅). The SRS is unchanged: this adds to UC-050 without contradicting it,
and UC-061 still stands on its own.

## Which block holds a file

The file store records the upload — and, since some point, the document — but not the block.
Rather than record it at upload, `GET /api/files` reads it from the documents on every request:

- One Yorkie Admin `GetDocuments` call returns every catalogue document's root (`include_root`).
  It is a project API, so it is authorized with the default project's secret key (from
  `GetProject`, after logging in with `YORKIE_ADMIN_PASSWORD`) — the way Yorkie's own dashboard
  does it. With the admin token instead, Yorkie 0.7.23 drops the connection. A key Yorkie holds no
  document for — a catalogue entry nobody has opened — is left out of the answer, not an error.
- The root comes back as plain JSON (a `yorkie.Text` as `[{"val":…}]`), so the file, image and PDF
  blocks and their `content.fileId` are read without the SDK (`lib/files/workspace-files.ts`).
- A document upload no live block holds is not listed. That is FR-050-06 — the block was deleted —
  and also covers a document in the trash (only the catalogue's documents are read) and an upload
  whose block was never inserted. It also places files uploaded before `documentId` was recorded.
- A file held by two blocks is listed once, at the first one found.

Recording the block at upload would have needed this read anyway: a deleted block leaves its
upload behind (there is no route that deletes a file), so "is it still there" can only be answered
by the document. The cost is three requests to Yorkie per page load, which a workspace of this
size does not notice.

**When Yorkie cannot be read**, chat files still list, the response carries
`documentsUnavailable: true`, the page says the document side is missing with a retry, and the
server logs why.

## Going back to the source (E3-3)

- **A document file** opens its document at the block and highlights it (step 4). This is the
  jump to a person (UC-040) without the person: `goToBlock` in `focus-follow-provider.tsx` sets the
  same scroll target, marked `highlight`, and the editor flashes the block when it lands
  (`flash` in `ui.tsx`). Like that jump, it asks before leaving a follow.
- **A chat file** opens the chat window at its message and highlights it. The window now wraps the
  workspace shell so anything in it can call `useOpenChatAt`; the panel scrolls once the message
  is in its history, which may arrive with the backfill.

## Not built

- Live updates, search, and sorting other than newest first.
- Previews for Word, PowerPoint and Excel (UC-080).
- A way back to the list after 원본 위치, like UC-040's return.
