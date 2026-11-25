# Document export — Module Design

- **Status**: Built. Requirements: FR-022-15, FR-022-16, FR-022-17 and UC-022 E6 in `docs/SRS-ko.md`.
- **Owns**: `lib/documents/export.ts`. A file-level claim inside a directory
  [`document-editing.md`](document-editing.md) owns, so the more specific claim wins — the shape
  [`version-history.md`](version-history.md) uses.
- **Related**: [`document-editing.md`](document-editing.md) ("Selecting and copying blocks" — the
  Markdown writer an export shares with copying); [`app-shell.md`](app-shell.md) (the document bar);
  [`file-manager.md`](file-manager.md) (reading every document's root from Yorkie in one call).

## Scope

Taking a document out of the workspace: as Markdown, a `.md` file or a zip holding its attachments and
sub-pages, or as PDF through the browser's print dialog. Importing a `.md` is the other direction and lives
in [`app-shell.md`](app-shell.md), "Importing Markdown".

## Benchmarked on Notion

Notion's ••• → Export offers a format (PDF, HTML, Markdown & CSV), **Include subpages**, **Create folders
for subpages** and **Include content** (everything, or no files and images), and Markdown always arrives
as a zip. This keeps the parts asked for and drops the rest:

- **Markdown and PDF only.** No HTML, no CSV: there are no databases to write as tables.
- **A bare `.md` when that is all there is.** A document with no files and no sub-pages downloads as the
  one file, not a zip of one file.
- **The sub-page question only when there are sub-pages**, and always as folders — no folder toggle.
- **No "exclude files".** A file block without its file is a dead link.

## Markdown: what the export holds

```
<name>.md                      ← alone when no files and no sub-pages
<name>.zip
  <name>.md
  <name>/<attachment>
  <name>/<sub-page>.md
  <name>/<sub-page>/...
```

`planExport` (`lib/documents/export.ts`) decides it, given the catalogue, each exported document's blocks
and which files still have bytes. It is pure, so the layout and the names are unit-tested without a server.

- **The text** is `documentToMarkdown` (`lib/blocks/markdown.ts`) — the writer copying uses, with blocks a
  blank line apart so a reader keeps each its own paragraph. List items stay one line apart, or a reader
  spaces the list out. The import drops blank lines, so an export reads back as the same blocks.
- **Links.** An image, PDF or file block points at its file in the zip; a document or block link to an
  exported document points at that document's `.md` (a block link loses its block: a `.md` has no address
  for one). Both are relative, with the destination in angle brackets so spaces need no escaping. A link to a document
  that is not exported keeps the workspace address, as copying writes it. A file whose bytes are gone is
  written as its name, without a link.
- **Each file once**, in the folder of the first document that embeds it; a later one links back to it.
- **Names** come from the catalogue and the blocks, and are made safe for every common file system
  (`safeName`): `\ / : * ? " < > |` and control characters become `_`, trailing dots and spaces go, a
  Windows device name (`CON`, `NUL`…) gets a leading `_`, an empty one is `제목 없음`. A name repeated in
  one folder — compared without case, as Windows does — gets ` (2)`; a sub-page claims both its `.md` and
  its folder's name, so an attachment cannot take the folder's.
- **Trashed documents** are not in the catalogue, so they are not exported, and neither are their files.

## Why the server builds it

The route reads every exported document's root in one `GetDocuments` call (`readDocumentRoots`,
`lib/yorkie-admin.ts`, the call the file manager makes) and the bytes from the file store. Building it in
the browser would mean attaching each sub-page: the exporter would show as present in every one, and a
sub-page nobody had opened would be created in Yorkie by being exported. The root comes back as plain
JSON, read by `readRootBlocks` (`lib/blocks/revision-snapshot.ts`), the revision reader without its YSON
step.

The zip is built in memory (fflate's `zipSync`): a LAN workspace's documents and its 25MB-per-file uploads
fit, and nothing has to be cleaned up afterwards.
