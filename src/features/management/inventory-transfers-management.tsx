"use client";
/* eslint-disable @next/next/no-img-element -- Catalog images may come from UploadThing or legacy hosts. */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { ClientPagination, useClientPagination } from "@/components/management/client-pagination";
import {
  DangerButton,
  EmptyState,
  ErrorState,
  LoadingState,
  ManagementPage,
  Panel,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
} from "@/components/management/ui";
import { AdminStoreSelector } from "./admin-store-selector";
import { managementKeys, useStoreScope } from "./use-store-scope";
import type { BranchRecord, InventoryTransferRecord, ProductRecord, TransferAvailabilityRecord } from "./types";

const statusLabel: Record<InventoryTransferRecord["status"], string> = {
  PENDING: "Chờ kho nguồn duyệt",
  APPROVED: "Đã duyệt và xuất kho",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
};

const statusClass: Record<InventoryTransferRecord["status"], string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-100 text-slate-700",
};

export function InventoryTransfersManagement() {
  const scope = useStoreScope();
  const queryClient = useQueryClient();
  const [destinationBranchId, setDestinationBranchId] = useState("");
  const [productId, setProductId] = useState("");
  const [source, setSource] = useState<TransferAvailabilityRecord | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");

  const branches = useQuery({
    queryKey: managementKeys.branches(scope.storeId ?? 0),
    queryFn: () => api<BranchRecord[]>(`/api/branches/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId),
  });
  const catalog = useQuery({
    queryKey: ["management", "global-catalog"],
    queryFn: () => api<ProductRecord[]>("/api/products/catalog"),
    enabled: Boolean(scope.storeId),
  });
  const effectiveDestinationId = scope.branchId
    ? String(scope.branchId)
    : branches.data?.some((branch) => String(branch.id) === destinationBranchId)
      ? destinationBranchId
      : branches.data?.[0]
        ? String(branches.data[0].id)
        : "";
  const availability = useQuery({
    queryKey: ["management", "transfer-availability", productId, effectiveDestinationId],
    queryFn: () =>
      api<TransferAvailabilityRecord[]>(
        `/api/inventory-transfers/availability?productId=${productId}&destinationBranchId=${effectiveDestinationId}`,
      ),
    enabled: Boolean(productId && effectiveDestinationId),
  });
  const requests = useQuery({
    queryKey: ["management", "inventory-transfers"],
    queryFn: () => api<InventoryTransferRecord[]>("/api/inventory-transfers"),
    enabled: Boolean(scope.storeId),
    refetchInterval: 15_000,
  });
  const visibleRequests = useMemo(() => requests.data ?? [], [requests.data]);
  const requestPagination = useClientPagination(visibleRequests, 10);

  const createRequest = useMutation({
    mutationFn: () => {
      const requestedQuantity = Number(quantity);
      if (!source || !productId || !effectiveDestinationId) throw new Error("Hãy chọn sản phẩm, kho nhận và kho nguồn");
      if (
        !Number.isInteger(requestedQuantity) ||
        requestedQuantity < 1 ||
        requestedQuantity > source.availableQuantity
      ) {
        throw new Error(`Số lượng phải từ 1 đến ${source.availableQuantity}`);
      }
      if (reason.trim().length < 3) throw new Error("Hãy nhập lý do điều chuyển ít nhất 3 ký tự");
      return api<InventoryTransferRecord>("/api/inventory-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: Number(productId),
          sourceBranchId: source.sourceBranchId,
          destinationBranchId: Number(effectiveDestinationId),
          quantity: requestedQuantity,
          reason: reason.trim(),
        }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["management", "inventory-transfers"] });
      void queryClient.invalidateQueries({ queryKey: ["management", "transfer-availability"] });
      toast.success("Đã gửi yêu cầu sang quản lý kho nguồn");
      setSource(null);
      setQuantity("1");
      setReason("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const review = useMutation({
    mutationFn: ({ id, action, note }: { id: number; action: "approve" | "reject" | "cancel"; note?: string }) =>
      api<InventoryTransferRecord>(`/api/inventory-transfers/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "cancel" ? undefined : JSON.stringify({ note: note || null }),
      }),
    onSuccess: (record) => {
      void queryClient.invalidateQueries({ queryKey: ["management", "inventory-transfers"] });
      void queryClient.invalidateQueries({ queryKey: ["management", "transfer-availability"] });
      void queryClient.invalidateQueries({ queryKey: ["management", "inventory"] });
      toast.success(
        record.status === "APPROVED"
          ? "Đã duyệt và cập nhật tồn kho hai bên"
          : record.status === "REJECTED"
            ? "Đã từ chối yêu cầu"
            : "Đã hủy yêu cầu",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function selectProduct(value: string) {
    setProductId(value);
    setSource(null);
    setQuantity("1");
  }

  if (scope.isLoading)
    return (
      <ManagementPage title="Điều chuyển kho" description="Yêu cầu và phê duyệt điều chuyển hàng giữa các cửa hàng.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage title="Điều chuyển kho" description="Yêu cầu và phê duyệt điều chuyển hàng giữa các cửa hàng.">
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );
  if (!scope.storeId)
    return (
      <ManagementPage title="Điều chuyển kho" description="Yêu cầu và phê duyệt điều chuyển hàng giữa các cửa hàng.">
        <EmptyState>Tài khoản chưa thuộc cửa hàng hợp lệ.</EmptyState>
      </ManagementPage>
    );

  return (
    <ManagementPage
      title="Điều chuyển kho"
      description="Cửa hàng chỉ thấy lượng hàng có thể chuyển; giá vốn, doanh số, nhân sự và khách hàng của kho khác luôn được ẩn."
    >
      <AdminStoreSelector scope={scope} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="Tồn kho hệ thống (hiển thị giới hạn)">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Kho nhận
              <select
                className={fieldClassName}
                value={effectiveDestinationId}
                disabled={Boolean(scope.branchId) || branches.isPending}
                onChange={(event) => {
                  setDestinationBranchId(event.target.value);
                  setSource(null);
                }}
              >
                <option value="">Chọn chi nhánh nhận</option>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Sản phẩm dùng chung
              <select
                className={fieldClassName}
                value={productId}
                disabled={catalog.isPending}
                onChange={(event) => selectProduct(event.target.value)}
              >
                <option value="">Chọn sản phẩm</option>
                {catalog.data?.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.sku}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Gợi ý được tính trên server sau khi giữ lại mức tồn tối thiểu tại kho nguồn.
          </p>
          <div className="mt-4">
            {!productId || !effectiveDestinationId ? (
              <EmptyState>Chọn kho nhận và sản phẩm để hệ thống tìm nguồn hàng phù hợp.</EmptyState>
            ) : availability.isPending ? (
              <LoadingState label="Đang quét các kho còn dư…" />
            ) : availability.isError ? (
              <ErrorState
                message={availability.error.message}
                retry={() => {
                  void availability.refetch();
                }}
              />
            ) : availability.data?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {availability.data.map((item) => (
                  <button
                    type="button"
                    key={item.sourceBranchId}
                    onClick={() => {
                      setSource(item);
                      setQuantity("1");
                    }}
                    className={
                      source?.sourceBranchId === item.sourceBranchId
                        ? "rounded-lg border-2 border-slate-900 bg-slate-50 p-4 text-left"
                        : "rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50"
                    }
                  >
                    <div className="flex items-center gap-3">
                      {item.image ? (
                        <img src={item.image} alt="" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <ArrowRightLeft className="h-8 w-8 text-slate-400" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.productName}</p>
                        <p className="text-xs text-slate-500">
                          {item.sourceStoreName} · {item.sourceBranchName}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm">
                      Số lượng có thể chuyển: <strong className="text-emerald-700">{item.availableQuantity}</strong>
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState>Không có kho khác còn lượng hàng vượt mức dự trữ tối thiểu.</EmptyState>
            )}
          </div>
        </Panel>

        <Panel title="Gửi yêu cầu điều chuyển">
          {!source ? (
            <EmptyState>Chọn một kho nguồn trong danh sách gợi ý.</EmptyState>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                createRequest.mutate();
              }}
            >
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-semibold">{source.productName}</p>
                <p className="mt-1 text-slate-600">
                  {source.sourceStoreName} / {source.sourceBranchName} →{" "}
                  {branches.data?.find((branch) => String(branch.id) === effectiveDestinationId)?.name}
                </p>
              </div>
              <label className="block text-sm font-medium">
                Số lượng
                <input
                  className={fieldClassName}
                  type="number"
                  min="1"
                  max={source.availableQuantity}
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </label>
              <label className="block text-sm font-medium">
                Lý do
                <textarea
                  className={fieldClassName}
                  rows={3}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ví dụ: kho nhận đã chạm mức tồn tối thiểu"
                />
              </label>
              <PrimaryButton type="submit" disabled={createRequest.isPending}>
                {createRequest.isPending ? "Đang gửi…" : "Gửi yêu cầu điều chuyển"}
              </PrimaryButton>
            </form>
          )}
        </Panel>
      </div>

      <Panel title="Hộp yêu cầu điều chuyển" className="mt-6">
        {requests.isPending ? (
          <LoadingState />
        ) : requests.isError ? (
          <ErrorState
            message={requests.error.message}
            retry={() => {
              void requests.refetch();
            }}
          />
        ) : visibleRequests.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Sản phẩm</th>
                    <th className="px-2 py-3">Tuyến điều chuyển</th>
                    <th className="px-2 py-3">Số lượng</th>
                    <th className="px-2 py-3">Trạng thái</th>
                    <th className="px-2 py-3">Người yêu cầu</th>
                    <th className="px-2 py-3">
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requestPagination.pageItems.map((record) => (
                    <tr key={record.id} className="border-b last:border-0">
                      <td className="px-2 py-3">
                        <p className="font-medium">{record.productName}</p>
                        <p className="text-xs text-slate-500">
                          {record.sku} · #{record.id}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <p>
                          {record.sourceStoreName} / {record.sourceBranchName}
                        </p>
                        <p className="text-xs text-slate-500">
                          → {record.destinationStoreName} / {record.destinationBranchName}
                        </p>
                      </td>
                      <td className="px-2 py-3 font-semibold">{record.quantity}</td>
                      <td className="px-2 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass[record.status]}`}
                        >
                          {statusLabel[record.status]}
                        </span>
                        {record.reviewNote ? (
                          <p className="mt-1 max-w-52 text-xs text-slate-500">{record.reviewNote}</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3">
                        <p>{record.requestedByName}</p>
                        <p className="text-xs text-slate-500">{new Date(record.createdAt).toLocaleString("vi-VN")}</p>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-2">
                          {record.canApprove ? (
                            <PrimaryButton
                              type="button"
                              disabled={review.isPending}
                              onClick={() => {
                                const note = window.prompt("Ghi chú phê duyệt (không bắt buộc)") ?? undefined;
                                review.mutate({ id: record.id, action: "approve", note });
                              }}
                            >
                              <Check className="h-4 w-4" />
                              <span className="sr-only">Phê duyệt</span>
                            </PrimaryButton>
                          ) : null}
                          {record.canReject ? (
                            <DangerButton
                              type="button"
                              disabled={review.isPending}
                              onClick={() => {
                                const note = window.prompt("Lý do từ chối") ?? undefined;
                                review.mutate({ id: record.id, action: "reject", note });
                              }}
                            >
                              <X className="h-4 w-4" />
                              <span className="sr-only">Từ chối</span>
                            </DangerButton>
                          ) : null}
                          {record.canCancel ? (
                            <SecondaryButton
                              type="button"
                              disabled={review.isPending}
                              onClick={() => {
                                if (window.confirm("Hủy yêu cầu điều chuyển này?"))
                                  review.mutate({ id: record.id, action: "cancel" });
                              }}
                            >
                              Hủy
                            </SecondaryButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ClientPagination {...requestPagination} label="yêu cầu" />
          </>
        ) : (
          <EmptyState>Chưa có yêu cầu điều chuyển trong phạm vi của tài khoản.</EmptyState>
        )}
      </Panel>
    </ManagementPage>
  );
}
