"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "@/lib/api/client";
import { ClientPagination, useClientPagination } from "@/components/management/client-pagination";
import {
  DangerButton,
  EmptyState,
  ErrorState,
  FieldError,
  LoadingState,
  ManagementPage,
  Panel,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
} from "@/components/management/ui";
import { canManageBranch, managementKeys, useStoreScope } from "./use-store-scope";
import type { BranchRecord, InventoryMovementRecord, InventoryRecord, ProductRecord } from "./types";

const inventorySchema = z.object({
  productId: z.string().min(1, "Hãy chọn sản phẩm"),
  quantity: z
    .string()
    .trim()
    .refine((value) => /^\d+$/.test(value), "Số lượng phải là số nguyên không âm"),
  minStockLevel: z
    .string()
    .trim()
    .refine((value) => /^\d+$/.test(value), "Ngưỡng nhập hàng phải là số nguyên không âm"),
  reason: z.string().trim().min(3, "Cần nêu lý do có ít nhất 3 ký tự").max(500),
});
type InventoryFormValues = z.infer<typeof inventorySchema>;
const defaults: InventoryFormValues = { productId: "", quantity: "0", minStockLevel: "5", reason: "" };

const movementLabel: Record<InventoryMovementRecord["type"], string> = {
  INITIAL_STOCK: "Tạo tồn kho",
  ADJUSTMENT: "Điều chỉnh thủ công",
  SALE: "Bán hàng",
  REFUND: "Hoàn tiền",
  REMOVAL: "Xóa bản ghi",
  TRANSFER_OUT: "Xuất kho điều chuyển",
  TRANSFER_IN: "Nhập kho điều chuyển",
};

export function InventoryManagement() {
  const scope = useStoreScope();
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [editing, setEditing] = useState<InventoryRecord | null>(null);
  const form = useForm<InventoryFormValues>({ resolver: zodResolver(inventorySchema), defaultValues: defaults });
  const branches = useQuery({
    queryKey: managementKeys.branches(scope.storeId ?? 0),
    queryFn: () => api<BranchRecord[]>(`/api/branches/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId),
  });
  const products = useQuery({
    queryKey: ["management", "inventory-catalog", scope.storeId ?? 0],
    queryFn: () => api<ProductRecord[]>(`/api/products/inventory-catalog/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId),
  });
  const effectiveBranchId = scope.branchId
    ? String(scope.branchId)
    : selectedBranchId || (branches.data?.[0] ? String(branches.data[0].id) : "");
  const inventory = useQuery({
    queryKey: managementKeys.inventory(Number(effectiveBranchId || 0)),
    queryFn: () => api<InventoryRecord[]>(`/api/inventories/branch/${effectiveBranchId}`),
    enabled: Boolean(effectiveBranchId),
  });
  const movements = useQuery({
    queryKey: ["management", "inventory-movements", effectiveBranchId],
    queryFn: () => api<InventoryMovementRecord[]>(`/api/inventories/branch/${effectiveBranchId}/movements`),
    enabled: Boolean(effectiveBranchId),
  });
  const filteredInventory = useMemo(() => {
    const keyword = inventorySearch.trim().toLocaleLowerCase("vi-VN");
    if (!keyword) return inventory.data ?? [];
    return (inventory.data ?? []).filter((record) =>
      `${record.product.name} ${record.product.sku}`.toLocaleLowerCase("vi-VN").includes(keyword),
    );
  }, [inventory.data, inventorySearch]);
  const inventoryPagination = useClientPagination(filteredInventory, 12);
  const movementPagination = useClientPagination(movements.data ?? [], 15);
  const canEditInventory = canManageBranch(scope.profile);
  const stockedProductIds = useMemo(() => new Set(inventory.data?.map((item) => item.productId)), [inventory.data]);
  const save = useMutation({
    mutationFn: (values: InventoryFormValues) =>
      api<InventoryRecord>(editing ? `/api/inventories/${editing.id}` : "/api/inventories", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing
            ? { quantity: Number(values.quantity), minStockLevel: Number(values.minStockLevel), reason: values.reason }
            : {
                branchId: Number(effectiveBranchId),
                productId: Number(values.productId),
                quantity: Number(values.quantity),
                minStockLevel: Number(values.minStockLevel),
                reason: values.reason,
              },
        ),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.inventory(Number(effectiveBranchId)) });
      void queryClient.invalidateQueries({ queryKey: ["management", "inventory-movements", effectiveBranchId] });
      toast.success(editing ? "Đã cập nhật tồn kho" : "Đã thêm bản ghi tồn kho");
      setEditing(null);
      form.reset(defaults);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api<void>(`/api/inventories/${id}?reason=${encodeURIComponent(reason)}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.inventory(Number(effectiveBranchId)) });
      void queryClient.invalidateQueries({ queryKey: ["management", "inventory-movements", effectiveBranchId] });
      toast.success("Đã xóa bản ghi tồn kho");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  function startEdit(record: InventoryRecord) {
    setEditing(record);
    form.reset({
      productId: String(record.productId),
      quantity: String(record.quantity),
      minStockLevel: String(record.minStockLevel ?? 5),
      reason: "",
    });
  }
  function cancelEdit() {
    setEditing(null);
    form.reset(defaults);
  }
  const availableProducts = editing
    ? (products.data ?? [])
    : (products.data ?? []).filter((product) => !stockedProductIds.has(product.id));

  if (scope.isLoading)
    return (
      <ManagementPage title="Tồn kho" description="Theo dõi số lượng hàng theo từng chi nhánh.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage title="Tồn kho" description="Theo dõi số lượng hàng theo từng chi nhánh.">
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );
  if (!scope.storeId)
    return (
      <ManagementPage title="Tồn kho" description="Theo dõi số lượng hàng theo từng chi nhánh.">
        <EmptyState>Hãy tạo hoặc được gán vào cửa hàng trước khi quản lý tồn kho.</EmptyState>
      </ManagementPage>
    );
  return (
    <ManagementPage
      title="Tồn kho"
      description="Số lượng được xác thực ở máy chủ; đơn hàng hoàn tất sẽ tự động trừ tồn kho."
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="min-w-64 text-sm font-medium">
          Chi nhánh
          <select
            value={effectiveBranchId}
            onChange={(event) => {
              setSelectedBranchId(event.target.value);
              setEditing(null);
              form.reset(defaults);
            }}
            className={fieldClassName}
            disabled={Boolean(scope.branchId) || branches.isPending}
          >
            <option value="">Chọn chi nhánh</option>
            {branches.data?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {branches.isError ? (
        <ErrorState message={branches.error.message} />
      ) : products.isError ? (
        <ErrorState message={products.error.message} />
      ) : !effectiveBranchId ? (
        <EmptyState>Hãy tạo chi nhánh trước khi quản lý tồn kho.</EmptyState>
      ) : (
        <div className={canEditInventory ? "grid gap-6 2xl:grid-cols-[minmax(0,1fr)_390px]" : "grid gap-6"}>
          <Panel title="Hàng hóa tại chi nhánh">
            {inventory.data?.length ? (
              <label className="mb-4 block text-sm font-medium">
                Tìm sản phẩm
                <input
                  value={inventorySearch}
                  onChange={(event) => setInventorySearch(event.target.value)}
                  className={fieldClassName}
                  placeholder="Tên hoặc SKU"
                  type="search"
                />
              </label>
            ) : null}
            {inventory.isPending ? (
              <LoadingState />
            ) : inventory.isError ? (
              <ErrorState
                message={inventory.error.message}
                retry={() => {
                  void inventory.refetch();
                }}
              />
            ) : !inventory.data?.length ? (
              <EmptyState>Chi nhánh này chưa có hàng hóa trong kho.</EmptyState>
            ) : !filteredInventory.length ? (
              <EmptyState>Không tìm thấy sản phẩm khớp với từ khóa.</EmptyState>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-3">Sản phẩm</th>
                        <th className="px-2 py-3">SKU</th>
                        <th className="px-2 py-3">Tồn kho</th>
                        <th className="px-2 py-3">Ngưỡng nhập</th>
                        {canEditInventory ? (
                          <th className="px-2 py-3">
                            <span className="sr-only">Thao tác</span>
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryPagination.pageItems.map((record) => {
                        const lowStock = record.quantity <= (record.minStockLevel ?? 5);
                        return (
                          <tr
                            key={record.id}
                            className={lowStock ? "border-b bg-amber-50 last:border-0" : "border-b last:border-0"}
                          >
                            <td className="px-2 py-3 font-medium">
                              {record.product.name}
                              {lowStock ? (
                                <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">
                                  Cần nhập hàng
                                </span>
                              ) : null}
                            </td>
                            <td className="px-2 py-3 text-slate-600">{record.product.sku}</td>
                            <td className="px-2 py-3">
                              <span
                                className={lowStock ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}
                              >
                                {record.quantity}
                              </span>
                            </td>
                            <td className="px-2 py-3">{record.minStockLevel ?? 5}</td>
                            {canEditInventory ? (
                              <td className="px-2 py-3">
                                <div className="flex justify-end gap-2">
                                  <SecondaryButton
                                    type="button"
                                    aria-label={`Sửa tồn kho ${record.product.name}`}
                                    onClick={() => startEdit(record)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </SecondaryButton>
                                  <DangerButton
                                    type="button"
                                    aria-label={`Xóa tồn kho ${record.product.name}`}
                                    disabled={remove.isPending}
                                    onClick={() => {
                                      const reason = window.prompt(
                                        `Lý do xóa tồn kho “${record.product.name}” (chỉ xóa khi số lượng bằng 0):`,
                                      );
                                      if (reason?.trim()) remove.mutate({ id: record.id, reason: reason.trim() });
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </DangerButton>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ClientPagination {...inventoryPagination} label="bản ghi tồn kho" />
              </>
            )}
          </Panel>
          {canEditInventory ? (
            <Panel title={editing ? `Sửa tồn kho: ${editing.product.name}` : "Thêm tồn kho"}>
              {products.isPending ? (
                <LoadingState label="Đang tải sản phẩm…" />
              ) : !availableProducts.length && !editing ? (
                <EmptyState>Tất cả sản phẩm đã có bản ghi tồn kho tại chi nhánh này.</EmptyState>
              ) : (
                <form className="space-y-3" noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))}>
                  <label className="block">
                    Sản phẩm
                    <select {...form.register("productId")} className={fieldClassName} disabled={Boolean(editing)}>
                      <option value="">Chọn sản phẩm</option>
                      {availableProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · {product.sku}
                        </option>
                      ))}
                    </select>
                    <FieldError>{form.formState.errors.productId?.message}</FieldError>
                  </label>
                  <label className="block">
                    Số lượng hiện có
                    <input
                      {...form.register("quantity")}
                      className={fieldClassName}
                      inputMode="numeric"
                      min="0"
                      type="number"
                    />
                    <FieldError>{form.formState.errors.quantity?.message}</FieldError>
                  </label>
                  <label className="block">
                    Cảnh báo nhập hàng khi tồn kho ≤
                    <input
                      {...form.register("minStockLevel")}
                      className={fieldClassName}
                      inputMode="numeric"
                      min="0"
                      type="number"
                    />
                    <FieldError>{form.formState.errors.minStockLevel?.message}</FieldError>
                  </label>
                  <label className="block">
                    Lý do {editing ? "điều chỉnh" : "nhập tồn ban đầu"}
                    <textarea
                      {...form.register("reason")}
                      className={fieldClassName}
                      rows={2}
                      placeholder={editing ? "Ví dụ: Kiểm kê cuối ngày" : "Ví dụ: Nhập hàng đợt đầu"}
                    />
                    <FieldError>{form.formState.errors.reason?.message}</FieldError>
                  </label>
                  <div className="flex gap-2">
                    <PrimaryButton type="submit" disabled={save.isPending}>
                      {save.isPending ? "Đang lưu…" : editing ? "Lưu số lượng" : "Thêm vào kho"}
                    </PrimaryButton>
                    {editing ? (
                      <SecondaryButton type="button" onClick={cancelEdit}>
                        <X className="mr-1 inline h-4 w-4" />
                        Hủy
                      </SecondaryButton>
                    ) : null}
                  </div>
                </form>
              )}
            </Panel>
          ) : null}
        </div>
      )}
      {effectiveBranchId && (
        <Panel title="Lịch sử biến động tồn kho" className="mt-6">
          {movements.isPending ? (
            <LoadingState />
          ) : movements.isError ? (
            <ErrorState
              message={movements.error.message}
              retry={() => {
                void movements.refetch();
              }}
            />
          ) : movements.data?.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-3">Thời gian</th>
                      <th className="px-2 py-3">Sản phẩm</th>
                      <th className="px-2 py-3">Biến động</th>
                      <th className="px-2 py-3">Lý do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementPagination.pageItems.map((movement) => (
                      <tr key={movement.id} className="border-b last:border-0">
                        <td className="px-2 py-3 whitespace-nowrap">
                          {new Date(movement.createdAt).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-2 py-3">{movement.product?.name ?? `#${movement.productId}`}</td>
                        <td className="px-2 py-3">
                          <p
                            className={
                              movement.quantityDelta < 0
                                ? "font-semibold text-rose-700"
                                : "font-semibold text-emerald-700"
                            }
                          >
                            {movement.quantityDelta > 0 ? "+" : ""}
                            {movement.quantityDelta} · {movementLabel[movement.type]}
                          </p>
                          <p className="text-xs text-slate-500">
                            {movement.quantityBefore} → {movement.quantityAfter}
                          </p>
                        </td>
                        <td className="px-2 py-3">{movement.reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ClientPagination {...movementPagination} label="biến động tồn kho" />
            </>
          ) : (
            <EmptyState>Chưa có biến động tồn kho.</EmptyState>
          )}
        </Panel>
      )}
    </ManagementPage>
  );
}
