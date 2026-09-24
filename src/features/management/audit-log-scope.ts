import type { CurrentUser } from "@/types/api";

export type AuditLogScope =
  | { kind: "global" }
  | { kind: "store"; storeId: number }
  | { kind: "unresolved" }
  | { kind: "missing-store" }
  | { kind: "forbidden" };

type AuditLogProfile = Pick<CurrentUser, "role"> | undefined;

/**
 * Mirrors the backend audit-log authorization contract. The client only ever
 * derives a store id from the authenticated user's profile/store scope; it
 * never takes a store id from the route or a client-controlled selector.
 */
export function resolveAuditLogScope(profile: AuditLogProfile, storeId: number | null): AuditLogScope {
  if (!profile) return { kind: "unresolved" };
  if (profile.role === "ROLE_ADMIN") return { kind: "global" };

  if (profile.role === "ROLE_STORE_ADMIN" || profile.role === "ROLE_STORE_MANAGER") {
    return typeof storeId === "number" && Number.isSafeInteger(storeId) && storeId > 0
      ? { kind: "store", storeId }
      : { kind: "missing-store" };
  }

  return { kind: "forbidden" };
}

export function auditLogEndpoint(scope: AuditLogScope): string | null {
  if (scope.kind === "global") return "/api/audit-logs";
  if (scope.kind === "store") return `/api/audit-logs/store/${scope.storeId}`;
  return null;
}
