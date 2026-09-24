"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { api, RequestError } from "@/lib/api/client";
import { ClientPagination, useClientPagination } from "@/components/management/client-pagination";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ManagementPage,
  Panel,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
} from "@/components/management/ui";
import { managementKeys, useStoreScope } from "./use-store-scope";
import { canOperateOwnShift, canSelectShiftHistoryBranch, resolveShiftHistoryBranchId } from "./shift-scope";
import type { BranchRecord, ShiftReportRecord } from "./types";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export function ShiftsManagement() {
  const scope = useStoreScope();
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const canSelectHistoryBranch = canSelectShiftHistoryBranch(scope.profile);
  const canOperateShift = canOperateOwnShift(scope.branchId);
  const branches = useQuery({
    queryKey: managementKeys.branches(scope.storeId ?? 0),
    queryFn: () => api<BranchRecord[]>(`/api/branches/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId) && canSelectHistoryBranch,
  });
  const historyBranchId = resolveShiftHistoryBranchId(scope.profile, scope.branchId, selectedBranchId, branches.data);
  const current = useQuery({
    queryKey: ["current-shift"],
    queryFn: () => api<ShiftReportRecord>("/api/shift-reports/current"),
    enabled: canOperateShift,
    retry: false,
  });
  const history = useQuery({
    queryKey: ["management", "shift-history", historyBranchId],
    queryFn: () => api<ShiftReportRecord[]>(`/api/shift-reports/branch/${historyBranchId}`),
    enabled: Boolean(historyBranchId),
  });
  const shiftPagination = useClientPagination(history.data ?? [], 15);
  const start = useMutation({
    mutationFn: () => api<ShiftReportRecord>("/api/shift-reports/start", { method: "POST" }),
    onSuccess: () => {
      toast.success("Đã mở ca làm việc.");
      void queryClient.invalidateQueries({ queryKey: ["current-shift"] });
      void queryClient.invalidateQueries({ queryKey: ["management", "shift-history"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const end = useMutation({
    mutationFn: () => api<ShiftReportRecord>("/api/shift-reports/end", { method: "POST" }),
    onSuccess: () => {
      toast.success("Đã đóng ca và chốt số liệu.");
      void queryClient.invalidateQueries({ queryKey: ["current-shift"] });
      void queryClient.invalidateQueries({ queryKey: ["management", "shift-history"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const hasNoOpenShift = current.error instanceof RequestError && current.error.status === 409;

  if (scope.isLoading)
    return (
      <ManagementPage title="Ca làm việc" description="Mở ca trước khi bán hàng và chốt số liệu khi kết thúc.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage title="Ca làm việc" description="Mở ca trước khi bán hàng và chốt số liệu khi kết thúc.">
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );
  if (!scope.storeId)
    return (
      <ManagementPage title="Ca làm việc" description="Mở ca trước khi bán hàng và chốt số liệu khi kết thúc.">
        <EmptyState>Tài khoản chưa thuộc cửa hàng hợp lệ.</EmptyState>
      </ManagementPage>
    );

  return (
    <ManagementPage
      title="Ca làm việc"
      description="Số liệu ca được tính lại từ đơn hàng và hoàn tiền thực tế, không nhận tổng tiền từ trình duyệt."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title="Ca hiện tại của bạn">
          {!canOperateShift ? (
            <EmptyState>
              Bạn có thể xem lịch sử ca của cửa hàng bên dưới. Chỉ tài khoản được gán chi nhánh mới có thể mở hoặc đóng
              ca.
            </EmptyState>
          ) : current.isPending ? (
            <LoadingState />
          ) : current.data ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                    <Clock3 size={15} />
                    Đang mở ca
                  </p>
                  <p className="mt-4 text-sm text-slate-500">
                    Bắt đầu: {new Date(current.data.shiftStart).toLocaleString("vi-VN")}
                  </p>
                </div>
                <SecondaryButton
                  type="button"
                  onClick={() => {
                    if (window.confirm("Đóng ca hiện tại?")) end.mutate();
                  }}
                  disabled={end.isPending}
                >
                  <Square className="mr-1 inline h-4 w-4" />
                  {end.isPending ? "Đang đóng ca…" : "Đóng ca"}
                </SecondaryButton>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Metric label="Doanh thu" value={money.format(current.data.totalSales)} />
                <Metric label="Hoàn tiền" value={money.format(current.data.totalRefund)} />
                <Metric label="Doanh thu thuần" value={money.format(current.data.netSale)} />
                <Metric label="Đơn hàng" value={current.data.totalOrder.toLocaleString("vi-VN")} />
              </div>
            </div>
          ) : hasNoOpenShift ? (
            <div className="grid place-items-center gap-3 py-8 text-center">
              <Clock3 className="text-slate-600" size={28} />
              <p className="text-sm text-slate-600">Bạn chưa mở ca làm việc.</p>
              <PrimaryButton type="button" onClick={() => start.mutate()} disabled={start.isPending}>
                <Play className="mr-1 inline h-4 w-4" />
                {start.isPending ? "Đang mở ca…" : "Mở ca"}
              </PrimaryButton>
            </div>
          ) : (
            <ErrorState
              message={current.error?.message ?? "Không thể tải ca hiện tại"}
              retry={() => {
                void current.refetch();
              }}
            />
          )}
        </Panel>
        <Panel title="Quy trình">
          <ol className="space-y-3 text-sm text-slate-600">
            <li>
              <strong>1.</strong> Mở ca trước khi thanh toán hoặc hoàn tiền.
            </li>
            <li>
              <strong>2.</strong> Dùng POS để tạo đơn; tồn kho tự động giảm.
            </li>
            <li>
              <strong>3.</strong> Đóng ca để chốt doanh thu, hoàn tiền và doanh thu thuần.
            </li>
          </ol>
        </Panel>
      </div>
      {canSelectHistoryBranch ? (
        <div className="mt-6">
          <label className="min-w-64 text-sm font-medium">
            Chi nhánh xem lịch sử
            <select
              value={historyBranchId ?? ""}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className={fieldClassName}
              disabled={branches.isPending}
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
      ) : null}
      <Panel title="Lịch sử ca tại chi nhánh" className="mt-6">
        {canSelectHistoryBranch && branches.isPending ? (
          <LoadingState label="Đang tải chi nhánh…" />
        ) : canSelectHistoryBranch && branches.isError ? (
          <ErrorState
            message={branches.error.message}
            retry={() => {
              void branches.refetch();
            }}
          />
        ) : !historyBranchId ? (
          <EmptyState>Chưa có chi nhánh để xem lịch sử ca.</EmptyState>
        ) : history.isPending ? (
          <LoadingState />
        ) : history.isError ? (
          <ErrorState
            message={history.error.message}
            retry={() => {
              void history.refetch();
            }}
          />
        ) : history.data?.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Thời gian</th>
                    <th className="px-2 py-3">Thu ngân</th>
                    <th className="px-2 py-3">Đơn hàng</th>
                    <th className="px-2 py-3 text-right">Doanh thu thuần</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftPagination.pageItems.map((shift) => (
                    <tr key={shift.id} className="border-b last:border-0">
                      <td className="px-2 py-3">
                        <p>{new Date(shift.shiftStart).toLocaleString("vi-VN")}</p>
                        <p className="text-xs text-slate-500">
                          {shift.shiftEnd ? `Kết thúc: ${new Date(shift.shiftEnd).toLocaleString("vi-VN")}` : "Đang mở"}
                        </p>
                      </td>
                      <td className="px-2 py-3">{shift.cashier?.fullName ?? "—"}</td>
                      <td className="px-2 py-3">{shift.totalOrder}</td>
                      <td className="px-2 py-3 text-right font-medium">{money.format(shift.netSale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ClientPagination {...shiftPagination} label="ca làm việc" />
          </>
        ) : (
          <EmptyState>Chưa có lịch sử ca tại chi nhánh này.</EmptyState>
        )}
      </Panel>
    </ManagementPage>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
