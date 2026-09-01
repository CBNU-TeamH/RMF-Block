import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { FileRepository } from "./file-repository.ts";
import { InvalidFileIdError, type NewFile } from "./types.ts";

const roots: Array<string> = [];

async function freshStore() {
  const root = await mkdtemp(path.join(tmpdir(), "rmf-files-"));
  roots.push(root);
  return new FileRepository(path.join(root, "files"));
}

after(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

const upload = (overrides: Partial<NewFile> = {}): NewFile => ({
  name: "report.pdf",
  type: "application/pdf",
  size: 3,
  uploadedBy: "alice",
  origin: "chat",
  ...overrides,
});

describe("FileRepository.save", () => {
  it("returns the file with an id and a timestamp the caller did not supply", async () => {
    const store = await freshStore();

    const saved = await store.save(Buffer.from("abc"), upload());

    assert.ok(saved.id);
    assert.ok(saved.uploadedAt);
    assert.equal(saved.name, "report.pdf");
    assert.equal(saved.uploadedBy, "alice");
  });

  it("gives every upload its own id, even for the same name", async () => {
    const store = await freshStore();

    const first = await store.save(Buffer.from("a"), upload());
    const second = await store.save(Buffer.from("b"), upload());

    assert.notEqual(second.id, first.id);
    assert.deepEqual(await store.read(first.id), Buffer.from("a"));
    assert.deepEqual(await store.read(second.id), Buffer.from("b"));
  });

  it("stores bytes under the id, never under the uploaded name", async () => {
    // The name is chosen by whoever uploaded, and `../../` is a valid string to
    // put in one. This is the case that would escape the store.
    const store = await freshStore();

    const saved = await store.save(
      Buffer.from("x"),
      upload({ name: "../../../etc/passwd" }),
    );

    assert.equal(saved.name, "../../../etc/passwd");
    assert.deepEqual(await store.read(saved.id), Buffer.from("x"));
  });

  it("writes nothing but the ids and the index into its directory", async () => {
    const store = await freshStore();
    await store.save(Buffer.from("x"), upload({ name: "a/b/c.txt" }));

    const entries = await readdir(path.join(roots.at(-1)!, "files"));

    assert.deepEqual(
      entries.filter((entry) => entry !== "index.json").length,
      1,
      "exactly one blob, named by id",
    );
    assert.ok(entries.includes("index.json"));
  });

  it("does not lose an upload to a concurrent one", async () => {
    // Both read the index, both write it back — without serializing, the second
    // write drops the first's record.
    const store = await freshStore();

    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        store.save(Buffer.from(String(i)), upload({ name: `f${i}` })),
      ),
    );

    assert.equal((await store.list()).length, 8);
  });

  it("leaves no orphaned bytes when the index cannot be written", async () => {
    // Bytes with no record are bytes nothing can ever find or delete.
    const store = await freshStore();
    const root = path.join(roots.at(-1)!, "files");

    const kept = await store.save(Buffer.from("first"), upload());
    // A directory where the index file belongs: writing it fails, reading the
    // existing one still works.
    const { rm, mkdir } = await import("node:fs/promises");
    await rm(path.join(root, "index.json"));
    await mkdir(path.join(root, "index.json"));

    await assert.rejects(() => store.save(Buffer.from("second"), upload()));

    // Only the failed upload's bytes go. Asserting the directory is empty would
    // pass just as well for a rollback that wiped the store.
    const entries = await readdir(root);
    assert.deepEqual(
      entries.filter((entry) => entry !== "index.json"),
      [kept.id],
      "the failed upload's bytes are gone and the earlier one is untouched",
    );
  });
});

describe("FileRepository.read", () => {
  it("returns null for an id that was never issued", async () => {
    const store = await freshStore();

    assert.equal(await store.read("6f9619ff-8b86-4d01-b42d-00cf4fc964ff"), null);
  });

  it("refuses an id that could not have come from this store", async () => {
    // Ids arrive from a URL. This is checked before any path is built from one.
    const store = await freshStore();

    for (const id of ["../index.json", "..%2Findex.json", "", "a".repeat(36)]) {
      await assert.rejects(() => store.read(id), InvalidFileIdError, id);
    }
  });

  it("cannot be walked out of the store", async () => {
    const store = await freshStore();
    const outside = path.join(roots.at(-1)!, "secret.txt");
    await writeFile(outside, "not yours");

    await assert.rejects(() => store.read("../secret.txt"), InvalidFileIdError);
    assert.equal(await readFile(outside, "utf8"), "not yours");
  });
});

describe("FileRepository.list", () => {
  it("is empty before anything is uploaded", async () => {
    const store = await freshStore();

    assert.deepEqual(await store.list(), []);
  });

  it("returns the newest upload first", async () => {
    const store = await freshStore();
    const first = await store.save(Buffer.from("a"), upload({ name: "first" }));
    // The timestamps are ISO strings at millisecond resolution, so two saves in
    // the same millisecond would tie.
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await store.save(Buffer.from("b"), upload({ name: "second" }));

    assert.deepEqual(
      (await store.list()).map((file) => file.id),
      [second.id, first.id],
    );
  });

  it("narrows to one origin when asked", async () => {
    const store = await freshStore();
    await store.save(Buffer.from("a"), upload());

    assert.equal((await store.list("chat")).length, 1);
  });

  it("survives a restart", async () => {
    // A new instance over the same directory is what a container restart is.
    const store = await freshStore();
    const saved = await store.save(Buffer.from("abc"), upload());

    const reopened = new FileRepository(path.join(roots.at(-1)!, "files"));

    assert.deepEqual(await reopened.find(saved.id), saved);
    assert.deepEqual(await reopened.read(saved.id), Buffer.from("abc"));
  });
});

describe("FileRepository.find", () => {
  it("returns null for an id it does not hold", async () => {
    const store = await freshStore();

    assert.equal(await store.find("6f9619ff-8b86-4d01-b42d-00cf4fc964ff"), null);
  });
});
