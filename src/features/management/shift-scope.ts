import type { CurrentUser } from "@/types/api";

type ShiftProfile = Pick<CurrentUser, "role"> | undefined;
type BranchOption = { id: number };

/**
 * Store-level users can inspect shifts across their own store. Branch-level
 * users remain limited to the branch the API has assigned to their account.
 */
export function canSelectShiftHistoryBranch(profile: ShiftProfile) {
  return profile?.role === "ROLE_STORE_ADMIN" || profile?.role === "ROLE_STORE_MANAGER";
}

/**
 * Opening and closing a shift is always tied to the authenticated user's
 * assignment. A history selection must never be used as an implied assignment.
 */
export function canOperateOwnShift(assignedBranchId: number | null) {
  return typeof assignedBranchId === "number" && Number.isSafeInteger(assignedBranchId) && assignedBranchId > 0;
}

export function resolveShiftHistoryBranchId(
  profile: ShiftProfile,
  assignedBranchId: number | null,
  selectedBranchId: string,
  branches: readonly BranchOption[] | undefined,
) {
  if (!canSelectShiftHistoryBranch(profile)) {
    return canOperateOwnShift(assignedBranchId) ? assignedBranchId : null;
  }

  const selectedId = Number(selectedBranchId);
  if (Number.isSafeInteger(selectedId) && selectedId > 0 && branches?.some((branch) => branch.id === selectedId)) {
    return selectedId;
  }

  return branches?.[0]?.id ?? null;
}
