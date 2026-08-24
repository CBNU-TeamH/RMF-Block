import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  WorkspaceConfigError,
  assertWorkspaceConfigured,
  getWorkspaceName,
  isWorkspacePassword,
} from "./workspace-config.ts";

const originalPassword = process.env.WORKSPACE_PASSWORD;
const originalName = process.env.WORKSPACE_NAME;

afterEach(() => {
  // Restored rather than deleted: another test file in the same `node --test`
  // process may depend on whatever the environment held.
  process.env.WORKSPACE_PASSWORD = originalPassword;
  process.env.WORKSPACE_NAME = originalName;
});

describe("isWorkspacePassword", () => {
  it("accepts the configured password", () => {
    process.env.WORKSPACE_PASSWORD = "1234";
    assert.equal(isWorkspacePassword("1234"), true);
  });

  it("rejects a wrong password of the same length", () => {
    process.env.WORKSPACE_PASSWORD = "1234";
    assert.equal(isWorkspacePassword("4321"), false);
  });

  it("rejects a prefix of the password", () => {
    process.env.WORKSPACE_PASSWORD = "letmein";
    // timingSafeEqual throws on a length mismatch, so the length guard has to
    // come first — this is the case that catches losing it.
    assert.equal(isWorkspacePassword("let"), false);
  });

  it("rejects an empty or missing candidate", () => {
    process.env.WORKSPACE_PASSWORD = "1234";
    assert.equal(isWorkspacePassword(""), false);
    assert.equal(isWorkspacePassword(undefined), false);
  });
});

describe("assertWorkspaceConfigured", () => {
  it("accepts a four-character password", () => {
    process.env.WORKSPACE_PASSWORD = "1234";
    assert.doesNotThrow(() => assertWorkspaceConfigured());
  });

  it("rejects a password below the floor", () => {
    process.env.WORKSPACE_PASSWORD = "123";
    assert.throws(() => assertWorkspaceConfigured(), WorkspaceConfigError);
  });

  it("rejects a missing password", () => {
    delete process.env.WORKSPACE_PASSWORD;
    assert.throws(() => assertWorkspaceConfigured(), WorkspaceConfigError);
  });
});

describe("getWorkspaceName", () => {
  it("uses the configured name", () => {
    process.env.WORKSPACE_NAME = "Team H";
    assert.equal(getWorkspaceName(), "Team H");
  });

  it("falls back when unset or blank", () => {
    delete process.env.WORKSPACE_NAME;
    assert.equal(getWorkspaceName(), "RMF Block");
    process.env.WORKSPACE_NAME = "   ";
    assert.equal(getWorkspaceName(), "RMF Block");
  });
});
