/** The documents one viewer has open as tabs (#168), as arithmetic on a list.
 *  Kept in `localStorage` — which tabs this person has open is worth nothing to
 *  anyone else. Ids only: names come from the catalogue, so a rename shows and
 *  a deleted document's tab drops without this list knowing. */

export const STORAGE_KEY = "rmf-document-tabs";

/** `active` is the last document shown, which `/` lands on. */
export type Tabs = { open: Array<string>; active: string | null };

export const NO_TABS: Tabs = { open: [], active: null };

export function parseTabs(raw: string | null): Tabs {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? "");
  } catch {
    return NO_TABS;
  }
  const { open, active } = (value ?? {}) as Record<string, unknown>;
  if (!Array.isArray(open)) return NO_TABS;
  const ids = [...new Set(open.filter((id): id is string => typeof id === "string"))];
  return { open: ids, active: typeof active === "string" && ids.includes(active) ? active : null };
}

/** Appended if it is not open yet, and made active either way. */
export function openTab(tabs: Tabs, id: string): Tabs {
  if (tabs.active === id && tabs.open.includes(id)) return tabs;
  return { open: tabs.open.includes(id) ? tabs.open : [...tabs.open, id], active: id };
}

/** `next` is where to go: the right neighbour of a closed active tab, else its
 *  left, or `null` when the closed tab was not the one showing. */
export function closeTab(tabs: Tabs, id: string): { tabs: Tabs; next: string | null } {
  const index = tabs.open.indexOf(id);
  if (index === -1) return { tabs, next: null };
  const open = tabs.open.filter((other) => other !== id);
  if (tabs.active !== id) return { tabs: { ...tabs, open }, next: null };
  const next = open[index] ?? open[index - 1] ?? null;
  return { tabs: { open, active: next }, next };
}

/** Drops the tabs `keep` rejects — documents deleted since — so closing a tab
 *  never moves to one that is gone. */
export function pruneTabs(tabs: Tabs, keep: (id: string) => boolean): Tabs {
  const open = tabs.open.filter(keep);
  if (open.length === tabs.open.length) return tabs;
  return { open, active: tabs.active && open.includes(tabs.active) ? tabs.active : null };
}

/** Puts `id` before `beforeId`, or last when `beforeId` is `null`. */
export function moveTab(tabs: Tabs, id: string, beforeId: string | null): Tabs {
  if (id === beforeId || !tabs.open.includes(id)) return tabs;
  const open = tabs.open.filter((other) => other !== id);
  const at = beforeId === null ? -1 : open.indexOf(beforeId);
  open.splice(at === -1 ? open.length : at, 0, id);
  return { ...tabs, open };
}

/** Where `/` goes: the last document shown if it still exists, else the first
 *  root document (the sidebar's first row — both are newest first), else
 *  nowhere, which is an empty workspace. */
export function landingId(
  tabs: Tabs,
  documents: Array<{ id: string; parentId?: string | null }>,
): string | null {
  if (tabs.active && documents.some((doc) => doc.id === tabs.active)) return tabs.active;
  return documents.find((doc) => !doc.parentId)?.id ?? null;
}
