export type UserRole =
  "ROLE_ADMIN" | "ROLE_STORE_ADMIN" | "ROLE_STORE_MANAGER" | "ROLE_BRANCH_MANAGER" | "ROLE_BRANCH_CASHIER";

const roleHomePath: Record<UserRole, string> = {
  ROLE_ADMIN: "/dashboard",
  ROLE_STORE_ADMIN: "/dashboard",
  ROLE_STORE_MANAGER: "/dashboard",
  ROLE_BRANCH_MANAGER: "/dashboard",
  ROLE_BRANCH_CASHIER: "/pos",
};

const roleTitles: Record<UserRole, { vi: string; en: string }> = {
  ROLE_ADMIN: { vi: "Quản trị hệ thống (HQ)", en: "System Administrator (HQ)" },
  ROLE_STORE_ADMIN: { vi: "Quản trị cửa hàng", en: "Store Administrator" },
  ROLE_STORE_MANAGER: { vi: "Quản lý cửa hàng", en: "Store Manager" },
  ROLE_BRANCH_MANAGER: { vi: "Quản lý chi nhánh", en: "Branch Manager" },
  ROLE_BRANCH_CASHIER: { vi: "Thu ngân", en: "Cashier" },
};

export function roleHome(role: UserRole, locale: "vi" | "en") {
  return `/${locale}${roleHomePath[role]}`;
}

export function roleTitle(role: UserRole, locale: "vi" | "en") {
  return roleTitles[role][locale];
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && Object.hasOwn(roleHomePath, value);
}

export const permissions: Record<UserRole, readonly string[]> = {
  // System admin manages every tenant-facing resource, but never acts as a branch cashier.
  ROLE_ADMIN: [
    "store",
    "branch",
    "employee",
    "workforce",
    "category",
    "product",
    "inventory",
    "transfer",
    "customer",
    "report",
    "order",
    "refund",
    "shift",
    "subscription",
    "audit",
  ],
  // Store owner administers its tenant and its billing; transactional pages are read-only reports.
  ROLE_STORE_ADMIN: [
    "store",
    "branch",
    "employee",
    "workforce",
    "category",
    "product",
    "inventory",
    "transfer",
    "customer",
    "report",
    "order",
    "refund",
    "shift",
    "subscription",
    "audit",
  ],
  // Store manager runs merchandise and store operations, but cannot administer stores, branches or people.
  ROLE_STORE_MANAGER: ["branch", "employee", "workforce", "product", "inventory", "transfer", "report", "order"],
  // Branch manager is limited to their assigned branch and its cashiers.
  ROLE_BRANCH_MANAGER: ["branch", "employee", "workforce", "inventory", "transfer", "order", "shift", "report"],
  // Cashier operates POS. Inventory and product reads happen inside POS, not through management pages.
  ROLE_BRANCH_CASHIER: ["pos", "customer", "workforce", "order", "refund", "shift"],
};

export function can(role: UserRole, permission: string) {
  return permissions[role].includes("*") || permissions[role].includes(permission);
}
