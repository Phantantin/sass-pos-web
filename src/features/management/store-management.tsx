"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
  SecondaryButton,
  fieldClassName,
} from "@/components/management/ui";
import { canCreateStore, canUpdateStore, managementKeys, useStoreScope } from "./use-store-scope";
import { AdminStoreSelector } from "./admin-store-selector";
import type { StoreRecord, StoreStatus } from "./types";

const storeSchema = z.object({
  brand: z.string().trim().min(2, "Tên thương hiệu cần ít nhất 2 ký tự").max(120),
  description: z.string().trim().max(1000),
  storeType: z.string().trim().max(80),
  address: z.string().trim().max(255),
  phone: z.string().trim().max(30),
  email: z.union([z.literal(""), z.string().trim().email("Email không hợp lệ")]),
});

type StoreFormValues = z.infer<typeof storeSchema>;

const defaults: StoreFormValues = { brand: "", description: "", storeType: "", address: "", phone: "", email: "" };

export function StoreManagement() {
  const scope = useStoreScope();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const store = useQuery({
    queryKey: managementKeys.store(scope.storeId ?? 0),
    queryFn: () => api<StoreRecord>(`/api/stores/${scope.storeId}`),
    enabled: Boolean(scope.storeId),
  });
  const stores = useQuery({
    queryKey: managementKeys.stores,
    queryFn: () => api<StoreRecord[]>("/api/stores"),
    enabled: scope.profile?.role === "ROLE_ADMIN",
  });
  const form = useForm<StoreFormValues>({ resolver: zodResolver(storeSchema), defaultValues: defaults });

  useEffect(() => {
    if (!store.data || creating) return;
    form.reset({
      brand: store.data.brand ?? "",
      description: store.data.description ?? "",
      storeType: store.data.storeType ?? "",
      address: store.data.contact?.address ?? "",
      phone: store.data.contact?.phone ?? "",
      email: store.data.contact?.email ?? "",
    });
  }, [creating, form, store.data]);

  const mayCreateStore = canCreateStore(scope.profile);
  const isCreateMode = creating || !scope.storeId;
  const canUpdateCurrentStore = !isCreateMode && Boolean(scope.storeId) && canUpdateStore(scope.profile);
  const save = useMutation({
    mutationFn: (values: StoreFormValues) =>
      api<StoreRecord>(canUpdateCurrentStore ? `/api/stores/${scope.storeId}` : "/api/stores", {
        method: canUpdateCurrentStore ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: values.brand,
          description: values.description || null,
          storeType: values.storeType || null,
          contact: { address: values.address || null, phone: values.phone || null, email: values.email || null },
        }),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(managementKeys.store(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: managementKeys.managedStores(scope.profile?.id ?? 0) });
      void queryClient.invalidateQueries({ queryKey: managementKeys.profile });
      if (!canUpdateCurrentStore) {
        scope.selectAdminStore?.(saved.id);
        setCreating(false);
        form.reset(defaults);
      }
      toast.success(canUpdateCurrentStore ? "Đã cập nhật cửa hàng" : "Đã tạo cửa hàng");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (scope.isLoading || Boolean(scope.storeId && store.isPending))
    return (
      <ManagementPage title="Cửa hàng" description="Thông tin và liên hệ của cửa hàng.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error || store.error)
    return (
      <ManagementPage title="Cửa hàng" description="Thông tin và liên hệ của cửa hàng.">
        <ErrorState
          message={(scope.error ?? store.error)?.message ?? "Không thể tải cửa hàng"}
          retry={() => {
            void store.refetch();
          }}
        />
      </ManagementPage>
    );
  if (scope.profile?.role === "ROLE_ADMIN") return <AdminStores stores={stores} />;
  if (!mayCreateStore && !canUpdateCurrentStore)
    return (
      <ManagementPage title="Cửa hàng" description="Thông tin và liên hệ của cửa hàng.">
        <ErrorState message="Tài khoản hiện tại không có quyền tạo hoặc cập nhật cửa hàng." />
      </ManagementPage>
    );

  return (
    <ManagementPage
      title="Cửa hàng"
      description={
        canUpdateCurrentStore
          ? "Chọn một cửa hàng để quản trị hoặc tạo thêm cửa hàng mới."
          : "Tạo cửa hàng để bắt đầu quản lý chi nhánh và hàng hóa."
      }
    >
      {!isCreateMode ? <AdminStoreSelector scope={scope} /> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        {!isCreateMode && mayCreateStore ? (
          <PrimaryButton
            type="button"
            onClick={() => {
              setCreating(true);
              form.reset(defaults);
            }}
          >
            Thêm cửa hàng mới
          </PrimaryButton>
        ) : null}
        {isCreateMode && scope.adminStores?.length ? (
          <SecondaryButton
            type="button"
            onClick={() => {
              setCreating(false);
              form.reset(defaults);
            }}
          >
            Hủy tạo mới
          </SecondaryButton>
        ) : null}
      </div>
      {canUpdateCurrentStore && store.data ? <OwnerStoreSummary store={store.data} /> : null}
      <Panel title={canUpdateCurrentStore ? "Thông tin cửa hàng" : "Tạo cửa hàng mới"} className="max-w-3xl">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
          noValidate
        >
          <label className="sm:col-span-2">
            Tên thương hiệu
            <input {...form.register("brand")} className={fieldClassName} autoComplete="organization" />
            <FieldError>{form.formState.errors.brand?.message}</FieldError>
          </label>
          <label>
            Loại hình kinh doanh
            <input {...form.register("storeType")} className={fieldClassName} placeholder="Ví dụ: Bán lẻ" />
          </label>
          <label>
            Điện thoại
            <input {...form.register("phone")} className={fieldClassName} type="tel" autoComplete="tel" />
          </label>
          <label className="sm:col-span-2">
            Email liên hệ
            <input {...form.register("email")} className={fieldClassName} type="email" autoComplete="email" />
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </label>
          <label className="sm:col-span-2">
            Địa chỉ
            <input {...form.register("address")} className={fieldClassName} autoComplete="street-address" />
          </label>
          <label className="sm:col-span-2">
            Mô tả
            <textarea {...form.register("description")} className={fieldClassName} rows={4} />
          </label>
          <div className="sm:col-span-2">
            <PrimaryButton type="submit" disabled={save.isPending}>
              {save.isPending ? "Đang lưu…" : canUpdateCurrentStore ? "Lưu thay đổi" : "Tạo cửa hàng mới"}
            </PrimaryButton>
          </div>
        </form>
      </Panel>
    </ManagementPage>
  );
}

function OwnerStoreSummary({ store }: { store: StoreRecord }) {
  const status = store.status ?? "PENDING";
  return (
    <Panel title="Cửa hàng của bạn" className="mb-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{store.brand}</p>
          <p className="mt-1 text-sm text-slate-600">{store.contact?.address || "Chưa có địa chỉ"}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {statusLabel[status]}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Email</dt>
          <dd>{store.contact?.email || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Điện thoại</dt>
          <dd>{store.contact?.phone || "—"}</dd>
        </div>
      </dl>
    </Panel>
  );
}

const statusLabel: Record<StoreStatus, string> = { PENDING: "Chờ duyệt", ACTIVE: "Đang hoạt động", BLOCKED: "Đã khóa" };

function AdminStores({ stores }: { stores: ReturnType<typeof useQuery<StoreRecord[]>> }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, StoreStatus>>({});
  const storePagination = useClientPagination(stores.data ?? [], 10);
  const moderate = useMutation({
    mutationFn: ({ storeId, status }: { storeId: number; status: StoreStatus }) =>
      api<StoreRecord>(`/api/stores/${storeId}/moderate?status=${status}`, { method: "PUT" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.stores });
      toast.success("Đã cập nhật trạng thái cửa hàng");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (stores.isPending)
    return (
      <ManagementPage title="Quản trị cửa hàng" description="Theo dõi và kiểm duyệt các cửa hàng trong hệ thống.">
        <LoadingState />
      </ManagementPage>
    );
  if (stores.isError)
    return (
      <ManagementPage title="Quản trị cửa hàng" description="Theo dõi và kiểm duyệt các cửa hàng trong hệ thống.">
        <ErrorState
          message={stores.error.message}
          retry={() => {
            void stores.refetch();
          }}
        />
      </ManagementPage>
    );

  return (
    <ManagementPage
      title="Quản trị cửa hàng"
      description="Admin kiểm duyệt trạng thái cửa hàng; việc tạo cửa hàng vẫn thuộc về tài khoản chủ cửa hàng."
    >
      <Panel title="Danh sách cửa hàng">
        {stores.data?.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Cửa hàng</th>
                    <th className="px-2 py-3">Chủ cửa hàng</th>
                    <th className="px-2 py-3">Trạng thái</th>
                    <th className="px-2 py-3">
                      <span className="sr-only">Lưu</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {storePagination.pageItems.map((store) => {
                    const currentStatus = store.status ?? "PENDING";
                    const draft = drafts[store.id] ?? currentStatus;
                    return (
                      <tr key={store.id} className="border-b last:border-0">
                        <td className="px-2 py-3">
                          <p className="font-medium">{store.brand}</p>
                          <p className="text-xs text-slate-500">Store #{store.id}</p>
                        </td>
                        <td className="px-2 py-3">
                          {store.storeAdmin ? (
                            <>
                              <p>{store.storeAdmin.fullName}</p>
                              <p className="text-xs text-slate-500">{store.storeAdmin.email}</p>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <select
                            aria-label={`Trạng thái ${store.brand}`}
                            value={draft}
                            onChange={(event) =>
                              setDrafts((previous) => ({ ...previous, [store.id]: event.target.value as StoreStatus }))
                            }
                            className={fieldClassName}
                          >
                            {(Object.keys(statusLabel) as StoreStatus[]).map((status) => (
                              <option key={status} value={status}>
                                {statusLabel[status]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-3 text-right">
                          <PrimaryButton
                            type="button"
                            disabled={moderate.isPending || draft === currentStatus}
                            onClick={() => moderate.mutate({ storeId: store.id, status: draft })}
                          >
                            Lưu
                          </PrimaryButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ClientPagination {...storePagination} label="cửa hàng" />
          </>
        ) : (
          <EmptyState>Chưa có cửa hàng nào.</EmptyState>
        )}
      </Panel>
    </ManagementPage>
  );
}
