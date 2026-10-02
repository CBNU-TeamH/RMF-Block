# Declare structural facts in docs and verify them against the AST — lessons

**Created**: 2026-10-02

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- Filtering `path.relative()` output against `/`-separated prefixes hid every nested skill file on Windows. Filtering both sides then made a stale mirror look clean with zero checked files.
- A regex that collected only complete declaration blocks silently dropped an unclosed block, reporting zero facts with no errors. Declaration openings must be accounted for even when parsing fails.

## What we would do differently

- Exercise a verifier with mismatching fixtures under Windows and POSIX path semantics; a clean checkout alone cannot distinguish a correct pass from an empty scan.
- Test a missing closer both at the end of a file and before a valid declaration, so the later block cannot hide the malformed one.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- No new convention needed for this fix: reuse the native-separator normalization already used by `scripts/lib/ast-facts.mjs` before filtering relative paths.
- The declaration fix enforces the already documented parse-error behavior; no additional convention is needed.
