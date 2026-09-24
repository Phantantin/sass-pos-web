"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { CurrentUser } from "@/types/api";
import type { BranchRecord, StoreRecord, StoreScope } from "./types";

export const managementKeys = {
  profile: ["current-user"] as const,
  branch: (branchId: number) => ["management", "branch", branchId] as const,
  branches: (storeId: number) => ["management", "branches", storeId] as const,
  employees: (scope: "store" | "branch", id: number) => ["management", "employees", scope, id] as const,
  store: (storeId: number) => ["management", "store", storeId] as const,
  stores: ["management", "stores"] as const,
  managedStores: (userId: number) => ["management", "managed-stores", userId] as const,
  categories: (storeId: number) => ["management", "categories", storeId] as const,
  products: (storeId: number) => ["management", "products", storeId] as const,
  inventory: (branchId: number) => ["management", "inventory", branchId] as const,
  customers: (storeId: number, query: string) => ["management", "customers", storeId, query] as const,
};

export function useStoreScope(): StoreScope {
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = Number(window.localStorage.getItem("sass_pos_selected_store"));
    return Number.isInteger(saved) && saved > 0 ? saved : null;
  });
  const profile = useQuery({
    queryKey: managementKeys.profile,
    queryFn: () => api<CurrentUser>("/api/users/profile"),
  });
  const branch = useQuery({
    queryKey: managementKeys.branch(profile.data?.branchId ?? 0),
    queryFn: () => api<BranchRecord>(`/api/branches/${profile.data!.branchId}`),
    enabled: Boolean(profile.data?.branchId && !profile.data.storeId),
  });
  const selectableStores = useQuery({
    queryKey:
      profile.data?.role === "ROLE_ADMIN" ? managementKeys.stores : managementKeys.managedStores(profile.data?.id ?? 0),
    queryFn: () => api<StoreRecord[]>(profile.data?.role === "ROLE_ADMIN" ? "/api/stores" : "/api/stores/managed"),
    enabled: profile.data?.role === "ROLE_ADMIN" || profile.data?.role === "ROLE_STORE_ADMIN",
  });
  const preferredStoreId = selectedStoreId ?? profile.data?.storeId ?? null;
  const effectiveSelectableStoreId =
    preferredStoreId && selectableStores.data?.some((store) => store.id === preferredStoreId)
      ? preferredStoreId
      : (selectableStores.data?.[0]?.id ?? null);

  const scopedStoreId =
    profile.data?.role === "ROLE_ADMIN" || profile.data?.role === "ROLE_STORE_ADMIN"
      ? effectiveSelectableStoreId
      : (profile.data?.storeId ?? branch.data?.storeId ?? null);

  function selectStore(storeId: number) {
    setSelectedStoreId(storeId);
    if (typeof window !== "undefined") window.localStorage.setItem("sass_pos_selected_store", String(storeId));
  }

  return {
    profile: profile.data,
    storeId: scopedStoreId,
    branchId: profile.data?.branchId ?? null,
    adminStores: selectableStores.data,
    selectAdminStore: selectStore,
    isLoading:
      profile.isPending ||
      Boolean(profile.data?.branchId && !profile.data.storeId && branch.isPending) ||
      Boolean(
        (profile.data?.role === "ROLE_ADMIN" || profile.data?.role === "ROLE_STORE_ADMIN") &&
        selectableStores.isPending,
      ),
    error: (profile.error ?? branch.error ?? selectableStores.error ?? null) as Error | null,
  };
}

export function canManageStore(profile: CurrentUser | undefined) {
  return ["ROLE_ADMIN", "ROLE_STORE_ADMIN"].includes(profile?.role ?? "");
}

export function canManageProducts(profile: CurrentUser | undefined) {
  return ["ROLE_ADMIN", "ROLE_STORE_ADMIN", "ROLE_STORE_MANAGER"].includes(profile?.role ?? "");
}

export function canCreateStore(profile: CurrentUser | undefined) {
  return profile?.role === "ROLE_STORE_ADMIN";
}

export function canUpdateStore(profile: CurrentUser | undefined) {
  return profile?.role === "ROLE_ADMIN" || profile?.role === "ROLE_STORE_ADMIN";
}

export function canManageBranch(profile: CurrentUser | undefined) {
  return ["ROLE_ADMIN", "ROLE_STORE_ADMIN", "ROLE_STORE_MANAGER", "ROLE_BRANCH_MANAGER"].includes(profile?.role ?? "");
}

export function canEditBranch(profile: CurrentUser | undefined) {
  return ["ROLE_ADMIN", "ROLE_STORE_ADMIN", "ROLE_BRANCH_MANAGER"].includes(profile?.role ?? "");
}
