import { describe, expect, it } from "vitest";
import { auditLogEndpoint, resolveAuditLogScope } from "./audit-log-scope";

describe("audit-log scope", () => {
  it("uses the global endpoint only for the system administrator", () => {
    const scope = resolveAuditLogScope({ role: "ROLE_ADMIN" }, null);

    expect(scope).toEqual({ kind: "global" });
    expect(auditLogEndpoint(scope)).toBe("/api/audit-logs");
  });

  it("uses the authenticated store scope for store administrators and managers", () => {
    const storeAdminScope = resolveAuditLogScope({ role: "ROLE_STORE_ADMIN" }, 42);
    const storeManagerScope = resolveAuditLogScope({ role: "ROLE_STORE_MANAGER" }, 42);

    expect(storeAdminScope).toEqual({ kind: "store", storeId: 42 });
    expect(storeManagerScope).toEqual({ kind: "store", storeId: 42 });
    expect(auditLogEndpoint(storeAdminScope)).toBe("/api/audit-logs/store/42");
  });

  it("does not issue an audit-log request for users without a resolved store or role", () => {
    expect(resolveAuditLogScope({ role: "ROLE_STORE_ADMIN" }, null)).toEqual({ kind: "missing-store" });
    expect(resolveAuditLogScope({ role: "ROLE_BRANCH_MANAGER" }, 42)).toEqual({ kind: "forbidden" });
    expect(resolveAuditLogScope({ role: "ROLE_BRANCH_CASHIER" }, 42)).toEqual({ kind: "forbidden" });
    expect(auditLogEndpoint({ kind: "forbidden" })).toBeNull();
  });
});
