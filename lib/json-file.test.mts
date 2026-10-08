import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, it } from "vitest";

import { readJsonFile, writeJsonFile } from "./json-file.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "rmf-json-file-"));
});

describe("readJsonFile / writeJsonFile", () => {
  it("returns the empty value when there is no file yet", () => {
    assert.deepEqual(readJsonFile(path.join(dir, "missing.json"), []), []);
  });

  it("throws on anything other than a missing file", () => {
    // A directory where a file is expected fails with EISDIR, not ENOENT.
    const filePath = path.join(dir, "store.json");
    mkdirSync(filePath);
    assert.throws(() => readJsonFile(filePath, []));
  });

  it("round-trips, creating the directory and leaving no temp file behind", () => {
    const filePath = path.join(dir, "nested", "store.json");
    writeJsonFile(filePath, [{ id: "a" }]);

    assert.deepEqual(readJsonFile(filePath, []), [{ id: "a" }]);
    assert.deepEqual(readdirSync(path.dirname(filePath)), ["store.json"]);
  });
});
