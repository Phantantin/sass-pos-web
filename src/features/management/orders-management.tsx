"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Printer, ReceiptText, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { ClientPagination, useClientPagination } from "@/components/management/client-pagination";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ManagementPage,
  Panel,
  SecondaryButton,
  fieldClassName,
} from "@/components/management/ui";
import { managementKeys, useStoreScope } from "./use-store-scope";
import { AdminStoreSelector } from "./admin-store-selector";
import type { BranchRecord, OrderRecord } from "./types";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

const statusLabels: Record<OrderRecord["status"], string> = {
  PENDING: "Chờ xử lý",
  COMPLETED: "Hoàn tất",
  PARTIALLY_REFUNDED: "Hoàn một phần",
  REFUNDED: "Đã hoàn tiền",
};
const paymentLabels: Record<OrderRecord["paymentType"], string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  UPI: "Chuyển khoản",
};

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function exportOrders(orders: OrderRecord[]) {
  const rows = [
    ["Mã đơn", "Thời gian", "Khách hàng", "Thu ngân", "Thanh toán", "Trạng thái", "Tổng tiền"],
    ...orders.map((order) => [
      order.id,
      order.createdAt,
      order.customer?.fullName ?? "Khách lẻ",
      order.cashier?.fullName ?? "",
      paymentLabels[order.paymentType],
      statusLabels[order.status],
      order.totalAmount,
    ]),
  ];
  const blob = new Blob([`\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `hoa-don-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function OrdersManagement() {
  const scope = useStoreScope();
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const branches = useQuery({
    queryKey: managementKeys.branches(scope.storeId ?? 0),
    queryFn: () => api<BranchRecord[]>(`/api/branches/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId),
  });
  const selectedBranchInScope = branches.data?.some((branch) => String(branch.id) === selectedBranchId)
    ? selectedBranchId
    : "";
  const effectiveBranchId = scope.branchId ? String(scope.branchId) : selectedBranchInScope || "all";
  const orders = useQuery({
    queryKey: ["management", "orders", scope.storeId, effectiveBranchId],
    queryFn: async () => {
      if (effectiveBranchId !== "all") return api<OrderRecord[]>(`/api/orders/branch/${effectiveBranchId}`);
      const branchIds = (branches.data ?? []).map((branch) => branch.id);
      const groups = await Promise.all(branchIds.map((id) => api<OrderRecord[]>(`/api/orders/branch/${id}`)));
      return groups.flat();
    },
    enabled: Boolean(effectiveBranchId !== "all" || (scope.storeId && !branches.isPending)),
  });
  const sortedOrders = useMemo(
    () =>
      [...(orders.data ?? [])].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [orders.data],
  );
  const orderPagination = useClientPagination(sortedOrders, 10);

  if (scope.isLoading)
    return (
      <ManagementPage title="Đơn hàng" description="Tra cứu giao dịch bán hàng theo chi nhánh.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage title="Đơn hàng" description="Tra cứu giao dịch bán hàng theo chi nhánh.">
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );
  if (!scope.storeId)
    return (
      <ManagementPage title="Đơn hàng" description="Tra cứu giao dịch bán hàng theo chi nhánh.">
        <EmptyState>Tài khoản chưa thuộc cửa hàng hợp lệ.</EmptyState>
      </ManagementPage>
    );

  return (
    <>
      <div className="print:hidden">
        <ManagementPage
          title="Hóa đơn đã thanh toán"
          description="Mọi vai trò có quyền được tra cứu, mở lại và xuất hóa đơn trong đúng phạm vi được phân công."
        >
          <AdminStoreSelector scope={scope} />
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <label className="min-w-64 text-sm font-medium">
              Chi nhánh
              <select
                value={effectiveBranchId}
                onChange={(event) => setSelectedBranchId(event.target.value === "all" ? "" : event.target.value)}
                className={fieldClassName}
                disabled={Boolean(scope.branchId) || branches.isPending}
              >
                <option value="all">Tất cả chi nhánh</option>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            {sortedOrders.length ? (
              <SecondaryButton type="button" onClick={() => exportOrders(sortedOrders)}>
                <Download className="mr-2 inline h-4 w-4" />
                Xuất CSV
              </SecondaryButton>
            ) : null}
          </div>
          <Panel title="Giao dịch mới nhất">
            {branches.isError ? (
              <ErrorState message={branches.error.message} />
            ) : orders.isPending ? (
              <LoadingState />
            ) : orders.isError ? (
              <ErrorState
                message={orders.error.message}
                retry={() => {
                  void orders.refetch();
                }}
              />
            ) : sortedOrders.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-3">Đơn hàng</th>
                        {effectiveBranchId === "all" ? <th className="px-2 py-3">Chi nhánh</th> : null}
                        <th className="px-2 py-3">Khách hàng</th>
                        <th className="px-2 py-3">Thu ngân</th>
                        <th className="px-2 py-3">Thanh toán</th>
                        <th className="px-2 py-3">Trạng thái</th>
                        <th className="px-2 py-3 text-right">Tổng</th>
                        <th className="px-2 py-3">
                          <span className="sr-only">Chi tiết</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderPagination.pageItems.map((order) => (
                        <tr key={order.id} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="px-2 py-3">
                            <p className="font-medium">#{order.id}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(order.createdAt).toLocaleString("vi-VN")}
                            </p>
                          </td>
                          {effectiveBranchId === "all" ? (
                            <td className="px-2 py-3">
                              {branches.data?.find((branch) => branch.id === order.branchId)?.name ?? "—"}
                            </td>
                          ) : null}
                          <td className="px-2 py-3">{order.customer?.fullName ?? "Khách lẻ"}</td>
                          <td className="px-2 py-3">{order.cashier?.fullName ?? "—"}</td>
                          <td className="px-2 py-3">{paymentLabels[order.paymentType]}</td>
                          <td className="px-2 py-3">
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              {statusLabels[order.status] ?? order.status}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-right font-medium">{money.format(order.totalAmount)}</td>
                          <td className="px-2 py-3 text-right">
                            <SecondaryButton
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              aria-label={`Xem hóa đơn ${order.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </SecondaryButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ClientPagination {...orderPagination} label="đơn hàng" />
              </>
            ) : (
              <div className="grid place-items-center gap-2 py-10 text-center text-sm text-slate-500">
                <ReceiptText size={22} />
                Chưa có đơn hàng trong phạm vi đã chọn.
              </div>
            )}
          </Panel>
        </ManagementPage>
      </div>
      {selectedOrder ? <Invoice order={selectedOrder} close={() => setSelectedOrder(null)} /> : null}
    </>
  );
}

function Invoice({ order, close }: { order: OrderRecord; close: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4 print:static print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-label={`Hóa đơn ${order.id}`}
    >
      <article className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-2xl print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">SaaS POS</p>
            <h2 className="mt-1 text-2xl font-bold">Hóa đơn #{order.id}</h2>
            <p className="text-sm text-slate-500">{new Date(order.createdAt).toLocaleString("vi-VN")}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 hover:bg-slate-100 print:hidden"
            aria-label="Đóng"
          >
            <X />
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-b py-4 text-sm">
          <div>
            <dt className="text-slate-500">Khách hàng</dt>
            <dd className="font-medium">{order.customer?.fullName ?? "Khách lẻ"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Thu ngân</dt>
            <dd className="font-medium">{order.cashier?.fullName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Thanh toán</dt>
            <dd className="font-medium">{paymentLabels[order.paymentType]}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Trạng thái</dt>
            <dd className="font-medium">{statusLabels[order.status]}</dd>
          </div>
        </dl>
        <div className="py-4">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Sản phẩm</th>
                <th className="py-2 text-right">SL</th>
                <th className="py-2 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-3">
                    <p className="font-medium">{item.product?.name ?? `Sản phẩm #${item.id}`}</p>
                    <p className="text-xs text-slate-500">{item.product?.sku}</p>
                  </td>
                  <td className="py-3 text-right">{item.quantity}</td>
                  <td className="py-3 text-right">{money.format(item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!order.items?.length ? (
            <p className="py-6 text-center text-sm text-slate-500">Hóa đơn cũ chưa có chi tiết mặt hàng.</p>
          ) : null}
        </div>
        <div className="flex justify-between border-t pt-4 text-xl font-bold">
          <span>Tổng cộng</span>
          <span>{money.format(order.totalAmount)}</span>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">Cảm ơn quý khách!</p>
        <div className="mt-5 flex justify-end gap-2 print:hidden">
          <SecondaryButton type="button" onClick={close}>
            Đóng
          </SecondaryButton>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Printer className="h-4 w-4" />
            In hóa đơn
          </button>
        </div>
      </article>
    </div>
  );
}
