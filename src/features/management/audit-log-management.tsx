"use client";

import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { useState } from "react";
import {
  ErrorState,
  LoadingState,
  ManagementPage,
  Panel,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
} from "@/components/management/ui";
import { api } from "@/lib/api/client";
import type { AuditLogPage as AuditLogPageResponse } from "@/types/api";
import { auditLogEndpoint, resolveAuditLogScope } from "./audit-log-scope";
import { useStoreScope } from "./use-store-scope";

const DEFAULT_PAGE_SIZE = 25;

type AuditLogFilters = {
  action: string;
  entityType: string;
  from: string;
  to: string;
};

const emptyFilters: AuditLogFilters = { action: "", entityType: "", from: "", to: "" };

const actionLabel: Record<string, string> = {
  STORE_STATUS_CHANGED: "Thay đổi trạng thái cửa hàng",
  EMPLOYEE_CREATED: "Tạo nhân viên",
  EMPLOYEE_UPDATED: "Cập nhật nhân viên",
  EMPLOYEE_ROLE_CHANGED: "Đổi vai trò nhân viên",
  EMPLOYEE_DELETED: "Xóa nhân viên",
  ORDER_CREATED: "Tạo đơn hàng",
  REFUND_CREATED: "Tạo hoàn tiền",
  SUBSCRIPTION_UPDATED: "Cập nhật subscription",
};

export function AuditLogManagement() {
  const scope = useStoreScope();
  const auditScope = resolveAuditLogScope(scope.profile, scope.storeId);
  const endpoint = auditLogEndpoint(auditScope);
  const [page, setPage] = useState(0);
  const [draftFilters, setDraftFilters] = useState<AuditLogFilters>(emptyFilters);
  const [filters, setFilters] = useState<AuditLogFilters>(emptyFilters);
  const logs = useQuery({
    queryKey: [
      "audit-logs",
      auditScope.kind,
      auditScope.kind === "store" ? auditScope.storeId : null,
      page,
      DEFAULT_PAGE_SIZE,
      filters,
    ],
    queryFn: () => {
      if (!endpoint) throw new Error("Không thể xác định phạm vi nhật ký kiểm toán.");
      return api<AuditLogPageResponse>(buildAuditLogEndpoint(endpoint, page, DEFAULT_PAGE_SIZE, filters));
    },
    enabled: Boolean(endpoint),
  });

  if (scope.isLoading)
    return (
      <AuditLogPage>
        <LoadingState />
      </AuditLogPage>
    );
  if (scope.error)
    return (
      <AuditLogPage>
        <ErrorState message={scope.error.message} />
      </AuditLogPage>
    );
  if (auditScope.kind === "forbidden")
    return (
      <AuditLogPage>
        <ErrorState message="Tài khoản hiện tại không có quyền xem nhật ký kiểm toán." />
      </AuditLogPage>
    );
  if (auditScope.kind === "missing-store")
    return (
      <AuditLogPage>
        <div className="grid place-items-center gap-2 py-10 text-center text-sm text-slate-500">
          <ScrollText size={22} />
          Tài khoản chưa được gán vào cửa hàng hợp lệ để xem nhật ký.
        </div>
      </AuditLogPage>
    );
  if (auditScope.kind === "unresolved")
    return (
      <AuditLogPage>
        <LoadingState />
      </AuditLogPage>
    );

  const description =
    auditScope.kind === "global"
      ? "Lịch sử thao tác quản trị và giao dịch quan trọng trong toàn hệ thống."
      : "Lịch sử thao tác quản trị và giao dịch quan trọng trong cửa hàng của bạn.";

  return (
    <AuditLogPage description={description}>
      <Panel title="Audit log">
        <form
          className="mb-5 grid gap-3 border-b border-slate-200 pb-5 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(0);
            setFilters({
              action: draftFilters.action.trim(),
              entityType: draftFilters.entityType.trim(),
              from: draftFilters.from,
              to: draftFilters.to,
            });
          }}
        >
          <label className="text-sm font-medium text-slate-700">
            Hành động
            <input
              value={draftFilters.action}
              onChange={(event) => setDraftFilters((current) => ({ ...current, action: event.target.value }))}
              className={fieldClassName}
              placeholder="Ví dụ: ORDER_CREATED"
              maxLength={80}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Loại đối tượng
            <input
              value={draftFilters.entityType}
              onChange={(event) => setDraftFilters((current) => ({ ...current, entityType: event.target.value }))}
              className={fieldClassName}
              placeholder="Ví dụ: ORDER"
              maxLength={80}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Từ thời điểm
            <input
              type="datetime-local"
              value={draftFilters.from}
              onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.target.value }))}
              className={fieldClassName}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Đến thời điểm
            <input
              type="datetime-local"
              value={draftFilters.to}
              onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.target.value }))}
              className={fieldClassName}
            />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <PrimaryButton type="submit" disabled={logs.isFetching}>
              Lọc nhật ký
            </PrimaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                setPage(0);
                setDraftFilters(emptyFilters);
                setFilters(emptyFilters);
              }}
              disabled={logs.isFetching}
            >
              Xóa bộ lọc
            </SecondaryButton>
          </div>
        </form>
        {logs.isPending ? (
          <LoadingState />
        ) : logs.isError ? (
          <ErrorState
            message={logs.error.message}
            retry={() => {
              void logs.refetch();
            }}
          />
        ) : logs.data?.logs.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Thời gian</th>
                    <th className="px-2 py-3">Hành động</th>
                    <th className="px-2 py-3">Cửa hàng</th>
                    <th className="px-2 py-3">Người thực hiện</th>
                    <th className="px-2 py-3">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.data.logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="px-2 py-3 whitespace-nowrap text-slate-600">
                        {new Date(log.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-2 py-3 font-medium">
                        {actionLabel[log.action] ?? log.action}
                        <p className="text-xs font-normal text-slate-500">
                          {log.entityType}
                          {log.entityId ? ` #${log.entityId}` : ""}
                        </p>
                      </td>
                      <td className="px-2 py-3">{log.storeBrand ?? "Hệ thống"}</td>
                      <td className="px-2 py-3">{log.actorName ?? "Hệ thống"}</td>
                      <td className="px-2 py-3 text-slate-600">{log.detail ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <p>
                {logs.data.totalElements.toLocaleString("vi-VN")} bản ghi · Trang {logs.data.page + 1}/
                {Math.max(1, logs.data.totalPages)}
              </p>
              <div className="flex gap-2">
                <SecondaryButton
                  type="button"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={logs.data.page === 0 || logs.isFetching}
                >
                  Trang trước
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={logs.data.page + 1 >= logs.data.totalPages || logs.isFetching}
                >
                  Trang sau
                </SecondaryButton>
              </div>
            </div>
          </>
        ) : (
          <div className="grid place-items-center gap-2 py-10 text-center text-sm text-slate-500">
            <ScrollText size={22} />
            Chưa có audit log.
          </div>
        )}
      </Panel>
    </AuditLogPage>
  );
}

function buildAuditLogEndpoint(endpoint: string, page: number, pageSize: number, filters: AuditLogFilters) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters.action) params.set("action", filters.action);
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return `${endpoint}?${params.toString()}`;
}

function AuditLogPage({
  children,
  description = "Lịch sử thao tác quản trị và giao dịch quan trọng.",
}: {
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <ManagementPage title="Nhật ký kiểm toán" description={description}>
      {children}
    </ManagementPage>
  );
}
