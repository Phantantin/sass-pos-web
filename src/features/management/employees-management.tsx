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
import { managementKeys, useStoreScope } from "./use-store-scope";
import { AdminStoreSelector } from "./admin-store-selector";
import type { BranchRecord, EmployeeRecord, EmployeeRole } from "./types";

const employeeSchema = z.object({
  fullName: z.string().trim().min(2, "Họ tên cần ít nhất 2 ký tự").max(120),
  email: z.string().trim().email("Email không hợp lệ"),
  phone: z.string().trim().max(30),
  password: z.string().max(100),
  role: z.enum(["ROLE_STORE_ADMIN", "ROLE_STORE_MANAGER", "ROLE_BRANCH_MANAGER", "ROLE_BRANCH_CASHIER"]),
  branchId: z.string(),
});
type EmployeeFormValues = z.infer<typeof employeeSchema>;
const defaults: EmployeeFormValues = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  role: "ROLE_BRANCH_CASHIER",
  branchId: "",
};
const roleNames: Record<EmployeeRole, string> = {
  ROLE_ADMIN: "Quản trị hệ thống",
  ROLE_STORE_ADMIN: "Chủ cửa hàng",
  ROLE_STORE_MANAGER: "Quản lý cửa hàng",
  ROLE_BRANCH_MANAGER: "Quản lý chi nhánh",
  ROLE_BRANCH_CASHIER: "Thu ngân",
};
const roleRank: Record<EmployeeRole, number> = {
  ROLE_ADMIN: 4,
  ROLE_STORE_ADMIN: 3,
  ROLE_STORE_MANAGER: 2,
  ROLE_BRANCH_MANAGER: 1,
  ROLE_BRANCH_CASHIER: 0,
};

export function EmployeesManagement() {
  const scope = useStoreScope();
  const queryClient = useQueryClient();
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  const form = useForm<EmployeeFormValues>({ resolver: zodResolver(employeeSchema), defaultValues: defaults });
  const branches = useQuery({
    queryKey: managementKeys.branches(scope.storeId ?? 0),
    queryFn: () => api<BranchRecord[]>(`/api/branches/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId),
  });
  const effectiveBranchFilter =
    scope.profile?.role === "ROLE_BRANCH_MANAGER" && scope.branchId ? String(scope.branchId) : branchFilter;
  const employeeScope = effectiveBranchFilter ? "branch" : "store";
  const employeeScopeId = effectiveBranchFilter ? Number(effectiveBranchFilter) : (scope.storeId ?? 0);
  const employees = useQuery({
    queryKey: managementKeys.employees(employeeScope, employeeScopeId),
    queryFn: () => api<EmployeeRecord[]>(`/api/employees/${employeeScope}/${employeeScopeId}`),
    enabled: Boolean(employeeScopeId),
  });
  const employeePagination = useClientPagination(employees.data ?? [], 10);
  const save = useMutation({
    mutationFn: (values: EmployeeFormValues) => {
      if (!editing && values.password.trim().length < 8) throw new Error("Mật khẩu nhân viên mới cần ít nhất 8 ký tự");
      const branchId = values.branchId ? Number(values.branchId) : null;
      const isBranchEmployee = values.role === "ROLE_BRANCH_MANAGER" || values.role === "ROLE_BRANCH_CASHIER";
      if (!editing && isBranchEmployee && !branchId) throw new Error("Hãy chọn chi nhánh cho nhân viên này");
      const endpoint = editing
        ? `/api/employees/${editing.id}`
        : isBranchEmployee
          ? `/api/employees/branch/${branchId}`
          : `/api/employees/store/${scope.storeId}`;
      return api<EmployeeRecord>(endpoint, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          phone: values.phone || null,
          password: values.password || null,
          role: values.role,
          branchId,
        }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["management", "employees"] });
      toast.success(editing ? "Đã cập nhật nhân viên" : "Đã thêm nhân viên");
      setEditing(null);
      form.reset(defaults);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/api/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["management", "employees"] });
      toast.success("Đã xóa nhân viên");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  function startEdit(employee: EmployeeRecord) {
    setEditing(employee);
    form.reset({
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone ?? "",
      password: "",
      role: employee.role as EmployeeFormValues["role"],
      branchId: employee.branchId ? String(employee.branchId) : "",
    });
  }
  function cancelEdit() {
    setEditing(null);
    form.reset(defaults);
  }
  const mayManage = ["ROLE_ADMIN", "ROLE_STORE_ADMIN", "ROLE_BRANCH_MANAGER"].includes(scope.profile?.role ?? "");
  const mayView = mayManage || scope.profile?.role === "ROLE_STORE_MANAGER";
  const canAssignStoreManager = ["ROLE_ADMIN", "ROLE_STORE_ADMIN"].includes(scope.profile?.role ?? "");
  const canAssignStoreAdmin = scope.profile?.role === "ROLE_ADMIN";
  const canModifyEmployee = (employee: EmployeeRecord) => {
    const actorRole = scope.profile?.role;
    if (!actorRole || !["ROLE_ADMIN", "ROLE_STORE_ADMIN", "ROLE_BRANCH_MANAGER"].includes(actorRole)) return false;
    return roleRank[actorRole] > roleRank[employee.role];
  };

  if (scope.isLoading)
    return (
      <ManagementPage title="Nhân viên" description="Phân vai và gán nhân viên vào đúng nơi làm việc.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage title="Nhân viên" description="Phân vai và gán nhân viên vào đúng nơi làm việc.">
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );
  if (!scope.storeId)
    return (
      <ManagementPage title="Nhân viên" description="Phân vai và gán nhân viên vào đúng nơi làm việc.">
        <EmptyState>Hãy tạo hoặc được gán vào cửa hàng trước khi quản lý nhân viên.</EmptyState>
      </ManagementPage>
    );
  if (!mayView)
    return (
      <ManagementPage title="Nhân viên" description="Phân vai và gán nhân viên vào đúng nơi làm việc.">
        <ErrorState message="Tài khoản hiện tại không có quyền xem nhân viên." />
      </ManagementPage>
    );

  return (
    <ManagementPage
      title="Nhân viên"
      description="Tài khoản được tạo với mật khẩu mã hóa ở phía máy chủ; không bao giờ hiển thị lại mật khẩu."
    >
      <AdminStoreSelector scope={scope} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-56 text-sm font-medium">
          Hiển thị nhân viên
          <select
            className={fieldClassName}
            value={effectiveBranchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            disabled={scope.profile?.role === "ROLE_BRANCH_MANAGER"}
          >
            <option value="">Cấp cửa hàng</option>
            {branches.data?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={mayManage ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]" : "grid gap-6"}>
        <Panel title={effectiveBranchFilter ? "Nhân viên chi nhánh" : "Nhân viên cửa hàng"}>
          {employees.isPending ? (
            <LoadingState />
          ) : employees.isError ? (
            <ErrorState
              message={employees.error.message}
              retry={() => {
                void employees.refetch();
              }}
            />
          ) : employees.data?.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-3">Nhân viên</th>
                      <th className="px-2 py-3">Vai trò</th>
                      <th className="px-2 py-3">Chi nhánh</th>
                      <th className="px-2 py-3">
                        <span className="sr-only">Thao tác</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeePagination.pageItems.map((employee) => {
                      const canModify = canModifyEmployee(employee);
                      return (
                        <tr key={employee.id} className="border-b last:border-0">
                          <td className="px-2 py-3">
                            <p className="font-medium">{employee.fullName}</p>
                            <p className="text-xs text-slate-500">
                              {employee.email}
                              {employee.phone ? ` · ${employee.phone}` : ""}
                            </p>
                          </td>
                          <td className="px-2 py-3">{roleNames[employee.role] ?? employee.role}</td>
                          <td className="px-2 py-3">
                            {branches.data?.find((branch) => branch.id === employee.branchId)?.name ?? "Cấp cửa hàng"}
                          </td>
                          <td className="px-2 py-3">
                            {canModify ? (
                              <div className="flex justify-end gap-2">
                                <SecondaryButton
                                  type="button"
                                  aria-label={`Sửa ${employee.fullName}`}
                                  onClick={() => startEdit(employee)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </SecondaryButton>
                                <DangerButton
                                  type="button"
                                  aria-label={`Xóa ${employee.fullName}`}
                                  disabled={remove.isPending}
                                  onClick={() => {
                                    if (window.confirm(`Xóa tài khoản của “${employee.fullName}”?`))
                                      remove.mutate(employee.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </DangerButton>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">Không đủ quyền quản lý</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ClientPagination {...employeePagination} label="nhân viên" />
            </>
          ) : (
            <EmptyState>Không có nhân viên trong phạm vi đã chọn.</EmptyState>
          )}
        </Panel>
        {mayManage ? (
          <Panel title={editing ? `Sửa: ${editing.fullName}` : "Thêm nhân viên"}>
            <form className="space-y-3" noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))}>
              <label className="block">
                Họ và tên
                <input {...form.register("fullName")} className={fieldClassName} autoComplete="name" />
                <FieldError>{form.formState.errors.fullName?.message}</FieldError>
              </label>
              <label className="block">
                Email đăng nhập
                <input {...form.register("email")} className={fieldClassName} type="email" autoComplete="email" />
                <FieldError>{form.formState.errors.email?.message}</FieldError>
              </label>
              <label className="block">
                Điện thoại
                <input {...form.register("phone")} className={fieldClassName} type="tel" autoComplete="tel" />
              </label>
              <label className="block">
                {editing ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu tạm thời"}
                <input
                  {...form.register("password")}
                  className={fieldClassName}
                  type="password"
                  autoComplete="new-password"
                />
                <FieldError>{form.formState.errors.password?.message}</FieldError>
              </label>
              <label className="block">
                Vai trò
                <select {...form.register("role")} className={fieldClassName}>
                  <option value="ROLE_STORE_ADMIN" disabled={!canAssignStoreAdmin}>
                    Quản trị cửa hàng (do HQ cấp)
                  </option>
                  <option value="ROLE_STORE_MANAGER" disabled={!canAssignStoreManager}>
                    Quản lý cửa hàng
                  </option>
                  <option value="ROLE_BRANCH_MANAGER" disabled={scope.profile?.role === "ROLE_BRANCH_MANAGER"}>
                    Quản lý chi nhánh
                  </option>
                  <option value="ROLE_BRANCH_CASHIER">Thu ngân</option>
                </select>
              </label>
              <label className="block">
                Chi nhánh <span className="font-normal text-slate-500">(bắt buộc cho quản lý chi nhánh/thu ngân)</span>
                <select {...form.register("branchId")} className={fieldClassName} disabled={branches.isPending}>
                  <option value="">Cấp cửa hàng</option>
                  {branches.data?.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <PrimaryButton type="submit" disabled={save.isPending}>
                  {save.isPending ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm nhân viên"}
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
