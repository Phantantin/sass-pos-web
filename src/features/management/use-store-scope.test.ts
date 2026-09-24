import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/types/api";
import { canCreateStore, canUpdateStore } from "./use-store-scope";

function profile(role: CurrentUser["role"]): CurrentUser {
  return { id: 1, fullName: "Test user", email: "test@example.com", role, storeId: null, branchId: null };
}

describe("store onboarding permissions", () => {
  it("lets a store administrator create one or more stores", () => {
    expect(canCreateStore(profile("ROLE_STORE_ADMIN"))).toBe(true);
    expect(canCreateStore(profile("ROLE_ADMIN"))).toBe(false);
    expect(canCreateStore(profile("ROLE_STORE_MANAGER"))).toBe(false);
  });

  it("matches the backend policy for updating a store", () => {
    expect(canUpdateStore(profile("ROLE_ADMIN"))).toBe(true);
    expect(canUpdateStore(profile("ROLE_STORE_ADMIN"))).toBe(true);
    expect(canUpdateStore(profile("ROLE_STORE_MANAGER"))).toBe(false);
  });
});
