import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "vitest";

import {
  WorkspaceAlreadyOpenError,
  WorkspaceConfigError,
  changeWorkspacePassword,
  getWorkspaceName,
  isWorkspaceOpen,
  isWorkspacePassword,
  openWorkspace,
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
  it("is not open, and no password works", () => {
    assert.equal(isWorkspaceOpen(storePath), false);
    assert.equal(isWorkspacePassword("1234", storePath), false);
    assert.equal(getWorkspaceName(storePath), "RMF Block");
  });

  it("counts a valid env password as the seed", () => {
    process.env.WORKSPACE_PASSWORD = "1234";
    process.env.WORKSPACE_NAME = "Team H";
    assert.equal(isWorkspaceOpen(storePath), true);
    assert.equal(isWorkspacePassword("1234", storePath), true);
    assert.equal(isWorkspacePassword("4321", storePath), false);
    // timingSafeEqual throws on a length mismatch — the guard has to come first.
    assert.equal(isWorkspacePassword("12", storePath), false);
    assert.equal(getWorkspaceName(storePath), "Team H");
  });

  it("ignores an env password below the floor", () => {
    process.env.WORKSPACE_PASSWORD = "123";
    assert.equal(isWorkspaceOpen(storePath), false);
  });
});

describe("openWorkspace", () => {
  it("opens with a name and a password, and stores only a hash", () => {
    openWorkspace({ name: "  Team H  ", password: "letmein" }, storePath);

    assert.equal(isWorkspaceOpen(storePath), true);
    assert.equal(getWorkspaceName(storePath), "Team H");
    assert.equal(isWorkspacePassword("letmein", storePath), true);
    assert.equal(isWorkspacePassword("letmeout", storePath), false);
    assert.equal(readFileSync(storePath, "utf8").includes("letmein"), false);
  });

  it("falls back to the default name when none is given", () => {
    openWorkspace({ name: " ", password: "1234" }, storePath);
    assert.equal(getWorkspaceName(storePath), "RMF Block");
  });

  it("refuses a password below the floor", () => {
    assert.throws(() => openWorkspace({ password: "123" }, storePath), WorkspaceConfigError);
    assert.equal(isWorkspaceOpen(storePath), false);
  });

  it("refuses to open twice", () => {
    openWorkspace({ password: "1234" }, storePath);
    assert.throws(() => openWorkspace({ password: "5678" }, storePath), WorkspaceAlreadyOpenError);
    assert.equal(isWorkspacePassword("1234", storePath), true);
  });

  it("wins over the env seed once written", () => {
    openWorkspace({ name: "File", password: "file-pass" }, storePath);
    process.env.WORKSPACE_PASSWORD = "env-pass";
    process.env.WORKSPACE_NAME = "Env";

    assert.equal(isWorkspacePassword("env-pass", storePath), false);
    assert.equal(isWorkspacePassword("file-pass", storePath), true);
    assert.equal(getWorkspaceName(storePath), "File");
  });
});

describe("changeWorkspacePassword", () => {
  it("replaces the password and keeps the name", () => {
    openWorkspace({ name: "Team H", password: "1234" }, storePath);
    changeWorkspacePassword("5678", storePath);

    assert.equal(isWorkspacePassword("1234", storePath), false);
    assert.equal(isWorkspacePassword("5678", storePath), true);
    assert.equal(getWorkspaceName(storePath), "Team H");
  });

  it("moves a seeded workspace onto the file, name included", () => {
    process.env.WORKSPACE_PASSWORD = "1234";
    process.env.WORKSPACE_NAME = "Seeded";
    changeWorkspacePassword("5678", storePath);
    delete process.env.WORKSPACE_PASSWORD;
    delete process.env.WORKSPACE_NAME;

    assert.equal(isWorkspacePassword("5678", storePath), true);
    assert.equal(getWorkspaceName(storePath), "Seeded");
  });

  it("refuses a password below the floor", () => {
    openWorkspace({ password: "1234" }, storePath);
    assert.throws(() => changeWorkspacePassword("12", storePath), WorkspaceConfigError);
    assert.equal(isWorkspacePassword("1234", storePath), true);
  });
});
