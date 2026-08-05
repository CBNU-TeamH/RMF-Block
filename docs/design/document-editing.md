# Document Editing — Block Schema

- **Status**: Agreed. All 12 block types finalized. The one remaining open question (SDK convergence check) is a pre-implementation verification step, not a blocker to agreement.
- **Related**: [`docs/design/architecture.md`](architecture.md) §3(a), §5; [`docs/SRS-ko.md`](../SRS-ko.md) §4.1

## Scope

Field-level Yorkie document schema for each block type listed in SRS §4.1. Per `architecture.md` §3(a)/§5, this doc is written just-in-time, block type by block type, before the Document Editing module's implementation task starts.

## Document structure

```
root.blocks: Array<Block>
Block = { id: string (uuid), type: string, content: <type-specific, see below> }
```

- `root.blocks` is a **Yorkie Array**, not an Object keyed by id. Yorkie's Array is RGA-backed, so concurrent inserts at the same position already converge deterministically — block order is the array position itself, not a stored field. This replaces the `order` field originally sketched in `architecture.md` §3(a).
- Reordering (FR-022-04) uses the array's native `moveBefore`/`moveAfter` — no custom merge logic, per ADR-001.
- `id` stays on every block regardless of position, since presence (`activeBlockId`) and the future 블록 링크 블록 need a stable reference independent of array order.
- **Open risk**: `yorkie-team/yorkie#676` reported non-convergence when the moved element is also the reference element in a concurrent `moveAfter`, reported fixed but the fixed version isn't confirmed from the docs alone. Verify this scenario against the pinned `@yorkie-js/sdk` version when the Sync module wires up reordering.
- Block/text color and styling is an open decision (`AGENTS.md` §7) and intentionally not part of any block's `content` below — see that TODO item for why deferring it doesn't require reworking this schema.

## Block types

### 1. Text block (`type: "text"`)

```
content = yorkie.Text
```

Plain text, no inline marks. SRS has no inline-formatting requirement for block content; the presenter highlight/underline tools (FR-030-12~14) are a separate, ephemeral overlay unrelated to stored block content.

### 2. Heading block (`type: "heading"`)

```
content = {
  level: 1 | 2 | 3   // Yorkie primitive, LWW
  text: yorkie.Text
}
```

`level` is a single atomic value, not something requiring char-level merge, so plain LWW is enough.

### 3. List block (`type: "list"`)

```
content = {
  style: "ordered" | "unordered"   // Yorkie primitive, LWW
  depth: number                      // nesting level, 0-based; Yorkie primitive, LWW
  text: yorkie.Text
}
```

One list **item** is one block, not one block per whole list — keeps per-item occupancy (FR-022-06), move, and delete consistent with the rest of the block model. Consecutive same-`style` blocks render as a single visual list on the client; ordered-list numbering is computed at render time from position among consecutive `style: "ordered"` blocks at the same `depth`, not stored, to avoid renumbering conflicts on insert/delete. Nesting requirement: SRS §4.1 목록 블록.

### 4. Checklist block (`type: "checklist"`)

```
content = {
  checked: boolean   // Yorkie primitive, LWW
  text: yorkie.Text
}
```

One task item per block, same reasoning as the list block. No nesting field — SRS §4.1 체크리스트 블록 doesn't call for it, unlike the list block. Add a `depth` field the same way if that changes.

### 5. Quote block (`type: "quote"`)

```
content = yorkie.Text
```

Same shape as the text block — SRS only calls for emphasizing a passage, no source/attribution fields. `type` alone drives the quote styling on render.

### 6. Code block (`type: "code"`)

```
content = yorkie.Text
```

Same shape again. SRS asks for "source code or fixed-width text," not language-aware syntax highlighting, so no `language` field. Fixed-width rendering is a client style concern, not schema. Add `language: string` later if syntax highlighting becomes a requirement.

### 7. Divider block (`type: "divider"`)

```
Block = { id, type: "divider" }
```

The only type with no `content` at all — a divider has no data to hold.

### 8. File block (`type: "file"`)

```
content = {
  fileId: string                          // reference into the File API's store; download/preview go through the File API, not this block
  fileName: string                          // cached at upload time so the block renders instantly on other clients (NFR-PER-002) without a File API round-trip
  fileType: string                          // e.g. mime type or extension — open-ended, not limited to word/ppt/excel
  size: number                              // bytes
}
```

File bytes never enter the Yorkie document — only a reference plus display metadata cached at upload time. Files have no rename operation in the SRS, so this cache can't go stale the way a cached document title could.

`fileType` is a free-form string, not a closed `"word" | "ppt" | "excel"` enum: FR-022-13 allows uploading any file as a file block, FR-022-14 only calls out image/PDF/Word/PPT/Excel for special dispatch — a closed enum would leave no way to represent any other uploaded file type.

**Mapping**: image → image block (9), PDF → PDF block (10), everything else (Word/PPT/Excel and any other file type) → this file block. §4.1 lists 이미지 블록/PDF 블록 as their own kinds distinct from 파일 블록, and only those two need in-block inline preview per their descriptions — other files stay generic embeds, with inline preview handled separately by UC-080's viewer.

### 9. Image block (`type: "image"`)

```
content = {
  fileId: string
  fileName: string
  size: number
}
```

Same pattern as the file block, minus `fileType` (the block `type` already says "image"). No width/height/alt-text/caption fields — no resize or captioning requirement in SRS.

### 10. PDF block (`type: "pdf"`)

```
content = {
  fileId: string
  fileName: string
  size: number
}
```

Identical shape to the image block. No page-count or current-page tracking — not required by SRS.

### 11. Document link block (`type: "doc-link"`)

```
content = {
  documentId: string
}
```

No cached title, unlike file blocks. Documents can be renamed/moved (UC-023, FR-021 series), so a cached title would go stale — and unlike file metadata, the document tree is core navigation state every client already keeps loaded, so resolving `documentId` to a title needs no round-trip anyway.

### 12. Block link block (`type: "block-link"`)

```
content = {
  documentId: string
  blockId: string   // target block's stable `id`, not its array position
}
```

Matches the "문서 ID + 블록 위치 정보" pair used throughout SRS wherever a block reference appears (UC-050, UC-060, UC-070). No cached preview of the target block's content — block content is the highest-churn data in the system, so a cache would go stale faster than anything else considered here.

## Open questions

- Concurrent-move convergence on the pinned SDK version (see block-structure note above).
- Block/text color and styling (`AGENTS.md` §7).
