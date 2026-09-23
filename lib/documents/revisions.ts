/** Yorkie's flat revision list as a history sidebar needs it — a kind per
 *  revision, and day groups. Every rule here is argued in
 *  `docs/design/version-history.md`. */

/** Where a revision came from. Yorkie labels its own; the app labels the rest. */
export type RevisionKind = "automatic" | "before-restore" | "named";

/** Yorkie's own label on every snapshot it takes, e.g. `snapshot-27`. */
const AUTOMATIC_LABEL = /^snapshot-\d+$/;

/** The app's prefix for the revision it takes just before a restore. English
 *  and machine-readable because a stored label is permanent — no delete API. */
export const BEFORE_RESTORE_PREFIX = "before-restore:";

/** How many revisions one `listRevisions` call asks for. There is no ceiling
 *  on the total: nothing is unreachable, so truncating would hide history. */
export const REVISION_PAGE_SIZE = 50;

/** Whether the oldest revision is now on screen. */
export function isOldestPage(page: Array<unknown>): boolean {
  return page.length < REVISION_PAGE_SIZE;
}

/** A revision as the sidebar needs it: Yorkie's summary plus its kind. */
export type RevisionEntry = {
  id: string;
  label: string;
  description: string;
  kind: RevisionKind;
  createdAt: Date;
};

/** The label to store for a revision taken before restoring `targetId`. */
export function beforeRestoreLabel(targetId: string): string {
  return `${BEFORE_RESTORE_PREFIX}${targetId}`;
}

/** Which of the three a label means; an unrecognised one reads as `named`. */
export function classifyRevision(label: string): RevisionKind {
  if (AUTOMATIC_LABEL.test(label)) return "automatic";
  if (label.startsWith(BEFORE_RESTORE_PREFIX)) return "before-restore";

  return "named";
}

/** Why a person may not save under this name, or `null` if they may — a label
 *  shaped like a reserved kind would be misread (`docs/design/version-history.md`, "Kinds"). */
export function reservedLabelReason(label: string): string | null {
  if (AUTOMATIC_LABEL.test(label)) {
    return "`snapshot-숫자`는 자동 저장이 쓰는 이름입니다. 다른 이름을 지어 주세요.";
  }
  if (label.startsWith(BEFORE_RESTORE_PREFIX)) {
    return `'${BEFORE_RESTORE_PREFIX}'로 시작하는 이름은 복원 기록이 쓰는 형식입니다.`;
  }

  return null;
}

/** Yorkie's summaries as entries, newest first — sorted here because
 *  `listRevisions` takes an `isForward` flag, so order is the caller's. */
export function toRevisionEntries(
  summaries: Array<{ id: string; label: string; description: string; createdAt: Date }>,
): Array<RevisionEntry> {
  return summaries
    .map((summary) => ({ ...summary, kind: classifyRevision(summary.label) }))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

/** The workspace's one timezone, not the viewer's and not the container's —
 *  `app/(workspace)/document-list.tsx` states why. */
const DAY = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

export type RevisionDay = { day: string; entries: Array<RevisionEntry> };

/** Entries split into day groups, keeping the order they arrive in. */
export function groupRevisionsByDay(entries: Array<RevisionEntry>): Array<RevisionDay> {
  const days: Array<RevisionDay> = [];

  for (const entry of entries) {
    const day = DAY.format(entry.createdAt);
    const last = days[days.length - 1];

    if (last?.day === day) {
      last.entries.push(entry);
    } else {
      days.push({ day, entries: [entry] });
    }
  }

  return days;
}
