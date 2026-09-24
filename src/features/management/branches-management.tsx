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
import { canEditBranch, managementKeys, useStoreScope } from "./use-store-scope";
import { AdminStoreSelector } from "./admin-store-selector";
import type { BranchRecord } from "./types";

const branchSchema = z.object({
  name: z.string().trim().min(2, "Tên chi nhánh cần ít nhất 2 ký tự").max(120),
  address: z.string().trim().min(1, "Địa chỉ là bắt buộc").max(255),
  phone: z.string().trim().min(1, "Số điện thoại là bắt buộc").max(30),
  email: z.union([z.literal(""), z.string().trim().email("Email không hợp lệ")]),
  workingDays: z.array(z.string()).min(1, "Cần chọn ít nhất một ngày làm việc"),
  openTime: z.string(),
  closeTime: z.string(),
});
type BranchFormValues = z.infer<typeof branchSchema>;
const defaults: BranchFormValues = {
  name: "",
  address: "",
  phone: "",
  email: "",
  workingDays: [],
  openTime: "09:00",
  closeTime: "21:00",
};
const workingDayOptions = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

export function BranchesManagement() {
  const scope = useStoreScope();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<BranchRecord | null>(null);
  const form = useForm<BranchFormValues>({ resolver: zodResolver(branchSchema), defaultValues: defaults });
  const branches = useQuery({
    queryKey: managementKeys.branches(scope.storeId ?? 0),
    queryFn: () => api<BranchRecord[]>(`/api/branches/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId),
  });
  const branchPagination = useClientPagination(branches.data ?? [], 8);
  const mayEditBranch = canEditBranch(scope.profile);
  const canCreateOrDeleteBranch = ["ROLE_ADMIN", "ROLE_STORE_ADMIN"].includes(scope.profile?.role ?? "");
  const save = useMutation({
    mutationFn: (values: BranchFormValues) =>
      api<BranchRecord>(editing ? `/api/branches/${editing.id}` : "/api/branches", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          address: values.address || null,
          phone: values.phone || null,
          email: values.email || null,
          workingDays: values.workingDays,
          openTime: values.openTime || null,
          closeTime: values.closeTime || null,
          storeId: scope.storeId,
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.branches(scope.storeId!) });
      toast.success(editing ? "Đã cập nhật chi nhánh" : "Đã tạo chi nhánh");
      setEditing(null);
      form.reset(defaults);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/api/branches/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.branches(scope.storeId!) });
      toast.success("Đã xóa chi nhánh");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  function startEdit(branch: BranchRecord) {
    setEditing(branch);
    form.reset({
      name: branch.name,
      address: branch.address ?? "",
      phone: branch.phone ?? "",
      email: branch.email ?? "",
      workingDays: branch.workingDays ?? [],
      openTime: branch.openTime?.slice(0, 5) ?? "09:00",
      closeTime: branch.closeTime?.slice(0, 5) ?? "21:00",
    });
  }
  function cancelEdit() {
    setEditing(null);
    form.reset(defaults);
  }

  if (scope.isLoading)
    return (
      <ManagementPage title="Chi nhánh" description="Quản lý địa điểm vận hành và giờ mở cửa.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage title="Chi nhánh" description="Quản lý địa điểm vận hành và giờ mở cửa.">
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );
  if (!scope.storeId)
    return (
      <ManagementPage title="Chi nhánh" description="Quản lý địa điểm vận hành và giờ mở cửa.">
        <EmptyState>Hãy tạo hoặc được gán vào một cửa hàng trước khi quản lý chi nhánh.</EmptyState>
      </ManagementPage>
    );
  return (
    <ManagementPage title="Chi nhánh" description="Tạo, sửa hoặc xóa các địa điểm thuộc cửa hàng hiện tại.">
      <AdminStoreSelector scope={scope} />
      <div
        className={
          mayEditBranch && (canCreateOrDeleteBranch || editing)
            ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
            : "grid gap-6"
        }
      >
        <Panel title="Danh sách chi nhánh">
          {branches.isPending ? (
            <LoadingState />
          ) : branches.isError ? (
            <ErrorState
              message={branches.error.message}
              retry={() => {
                void branches.refetch();
              }}
            />
          ) : branches.data?.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-3">Tên</th>
                      <th className="px-2 py-3">Liên hệ</th>
                      <th className="px-2 py-3">Lịch làm việc</th>
                      {mayEditBranch ? (
                        <th className="px-2 py-3">
                          <span className="sr-only">Thao tác</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {branchPagination.pageItems.map((branch) => (
                      <tr key={branch.id} className="border-b last:border-0">
                        <td className="px-2 py-3">
                          <p className="font-medium">{branch.name}</p>
                          <p className="text-xs text-slate-500">{branch.address || "Chưa có địa chỉ"}</p>
                        </td>
                        <td className="px-2 py-3">
                          <p>{branch.phone || "—"}</p>
                          <p className="text-xs text-slate-500">{branch.email || "—"}</p>
                        </td>
                        <td className="px-2 py-3">
                          <p>
                            {branch.openTime?.slice(0, 5) || "—"} – {branch.closeTime?.slice(0, 5) || "—"}
                          </p>
                          <p className="text-xs text-slate-500">{branch.workingDays?.join(", ") || "—"}</p>
                        </td>
                        {mayEditBranch ? (
                          <td className="px-2 py-3">
                            <div className="flex justify-end gap-2">
                              <SecondaryButton
                                type="button"
                                aria-label={`Sửa ${branch.name}`}
                                onClick={() => startEdit(branch)}
                              >
                                <Pencil className="h-4 w-4" />
                              </SecondaryButton>
                              {canCreateOrDeleteBranch ? (
                                <DangerButton
                                  type="button"
                                  aria-label={`Xóa ${branch.name}`}
                                  disabled={remove.isPending}
                                  onClick={() => {
                                    if (window.confirm(`Xóa chi nhánh “${branch.name}”?`)) remove.mutate(branch.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </DangerButton>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ClientPagination {...branchPagination} label="chi nhánh" />
            </>
          ) : (
            <EmptyState>Chưa có chi nhánh nào.</EmptyState>
          )}
        </Panel>
        {mayEditBranch && (canCreateOrDeleteBranch || editing) ? (
          <Panel title={editing ? `Sửa: ${editing.name}` : "Thêm chi nhánh"}>
            <form className="space-y-3" noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))}>
              <label className="block">
                Tên chi nhánh
                <input {...form.register("name")} className={fieldClassName} />
                <FieldError>{form.formState.errors.name?.message}</FieldError>
              </label>
              <label className="block">
                Địa chỉ
                <input {...form.register("address")} className={fieldClassName} />
              </label>
              <label className="block">
                Điện thoại
                <input {...form.register("phone")} className={fieldClassName} type="tel" />
              </label>
              <label className="block">
                Email
                <input {...form.register("email")} className={fieldClassName} type="email" />
                <FieldError>{form.formState.errors.email?.message}</FieldError>
              </label>
              <fieldset>
                <legend className="mb-2 font-medium">Ngày làm việc</legend>
                <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-3 text-sm sm:grid-cols-3">
                  {workingDayOptions.map((day) => (
                    <label key={day} className="flex items-center gap-2">
                      <input type="checkbox" value={day} {...form.register("workingDays")} />
                      {day}
                    </label>
                  ))}
                </div>
                <FieldError>{form.formState.errors.workingDays?.message}</FieldError>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  Mở cửa
                  <input {...form.register("openTime")} className={fieldClassName} type="time" />
                </label>
                <label>
                  Đóng cửa
                  <input {...form.register("closeTime")} className={fieldClassName} type="time" />
                </label>
              </div>
              <div className="flex gap-2">
                <PrimaryButton type="submit" disabled={save.isPending}>
                  {save.isPending ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm chi nhánh"}
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
