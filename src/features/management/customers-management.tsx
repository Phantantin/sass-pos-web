"use client";

import { useDeferredValue, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Pencil, Search, Trash2, X } from "lucide-react";
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
import { AdminStoreSelector } from "./admin-store-selector";
import type { CustomerRecord } from "./types";
import type { CustomerHistory } from "@/types/api";

const customerSchema = z.object({
  fullName: z.string().trim().min(2, "Họ tên cần ít nhất 2 ký tự").max(120),
  email: z.union([z.literal(""), z.string().trim().email("Email không hợp lệ")]),
  phone: z.string().trim().max(30),
});
type CustomerFormValues = z.infer<typeof customerSchema>;
const defaults: CustomerFormValues = { fullName: "", email: "", phone: "" };
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export function CustomersManagement() {
  const scope = useStoreScope();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<CustomerRecord | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const form = useForm<CustomerFormValues>({ resolver: zodResolver(customerSchema), defaultValues: defaults });
  const customers = useQuery({
    queryKey: managementKeys.customers(scope.storeId ?? 0, deferredSearch),
    queryFn: () =>
      api<CustomerRecord[]>(
        deferredSearch
          ? `/api/customers/search?q=${encodeURIComponent(deferredSearch)}&storeId=${scope.storeId}`
          : `/api/customers?storeId=${scope.storeId}`,
      ),
    enabled: Boolean(scope.storeId),
  });
  const customerPagination = useClientPagination(customers.data ?? [], 12);
  const save = useMutation({
    mutationFn: (values: CustomerFormValues) =>
      api<CustomerRecord>(editing ? `/api/customers/${editing.id}` : `/api/customers?storeId=${scope.storeId}`, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: values.fullName, email: values.email || null, phone: values.phone || null }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["management", "customers"] });
      toast.success(editing ? "Đã cập nhật khách hàng" : "Đã thêm khách hàng");
      setEditing(null);
      form.reset(defaults);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/api/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["management", "customers"] });
      toast.success("Đã xóa khách hàng");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const history = useQuery({
    queryKey: ["customer-history", historyCustomer?.id, historyPage],
    queryFn: () =>
      api<CustomerHistory>(`/api/customers/${historyCustomer!.id}/history?page=${historyPage}&pageSize=20`),
    enabled: Boolean(historyCustomer),
  });
  function startEdit(customer: CustomerRecord) {
    setEditing(customer);
    form.reset({ fullName: customer.fullName, email: customer.email ?? "", phone: customer.phone ?? "" });
  }
  function cancelEdit() {
    setEditing(null);
    form.reset(defaults);
  }
  function showHistory(customer: CustomerRecord) {
    setHistoryCustomer(customer);
    setHistoryPage(0);
  }
  const canUseCustomers = [
    "ROLE_ADMIN",
    "ROLE_STORE_ADMIN",
    "ROLE_STORE_MANAGER",
    "ROLE_BRANCH_MANAGER",
    "ROLE_BRANCH_CASHIER",
  ].includes(scope.profile?.role ?? "");
  const mayDelete = canManageBranch(scope.profile);

  if (scope.isLoading)
    return (
      <ManagementPage title="Khách hàng" description="Tra cứu và quản lý khách hàng theo từng cửa hàng.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage title="Khách hàng" description="Tra cứu và quản lý khách hàng theo từng cửa hàng.">
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );
  if (!scope.storeId)
    return (
      <ManagementPage title="Khách hàng" description="Tra cứu và quản lý khách hàng theo từng cửa hàng.">
        <EmptyState>Hãy tạo hoặc được gán vào cửa hàng trước khi quản lý khách hàng.</EmptyState>
      </ManagementPage>
    );
  if (!canUseCustomers)
    return (
      <ManagementPage title="Khách hàng" description="Tra cứu và quản lý khách hàng theo từng cửa hàng.">
        <ErrorState message="Tài khoản hiện tại không có quyền truy cập khách hàng." />
      </ManagementPage>
    );

  return (
    <ManagementPage title="Khách hàng" description="Dữ liệu khách hàng luôn được giới hạn trong cửa hàng hiện tại.">
      <AdminStoreSelector scope={scope} />
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <Panel title="Danh sách khách hàng">
          <label className="relative mb-4 block max-w-lg">
            <span className="sr-only">Tìm khách hàng</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                customerPagination.setPage(0);
              }}
              className={`${fieldClassName} mt-0 pl-9`}
              placeholder="Tìm theo tên hoặc email"
            />
          </label>
          {customers.isPending ? (
            <LoadingState />
          ) : customers.isError ? (
            <ErrorState
              message={customers.error.message}
              retry={() => {
                void customers.refetch();
              }}
            />
          ) : customers.data?.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-3">Khách hàng</th>
                      <th className="px-2 py-3">Liên hệ</th>
                      <th className="px-2 py-3">
                        <span className="sr-only">Thao tác</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerPagination.pageItems.map((customer) => (
                      <tr key={customer.id} className="border-b last:border-0">
                        <td className="px-2 py-3 font-medium">{customer.fullName}</td>
                        <td className="px-2 py-3">
                          <p>{customer.phone || "—"}</p>
                          <p className="text-xs text-slate-500">{customer.email || "—"}</p>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex justify-end gap-2">
                            <SecondaryButton
                              type="button"
                              aria-label={`Lịch sử mua hàng của ${customer.fullName}`}
                              onClick={() => showHistory(customer)}
                            >
                              <History className="h-4 w-4" />
                            </SecondaryButton>
                            <SecondaryButton
                              type="button"
                              aria-label={`Sửa ${customer.fullName}`}
                              onClick={() => startEdit(customer)}
                            >
                              <Pencil className="h-4 w-4" />
                            </SecondaryButton>
                            {mayDelete ? (
                              <DangerButton
                                type="button"
                                aria-label={`Xóa ${customer.fullName}`}
                                disabled={remove.isPending}
                                onClick={() => {
                                  if (window.confirm(`Xóa khách hàng “${customer.fullName}”?`))
                                    remove.mutate(customer.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </DangerButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ClientPagination {...customerPagination} label="khách hàng" />
            </>
          ) : (
            <EmptyState>{search ? "Không tìm thấy khách hàng phù hợp." : "Chưa có khách hàng nào."}</EmptyState>
          )}
        </Panel>
        <Panel title={editing ? `Sửa: ${editing.fullName}` : "Thêm khách hàng"}>
          <form className="space-y-3" noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))}>
            <label className="block">
              Họ và tên
              <input {...form.register("fullName")} className={fieldClassName} autoComplete="name" />
              <FieldError>{form.formState.errors.fullName?.message}</FieldError>
            </label>
            <label className="block">
              Điện thoại
              <input {...form.register("phone")} className={fieldClassName} type="tel" autoComplete="tel" />
            </label>
            <label className="block">
              Email
              <input {...form.register("email")} className={fieldClassName} type="email" autoComplete="email" />
              <FieldError>{form.formState.errors.email?.message}</FieldError>
            </label>
            <div className="flex gap-2">
              <PrimaryButton type="submit" disabled={save.isPending}>
                {save.isPending ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm khách hàng"}
              </PrimaryButton>
              {editing ? (
                <SecondaryButton type="button" onClick={cancelEdit}>
                  <X className="mr-1 inline h-4 w-4" />
                  Hủy
                </SecondaryButton>
              ) : null}
            </div>
          </form>
        </Panel>
      </div>
      {historyCustomer ? (
        <CustomerHistoryPanel
          customer={historyCustomer}
          history={history}
          onClose={() => setHistoryCustomer(null)}
          onPrevious={() => setHistoryPage((page) => Math.max(0, page - 1))}
          onNext={() => setHistoryPage((page) => page + 1)}
        />
      ) : null}
    </ManagementPage>
  );
}

function CustomerHistoryPanel({
  customer,
  history,
  onClose,
  onPrevious,
  onNext,
}: {
  customer: CustomerRecord;
  history: ReturnType<typeof useQuery<CustomerHistory>>;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const data = history.data;
  return (
    <section className="mt-6">
      <Panel title={`Lịch sử mua hàng: ${customer.fullName}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Dữ liệu đơn hàng và hoàn tiền được tổng hợp từ máy chủ theo phạm vi quyền hiện tại.
          </p>
          <SecondaryButton type="button" onClick={onClose}>
            <X className="mr-1 inline h-4 w-4" />
            Đóng
          </SecondaryButton>
        </div>
        {history.isPending ? (
          <LoadingState label="Đang tải lịch sử mua hàng…" />
        ) : history.isError ? (
          <ErrorState
            message={history.error.message}
            retry={() => {
              void history.refetch();
            }}
          />
        ) : !data?.orders.length ? (
          <EmptyState>Khách hàng chưa có đơn hàng trong phạm vi bạn được xem.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Thời gian</th>
                    <th className="px-2 py-3">Đơn hàng</th>
                    <th className="px-2 py-3">Chi nhánh</th>
                    <th className="px-2 py-3 text-right">Tổng đơn</th>
                    <th className="px-2 py-3 text-right">Hoàn tiền</th>
                    <th className="px-2 py-3 text-right">Thực thu</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((order) => (
                    <tr key={order.orderId} className="border-b last:border-0">
                      <td className="px-2 py-3 whitespace-nowrap text-slate-600">
                        {new Date(order.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-2 py-3">
                        <p className="font-medium">#{order.orderId}</p>
                        <p className="text-xs text-slate-500">
                          {order.status} · {order.paymentType}
                        </p>
                      </td>
                      <td className="px-2 py-3">{order.branchName ?? "—"}</td>
                      <td className="px-2 py-3 text-right">{money.format(order.totalAmount)}</td>
                      <td className="px-2 py-3 text-right text-amber-700">
                        {order.refundedAmount ? money.format(order.refundedAmount) : "—"}
                      </td>
                      <td className="px-2 py-3 text-right font-medium">{money.format(order.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <p className="text-slate-600">
                {data.totalOrders.toLocaleString("vi-VN")} đơn · Trang {data.page + 1}/{Math.max(1, data.totalPages)}
              </p>
              <div className="flex gap-2">
                <SecondaryButton type="button" disabled={data.page === 0 || history.isFetching} onClick={onPrevious}>
                  Trang trước
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  disabled={data.page + 1 >= data.totalPages || history.isFetching}
                  onClick={onNext}
                >
                  Trang sau
                </SecondaryButton>
              </div>
            </div>
          </>
        )}
      </Panel>
    </section>
  );
}
