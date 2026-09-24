"use client";

import { useState } from "react";
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
import { canManageStore, managementKeys, useStoreScope } from "./use-store-scope";
import { AdminStoreSelector } from "./admin-store-selector";
import type { CategoryRecord } from "./types";

const categorySchema = z.object({ name: z.string().trim().min(2, "Tên danh mục cần ít nhất 2 ký tự").max(120) });
type CategoryFormValues = z.infer<typeof categorySchema>;

export function CategoriesManagement() {
  const scope = useStoreScope();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CategoryRecord | null>(null);
  const form = useForm<CategoryFormValues>({ resolver: zodResolver(categorySchema), defaultValues: { name: "" } });
  const categories = useQuery({
    queryKey: managementKeys.categories(scope.storeId ?? 0),
    queryFn: () => api<CategoryRecord[]>(`/api/categories/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId),
  });
  const categoryPagination = useClientPagination(categories.data ?? [], 12);
  const canEditCatalog = canManageStore(scope.profile);
  const save = useMutation({
    mutationFn: (values: CategoryFormValues) =>
      api<CategoryRecord>(editing ? `/api/categories/${editing.id}` : "/api/categories", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name, storeId: scope.storeId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.categories(scope.storeId!) });
      toast.success(editing ? "Đã cập nhật danh mục" : "Đã tạo danh mục");
      setEditing(null);
      form.reset({ name: "" });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/api/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.categories(scope.storeId!) });
      toast.success("Đã xóa danh mục");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  function startEdit(category: CategoryRecord) {
    setEditing(category);
    form.reset({ name: category.name });
  }
  function cancelEdit() {
    setEditing(null);
    form.reset({ name: "" });
  }

  if (scope.isLoading)
    return (
      <ManagementPage title="Danh mục" description="Nhóm hàng hóa để tìm kiếm và báo cáo rõ ràng hơn.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage title="Danh mục" description="Nhóm hàng hóa để tìm kiếm và báo cáo rõ ràng hơn.">
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );
  if (!scope.storeId)
    return (
      <ManagementPage title="Danh mục" description="Nhóm hàng hóa để tìm kiếm và báo cáo rõ ràng hơn.">
        <EmptyState>Hãy tạo hoặc được gán vào cửa hàng trước khi quản lý danh mục.</EmptyState>
      </ManagementPage>
    );

  return (
    <ManagementPage
      title="Danh mục"
      description="Danh mục đang được dùng bởi sản phẩm không thể bị xóa để tránh mất dữ liệu."
    >
      <AdminStoreSelector scope={scope} />
      <div className={canEditCatalog ? "grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]" : "grid gap-6"}>
        <Panel title="Danh mục hiện có">
          {categories.isPending ? (
            <LoadingState />
          ) : categories.isError ? (
            <ErrorState
              message={categories.error.message}
              retry={() => {
                void categories.refetch();
              }}
            />
          ) : categories.data?.length ? (
            <>
              <ul className="divide-y">
                <li
                  className={`grid gap-4 px-2 py-3 text-xs font-medium uppercase text-slate-500 ${canEditCatalog ? "grid-cols-[1fr_auto]" : "grid-cols-1"}`}
                >
                  <span>Tên danh mục</span>
                  {canEditCatalog ? <span>Thao tác</span> : null}
                </li>
                {categoryPagination.pageItems.map((category) => (
                  <li
                    key={category.id}
                    className={`grid items-center gap-4 px-2 py-3 ${canEditCatalog ? "grid-cols-[1fr_auto]" : "grid-cols-1"}`}
                  >
                    <span className="font-medium">{category.name}</span>
                    {canEditCatalog ? (
                      <span className="flex gap-2">
                        <SecondaryButton
                          type="button"
                          aria-label={`Sửa ${category.name}`}
                          onClick={() => startEdit(category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </SecondaryButton>
                        <DangerButton
                          type="button"
                          aria-label={`Xóa ${category.name}`}
                          disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm(`Xóa danh mục “${category.name}”?`)) remove.mutate(category.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </DangerButton>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <ClientPagination {...categoryPagination} label="danh mục" />
            </>
          ) : (
            <EmptyState>Chưa có danh mục nào.</EmptyState>
          )}
        </Panel>
        {canEditCatalog ? (
          <Panel title={editing ? `Sửa: ${editing.name}` : "Thêm danh mục"}>
            <form className="space-y-3" noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))}>
              <label className="block">
                Tên danh mục
                <input {...form.register("name")} className={fieldClassName} autoFocus />
                <FieldError>{form.formState.errors.name?.message}</FieldError>
              </label>
              <div className="flex gap-2">
                <PrimaryButton type="submit" disabled={save.isPending}>
                  {save.isPending ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm danh mục"}
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
        ) : null}
      </div>
    </ManagementPage>
  );
}
