import { describe, expect, it } from "vitest";
import { can, isUserRole, roleHome, roleTitle, type UserRole } from "@/lib/auth/roles";

const roles: UserRole[] = [
  "ROLE_ADMIN",
  "ROLE_STORE_ADMIN",
  "ROLE_STORE_MANAGER",
  "ROLE_BRANCH_MANAGER",
  "ROLE_BRANCH_CASHIER",
];

describe("role authorization helpers", () => {
  it("maps every supported role to a locale-scoped landing page", () => {
    for (const role of roles) {
      expect(roleHome(role, "vi")).toMatch(/^\/vi\/(dashboard|pos)$/);
      expect(roleHome(role, "en")).toMatch(/^\/en\/(dashboard|pos)$/);
    }
  });

  it("does not accept prototype property names as account roles", () => {
    expect(isUserRole("ROLE_ADMIN")).toBe(true);
    expect(isUserRole("toString")).toBe(false);
    expect(isUserRole("constructor")).toBe(false);
    expect(isUserRole("ROLE_UNKNOWN")).toBe(false);
    expect(isUserRole(null)).toBe(false);
  });

  it("shows a localized job title for every role", () => {
    for (const role of roles) {
      expect(roleTitle(role, "vi")).not.toContain("ROLE_");
      expect(roleTitle(role, "en")).not.toContain("ROLE_");
    }
    expect(roleTitle("ROLE_BRANCH_CASHIER", "vi")).toBe("Thu ngân");
    expect(roleTitle("ROLE_ADMIN", "en")).toBe("System Administrator (HQ)");
  });

  it("keeps POS and management access separated by role", () => {
    expect(can("ROLE_ADMIN", "inventory")).toBe(true);
    expect(can("ROLE_ADMIN", "pos")).toBe(false);
    expect(can("ROLE_BRANCH_CASHIER", "pos")).toBe(true);
    expect(can("ROLE_BRANCH_CASHIER", "inventory")).toBe(false);
    expect(can("ROLE_STORE_MANAGER", "employee")).toBe(true);
    expect(can("ROLE_BRANCH_MANAGER", "customer")).toBe(false);
    expect(can("ROLE_BRANCH_CASHIER", "subscription")).toBe(false);
  });

  it("only exposes audit logs to system and store management roles", () => {
    expect(can("ROLE_ADMIN", "audit")).toBe(true);
    expect(can("ROLE_STORE_ADMIN", "audit")).toBe(true);
    expect(can("ROLE_STORE_MANAGER", "audit")).toBe(false);
    expect(can("ROLE_BRANCH_MANAGER", "audit")).toBe(false);
    expect(can("ROLE_BRANCH_CASHIER", "audit")).toBe(false);
  });

  it("exposes transfer workflow to inventory managers but not cashiers", () => {
    expect(can("ROLE_ADMIN", "transfer")).toBe(true);
    expect(can("ROLE_STORE_ADMIN", "transfer")).toBe(true);
    expect(can("ROLE_STORE_MANAGER", "transfer")).toBe(true);
    expect(can("ROLE_BRANCH_MANAGER", "transfer")).toBe(true);
    expect(can("ROLE_BRANCH_CASHIER", "transfer")).toBe(false);
  });
});
