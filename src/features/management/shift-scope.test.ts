import { describe, expect, it } from "vitest";
import { canOperateOwnShift, canSelectShiftHistoryBranch, resolveShiftHistoryBranchId } from "./shift-scope";

const branches = [{ id: 12 }, { id: 24 }];

describe("shift scope", () => {
  it("lets store administrators and managers choose a branch history without a branch assignment", () => {
    expect(canSelectShiftHistoryBranch({ role: "ROLE_STORE_ADMIN" })).toBe(true);
    expect(canSelectShiftHistoryBranch({ role: "ROLE_STORE_MANAGER" })).toBe(true);
    expect(resolveShiftHistoryBranchId({ role: "ROLE_STORE_MANAGER" }, null, "", branches)).toBe(12);
    expect(resolveShiftHistoryBranchId({ role: "ROLE_STORE_ADMIN" }, null, "24", branches)).toBe(24);
  });

  it("keeps branch-scoped users on their assigned branch", () => {
    expect(canSelectShiftHistoryBranch({ role: "ROLE_BRANCH_MANAGER" })).toBe(false);
    expect(resolveShiftHistoryBranchId({ role: "ROLE_BRANCH_MANAGER" }, 12, "24", branches)).toBe(12);
  });

  it("does not treat a history selection as permission to operate a shift", () => {
    expect(canOperateOwnShift(null)).toBe(false);
    expect(canOperateOwnShift(0)).toBe(false);
    expect(canOperateOwnShift(12)).toBe(true);
    expect(resolveShiftHistoryBranchId({ role: "ROLE_STORE_MANAGER" }, null, "999", branches)).toBe(12);
  });
});
