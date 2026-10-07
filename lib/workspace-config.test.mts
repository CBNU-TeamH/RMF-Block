import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "vitest";

import {
  WorkspaceConfigError,
  changeWorkspacePassword,
  getWorkspaceName,
  isWorkspaceOpen,
  isWorkspacePassword,
  openWorkspace,
  seedWorkspaceFromEnv,
} from "./workspace-config.ts";

const originalPassword = process.env.WORKSPACE_PASSWORD;
const originalName = process.env.WORKSPACE_NAME;

// `process.env.X = undefined` stores the *string* "undefined" rather than
// clearing the variable — and "undefined" is nine characters, so it would sail
// past the password length check and leak into every later test in this
// process. Restore only what was actually set.
function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

let storePath: string;

beforeEach(() => {
  delete process.env.WORKSPACE_PASSWORD;
  delete process.env.WORKSPACE_NAME;
  storePath = path.join(mkdtempSync(path.join(tmpdir(), "rmf-workspace-")), "workspace.json");
});

afterEach(() => {
  restore("WORKSPACE_PASSWORD", originalPassword);
  restore("WORKSPACE_NAME", originalName);
});

describe("before setup", () => {
  it("is not open, and no password works", async () => {
    assert.equal(isWorkspaceOpen(storePath), false);
    assert.equal(await isWorkspacePassword("1234", storePath), false);
    assert.equal(getWorkspaceName(storePath), "RMF Block");
  });
});

describe("openWorkspace", () => {
  it("opens with a name and a password, and stores only a hash", async () => {
    await openWorkspace({ name: "  Team H  ", password: "letmein" }, storePath);

    assert.equal(isWorkspaceOpen(storePath), true);
    assert.equal(getWorkspaceName(storePath), "Team H");
    assert.equal(await isWorkspacePassword("letmein", storePath), true);
    assert.equal(await isWorkspacePassword("letmeout", storePath), false);
    assert.equal(await isWorkspacePassword("", storePath), false);
    assert.equal(readFileSync(storePath, "utf8").includes("letmein"), false);
  });

  it("falls back to the default name when none is given", async () => {
    await openWorkspace({ name: " ", password: "1234" }, storePath);
    assert.equal(getWorkspaceName(storePath), "RMF Block");
  });

  it("refuses a password below the floor", async () => {
    await assert.rejects(openWorkspace({ password: "123" }, storePath), WorkspaceConfigError);
    assert.equal(isWorkspaceOpen(storePath), false);
  });
});

describe("changeWorkspacePassword", () => {
  it("replaces the password and keeps the name", async () => {
    await openWorkspace({ name: "Team H", password: "1234" }, storePath);
    await changeWorkspacePassword("5678", storePath);

    assert.equal(await isWorkspacePassword("1234", storePath), false);
    assert.equal(await isWorkspacePassword("5678", storePath), true);
    assert.equal(getWorkspaceName(storePath), "Team H");
  });

  it("refuses a password below the floor", async () => {
    await openWorkspace({ password: "1234" }, storePath);
    await assert.rejects(changeWorkspacePassword("12", storePath), WorkspaceConfigError);
    assert.equal(await isWorkspacePassword("1234", storePath), true);
  });
});

describe("seedWorkspaceFromEnv (dev/CI)", () => {
  it("opens a never-set-up workspace from the env", async () => {
    process.env.WORKSPACE_PASSWORD = "1234";
    process.env.WORKSPACE_NAME = "Seeded";
    await seedWorkspaceFromEnv(storePath);

    assert.equal(await isWorkspacePassword("1234", storePath), true);
    assert.equal(getWorkspaceName(storePath), "Seeded");
  });

  it("never overrides what the admin page saved", async () => {
    await openWorkspace({ name: "File", password: "file-pass" }, storePath);
    process.env.WORKSPACE_PASSWORD = "env-pass";
    await seedWorkspaceFromEnv(storePath);

    assert.equal(await isWorkspacePassword("file-pass", storePath), true);
    assert.equal(await isWorkspacePassword("env-pass", storePath), false);
  });

  it("does nothing without a usable env password", async () => {
    process.env.WORKSPACE_PASSWORD = "123";
    await seedWorkspaceFromEnv(storePath);
    assert.equal(isWorkspaceOpen(storePath), false);
  });
});
