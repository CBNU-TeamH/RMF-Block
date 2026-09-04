// Shared by comment-budget.mjs and verify-docs.mjs so the promotion date and
// its message live in exactly one place.
//
// 2026-09-23 is #65's gate date: comment-budget promotes from a local-only
// check to a required CI check once the gate's own criteria (zero false
// positives, the promotion loop actually running) are confirmed. See
// docs/conventions.md and AGENTS.md §7.
export const COMMENT_BUDGET_PROMOTION_DATE = "2026-09-23";

export function promotionNotice(today = new Date()) {
  const due = new Date(`${COMMENT_BUDGET_PROMOTION_DATE}T00:00:00`);
  if (today < due) return null;
  return (
    `comment-budget's promotion date (${COMMENT_BUDGET_PROMOTION_DATE}) has passed — ` +
    `promote it to a CI check now if the gate criteria in AGENTS.md §7 are met.`
  );
}
