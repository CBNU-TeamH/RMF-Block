import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { JoinValidationError, MemberStoreError, WorkspaceFullError } from "./types.ts";

// The registry is loaded twice in one process, so an error it throws may come from the other copy of
// this file: a different class with the same name (#273). A stand-in for that copy:
const fromOtherCopy = (name: string) => Object.assign(new Error("from the other copy"), { name });

describe("the join errors", () => {
  it("recognise an error from another copy of the module by its name", () => {
    assert.ok(fromOtherCopy("JoinValidationError") instanceof JoinValidationError);
    assert.ok(fromOtherCopy("MemberStoreError") instanceof MemberStoreError);
    assert.ok(fromOtherCopy("WorkspaceFullError") instanceof WorkspaceFullError);
  });

  it("tell the three apart, and an ordinary error is none of them", () => {
    const full = new WorkspaceFullError("full");
    assert.ok(full instanceof WorkspaceFullError);
    assert.ok(full instanceof Error);
    assert.ok(!(full instanceof JoinValidationError));
    assert.ok(!(full instanceof MemberStoreError));
    for (const other of [new Error("plain"), new TypeError("type"), "WorkspaceFullError", null]) {
      assert.ok(!(other instanceof WorkspaceFullError));
    }
  });
});
