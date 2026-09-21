# Upload size boundary and Content-Disposition filename encoding

**Created**: 2026-09-21
**Issue**: #57, #56
**Design**: no `docs/design/` doc — two localized bug fixes in `lib/files/`, no new
behaviour to design. `docs/design/api.md` §1 already owns the upload contract.

Picked as a pair because both are `lib/files/` bugs whose cause and fix location were
already identified in their issue bodies, and both land on a boundary that
`docs/testing.md` says must be tested at exactly its value.

## Milestones

### 1. #57 — a file exactly at the 25 MB limit is rejected

- **What**: `readUpload()` measures the declared `content-length` against
  `MAX_UPLOAD_BYTES`, but that header covers the whole multipart body — boundary lines,
  part headers, CRLFs — so it always exceeds the file's own size. A file whose
  `file.size` is exactly the limit is refused with 413 before its size is ever read,
  contradicting the error message, which talks about the file.
- **Files**: `lib/files/upload.ts`, `lib/files/upload.test.mts`.
- **Reuse**: the existing `tooLarge()` and the test helper `upload()`, which already
  builds a real multipart body and sets `content-length` from its actual byte length —
  so it reproduces the bug without any new scaffolding.
- **Done**: a file of exactly `MAX_UPLOAD_BYTES` uploads; one byte more is refused.
- **Note**: the two checks are given separate jobs rather than one constant being
  raised. `MAX_UPLOAD_REQUEST_BYTES` bounds what `formData()` will buffer;
  `MAX_UPLOAD_BYTES` remains the verdict on the file. Raising the single constant would
  have let a 25 MB-plus file through.

### 2. #56 — `filename*` emits characters RFC 8187 forbids

- **What**: `dispositionName()` builds the extended parameter with
  `encodeURIComponent`, which leaves `'`, `(`, `)` and `*` unescaped. None is an
  `attr-char`, so a name like `report(final).pdf` produces a malformed header value.
  Both call sites are affected — `attachmentHeaders` (download) and, since #54,
  `inlineHeaders` (PDF preview).
- **Files**: `lib/files/serving.ts`, `lib/files/serving.test.mts`.
- **Reuse**: the existing header-injection tests already fix the shape of this helper's
  output; these extend the same describes rather than adding a new layer.
- **Done**: all four characters come out percent-encoded on both the download and the
  preview path.

## Acceptance

- [x] A file of exactly `MAX_UPLOAD_BYTES` is accepted; `+1` is refused
- [x] The pre-parse check still refuses a body past `MAX_UPLOAD_REQUEST_BYTES`
- [x] `'`, `(`, `)`, `*` are encoded on both `attachmentHeaders` and `inlineHeaders`
- [x] Every new test fails against the unfixed code (verified by reverting both
      behaviours and running them — 5 failed, then restored)
- [ ] `pnpm verify:docs`, `pnpm comments`, `pnpm lint`, `pnpm test`, `pnpm build` pass
- [ ] `/code-review low` and `/simplify` run before the PR (`AGENTS.md` §6)

## Cross-cutting

FR-060-02 and FR-022-13 both run through `readUpload()`; `docs/design/api.md` §1 owns
the upload contract and states the 25 MB limit in terms of the file, which is the
reading this fix restores. No schema, config or migration is touched.

One existing test changed meaning rather than merely being added to: `upload.test.mts`'s
"refuses an oversized body before parsing it" asserted against `MAX_UPLOAD_BYTES + 1`,
which after this fix is a size the pre-parse check should *allow*. It now uses
`MAX_UPLOAD_REQUEST_BYTES + 1`, so it still tests the guard it was written for.

## Review

Filled in once the PR is up.
