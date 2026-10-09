import { treeRows, type TreeNode } from "./documents/tree.ts";

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

/** Closing the active tab makes its right neighbour active, else its left. */
export function closeTab(tabs: Tabs, id: string): Tabs {
  const index = tabs.open.indexOf(id);
  if (index === -1) return tabs;
  const open = tabs.open.filter((other) => other !== id);
  if (tabs.active !== id) return { ...tabs, open };
  return { open, active: open[index] ?? open[index - 1] ?? null };
}

/** Puts `id` before `beforeId`, or last when `beforeId` is `null`. */
export function moveTab(tabs: Tabs, id: string, beforeId: string | null): Tabs {
  if (id === beforeId || !tabs.open.includes(id)) return tabs;
  const open = tabs.open.filter((other) => other !== id);
  const at = beforeId === null ? -1 : open.indexOf(beforeId);
  open.splice(at === -1 ? open.length : at, 0, id);
  return { ...tabs, open };
}

/** Where `/` goes: the last document shown if it still exists, else the
 *  sidebar's first row, else nowhere, which is an empty workspace. */
export function landingId(tabs: Tabs, documents: Array<TreeNode>): string | null {
  if (tabs.active && documents.some((doc) => doc.id === tabs.active)) return tabs.active;
  return treeRows(documents)[0]?.document.id ?? null;
}
