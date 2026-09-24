"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { ClientPagination, useClientPagination } from "@/components/management/client-pagination";
import {
  EmptyState,
  ErrorState,
  FieldError,
  LoadingState,
  ManagementPage,
  Panel,
  PrimaryButton,
  fieldClassName,
} from "@/components/management/ui";
import { managementKeys, useStoreScope } from "./use-store-scope";
import type { BranchRecord, OrderRecord, RefundRecord } from "./types";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export function RefundsManagement() {
  const scope = useStoreScope();
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const branches = useQuery({
    queryKey: managementKeys.branches(scope.storeId ?? 0),
    queryFn: () => api<BranchRecord[]>(`/api/branches/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId),
  });
  const effectiveBranchId = scope.branchId
    ? String(scope.branchId)
    : selectedBranchId || (branches.data?.[0] ? String(branches.data[0].id) : "");
  const orders = useQuery({
    queryKey: ["management", "orders", effectiveBranchId],
    queryFn: () => api<OrderRecord[]>(`/api/orders/branch/${effectiveBranchId}`),
    enabled: Boolean(effectiveBranchId),
  });
  const refunds = useQuery({
    queryKey: ["management", "refunds", effectiveBranchId],
    queryFn: () => api<RefundRecord[]>(`/api/refunds/branch/${effectiveBranchId}`),
    enabled: Boolean(effectiveBranchId),
  });
  const refundPagination = useClientPagination(refunds.data ?? [], 15);
  const create = useMutation({
    mutationFn: () =>
      api<RefundRecord>("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: Number(orderId), reason: reason.trim() }),
      }),
    onSuccess: () => {
      toast.success("Đã tạo giao dịch hoàn tiền và cộng trả tồn kho.");
      setOrderId("");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["management", "refunds", effectiveBranchId] });
      void queryClient.invalidateQueries({ queryKey: ["management", "orders", effectiveBranchId] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["current-shift"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const refundableOrders = (orders.data ?? []).filter((order) => order.status !== "REFUNDED");

  if (scope.isLoading)
    return (
      <ManagementPage title="Hoàn tiền" description="Hoàn tiền được ghi nhận theo ca và hoàn trả tồn kho tự động.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage title="Hoàn tiền" description="Hoàn tiền được ghi nhận theo ca và hoàn trả tồn kho tự động.">
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );
  if (!scope.storeId)
    return (
      <ManagementPage title="Hoàn tiền" description="Hoàn tiền được ghi nhận theo ca và hoàn trả tồn kho tự động.">
        <EmptyState>Tài khoản chưa thuộc cửa hàng hợp lệ.</EmptyState>
      </ManagementPage>
    );

  return (
    <ManagementPage
      title="Hoàn tiền"
      description="Tạo hoàn tiền toàn bộ phần hàng còn đủ điều kiện của một đơn. Tài khoản phải có ca đang mở tại đúng chi nhánh."
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="min-w-64 text-sm font-medium">
          Chi nhánh
          <select
            value={effectiveBranchId}
            onChange={(event) => {
              setSelectedBranchId(event.target.value);
              setOrderId("");
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <Panel title="Lịch sử hoàn tiền">
          {!effectiveBranchId ? (
            <EmptyState>Chọn chi nhánh để xem hoàn tiền.</EmptyState>
          ) : refunds.isPending ? (
            <LoadingState />
          ) : refunds.isError ? (
            <ErrorState
              message={refunds.error.message}
              retry={() => {
                void refunds.refetch();
              }}
            />
          ) : refunds.data?.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-3">Giao dịch</th>
                      <th className="px-2 py-3">Lý do</th>
                      <th className="px-2 py-3">Thu ngân</th>
                      <th className="px-2 py-3 text-right">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refundPagination.pageItems.map((refund) => (
                      <tr key={refund.id} className="border-b last:border-0">
                        <td className="px-2 py-3">
                          <p className="font-medium">
                            #{refund.id} · Đơn #{refund.orderId ?? "—"}
                          </p>
                          <p className="text-xs text-slate-500">{new Date(refund.createdAt).toLocaleString("vi-VN")}</p>
                        </td>
                        <td className="px-2 py-3">{refund.reason}</td>
                        <td className="px-2 py-3">{refund.cashierName ?? "—"}</td>
                        <td className="px-2 py-3 text-right font-medium">{money.format(refund.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ClientPagination {...refundPagination} label="giao dịch hoàn tiền" />
            </>
          ) : (
            <div className="grid place-items-center gap-2 py-10 text-center text-sm text-slate-500">
              <RotateCcw size={22} />
              Chưa có giao dịch hoàn tiền.
            </div>
          )}
        </Panel>
        <Panel title="Tạo hoàn tiền">
          {orders.isPending ? (
            <LoadingState label="Đang tải đơn hàng…" />
          ) : orders.isError ? (
            <ErrorState message={orders.error.message} />
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!orderId) {
                  toast.error("Hãy chọn đơn hàng");
                  return;
                }
                if (reason.trim().length < 3) {
                  toast.error("Cần nêu lý do hoàn tiền");
                  return;
                }
                create.mutate();
              }}
            >
              <label className="block">
                Đơn hàng
                <select value={orderId} onChange={(event) => setOrderId(event.target.value)} className={fieldClassName}>
                  <option value="">Chọn đơn hàng</option>
                  {refundableOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      #{order.id} · {money.format(order.totalAmount)} · {order.customer?.fullName ?? "Khách lẻ"}
                    </option>
                  ))}
                </select>
              </label>
              {!refundableOrders.length && (
                <FieldError>Không có đơn hàng còn đủ điều kiện hoàn tiền tại chi nhánh này.</FieldError>
              )}
              <label className="block">
                Lý do hoàn tiền
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className={fieldClassName}
                  rows={3}
                  placeholder="Ví dụ: Khách đổi trả hàng"
                />
              </label>
              <PrimaryButton type="submit" disabled={create.isPending || !refundableOrders.length}>
                {create.isPending ? "Đang hoàn tiền…" : "Hoàn tiền toàn bộ phần còn lại"}
              </PrimaryButton>
            </form>
          )}
        </Panel>
      </div>
    </ManagementPage>
  );
}
