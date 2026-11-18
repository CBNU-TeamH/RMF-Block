import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "./fixtures";
import { bootstrapHost } from "./helpers";

// The trash test signs a page in as the host, and the role cookie carries the host secret.
test.use({ trace: "off" });

type Catalogued = { id: string; name: string; parentId: string | null };

async function create(api: APIRequestContext, name: string, parentId?: string) {
  return api.post("/api/documents", { data: { name, parentId } });
}

async function created(api: APIRequestContext, name: string, parentId?: string): Promise<Catalogued> {
  const response = await create(api, name, parentId);
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).document;
}

async function catalogue(api: APIRequestContext): Promise<Array<Catalogued>> {
  const response = await api.get("/api/documents");
  expect(response.status()).toBe(200);
  return (await response.json()).documents;
}

/**
 * UC-021: what the catalogue does with a new document's place and name. Checked on the stack's HTTP
 * API with a member's session — the dialog sends exactly these requests, and `tree.e2e.ts` covers
 * the dialog and the peer's tree.
 */
test("a document is created under a parent, never under one that is missing (FR-021-02)", async ({ users }) => {
  const { context } = await users.join(0);
  const api = context.request;
  const parent = await created(api, `e2e parent ${Date.now()}`);

  const child = await created(api, `e2e child ${Date.now()}`, parent.id);
  expect(child.parentId).toBe(parent.id);
  expect((await catalogue(api)).find((entry) => entry.id === child.id)?.parentId).toBe(parent.id);

  const orphan = `e2e orphan ${Date.now()}`;
  const refused = await create(api, orphan, "00000000-0000-4000-8000-000000000000");
  expect(refused.status()).toBe(400);
  expect(await refused.json()).toEqual({ error: "상위 문서를 찾을 수 없습니다." });
  expect((await catalogue(api)).map((entry) => entry.name)).not.toContain(orphan);
});

test("a name taken beside it gets a (n) suffix, and the same name elsewhere is left alone (FR-021-03, FR-021-04)", async ({ users }) => {
  const { context } = await users.join(0);
  const api = context.request;
  const name = `e2e same ${Date.now()}`;
  const parent = await created(api, `e2e holder ${Date.now()}`);

  expect((await created(api, name)).name).toBe(name);
  expect((await created(api, name)).name).toBe(`${name} (2)`);
  expect((await created(api, name)).name).toBe(`${name} (3)`);
  // Another place: the name is only unique among its siblings.
  expect((await created(api, name, parent.id)).name).toBe(name);
});

test("a blank name is refused and a padded one is trimmed (FR-021-01)", async ({ users }) => {
  const { context } = await users.join(0);
  const api = context.request;
  const before = (await catalogue(api)).length;

  for (const blank of ["", "   ", "\t \n"]) {
    const refused = await create(api, blank);
    expect(refused.status(), JSON.stringify(blank)).toBe(400);
    expect(await refused.json()).toEqual({ error: "문서 이름을 입력해 주세요." });
  }
  expect((await catalogue(api)).length).toBe(before);

  const name = `e2e padded ${Date.now()}`;
  expect((await created(api, `   ${name}  `)).name).toBe(name);
});

test("a rename that clashes with a sibling is refused; its own name and another parent's are not (FR-023-02)", async ({ users }) => {
  const { context } = await users.join(0);
  const api = context.request;
  const stamp = Date.now();
  const parent = await created(api, `e2e rename parent ${stamp}`);
  const elsewhere = await created(api, `e2e rename elsewhere ${stamp}`);
  const first = await created(api, `e2e first ${stamp}`, parent.id);
  const second = await created(api, `e2e second ${stamp}`, parent.id);
  const abroad = await created(api, `e2e abroad ${stamp}`, elsewhere.id);
  const rename = (id: string, name: string) => api.patch(`/api/documents/${id}`, { data: { name } });

  const clash = await rename(second.id, first.name);
  expect(clash.status()).toBe(400);
  expect(await clash.json()).toEqual({ error: "같은 위치에 같은 이름의 문서가 있습니다." });
  expect((await catalogue(api)).find((entry) => entry.id === second.id)?.name).toBe(second.name);

  expect((await rename(second.id, second.name)).status()).toBe(200);
  // A sibling elsewhere already has this name; here it is free.
  expect((await rename(second.id, abroad.name)).status()).toBe(200);
  expect((await catalogue(api)).find((entry) => entry.id === second.id)?.name).toBe(abroad.name);
});

/**
 * FR-023-06: deleting a document takes its sub-documents with it, leaves a sibling's alone, and the
 * host's trash holds the whole subtree as one entry. The trash is the host's page, so the host
 * signs in on `page`.
 */
test("deleting a document with children removes the subtree, keeps its siblings' children, and trashes one entry (FR-023-06)", async ({ page, users }) => {
  const { context } = await users.join(0);
  const api = context.request;
  const stamp = Date.now();
  const doomed = await created(api, `e2e doomed ${stamp}`);
  const sibling = await created(api, `e2e sibling ${stamp}`);
  const child = await created(api, `e2e doomed child ${stamp}`, doomed.id);
  const grandchild = await created(api, `e2e doomed grandchild ${stamp}`, child.id);
  const kept = await created(api, `e2e kept child ${stamp}`, sibling.id);

  const removed = await api.delete(`/api/documents/${doomed.id}`);
  expect(removed.status(), await removed.text()).toBe(200);

  const ids = (await catalogue(api)).map((entry) => entry.id);
  for (const gone of [doomed, child, grandchild]) expect(ids).not.toContain(gone.id);
  for (const stays of [sibling, kept]) expect(ids).toContain(stays.id);
  expect((await api.get(`/api/documents/${grandchild.id}`)).status()).toBe(404);

  await bootstrapHost(page);
  await page.goto("/admin");
  const trash = page.getByRole("region", { name: "휴지통" }).getByRole("listitem");
  // One entry for the subtree, named for its root, counting the two below it.
  await expect(trash.filter({ hasText: doomed.name })).toHaveCount(1);
  await expect(trash.filter({ hasText: doomed.name })).toContainText("하위 문서 2개");
  await expect(trash.filter({ hasText: child.name })).toHaveCount(0);
  await expect(trash.filter({ hasText: grandchild.name })).toHaveCount(0);
});
