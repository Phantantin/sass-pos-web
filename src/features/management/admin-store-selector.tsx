"use client";

import { fieldClassName } from "@/components/management/ui";
import type { StoreScope } from "./types";

/** Selects the store scope available to HQ or a multi-store owner. */
export function AdminStoreSelector({ scope }: { scope: StoreScope }) {
  if (scope.profile?.role !== "ROLE_ADMIN" && scope.profile?.role !== "ROLE_STORE_ADMIN") return null;
  if (!scope.adminStores?.length || !scope.storeId || !scope.selectAdminStore) {
    return (
      <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Chưa có cửa hàng nào để quản trị.
      </p>
    );
  }
  return (
    <label className="mb-4 block max-w-md text-sm font-medium">
      Cửa hàng đang quản trị
      <select
        aria-label="Cửa hàng đang quản trị"
        className={`${fieldClassName} mt-1`}
        value={scope.storeId}
        onChange={(event) => scope.selectAdminStore?.(Number(event.target.value))}
      >
        {scope.adminStores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.brand} · #{store.id}
          </option>
        ))}
      </select>
    </label>
  );
}
