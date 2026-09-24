"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CalendarDays, Download, LogIn, LogOut, Trash2 } from "lucide-react";
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
import type { AttendanceRecord, BranchRecord, EmployeeRecord, PayrollRecord, WorkScheduleRecord } from "./types";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const firstDay = () => `${today().slice(0, 8)}01`;
const scheduleLabels = { SCHEDULED: "Đã xếp lịch", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy" } as const;
const attendanceLabels = { PRESENT: "Có mặt", LATE: "Đi muộn", ABSENT: "Vắng", LEAVE: "Nghỉ phép" } as const;
const payrollLabels = { DRAFT: "Nháp", APPROVED: "Đã duyệt", PAID: "Đã chi trả" } as const;

export function WorkforceManagement() {
  const scope = useStoreScope();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(today);
  const [branchId, setBranchId] = useState("");
  const [scheduleForm, setScheduleForm] = useState({
    employeeId: "",
    workDate: today(),
    startTime: "08:00",
    endTime: "17:00",
    note: "",
  });
  const [payrollForm, setPayrollForm] = useState({
    employeeId: "",
    periodStart: firstDay(),
    periodEnd: today(),
    baseSalary: "",
    hourlyRate: "0",
    bonus: "0",
    deduction: "0",
    note: "",
  });
  const role = scope.profile?.role;
  const canManageOperations = ["ROLE_ADMIN", "ROLE_STORE_ADMIN", "ROLE_STORE_MANAGER", "ROLE_BRANCH_MANAGER"].includes(
    role ?? "",
  );
  const canManagePayroll = ["ROLE_ADMIN", "ROLE_STORE_ADMIN", "ROLE_STORE_MANAGER"].includes(role ?? "");
  const canPay = ["ROLE_ADMIN", "ROLE_STORE_ADMIN"].includes(role ?? "");
  const effectiveBranchId = scope.branchId ? String(scope.branchId) : branchId;

  const branches = useQuery({
    queryKey: managementKeys.branches(scope.storeId ?? 0),
    queryFn: () => api<BranchRecord[]>(`/api/branches/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId && !scope.branchId),
  });
  const employees = useQuery({
    queryKey: managementKeys.employees(
      effectiveBranchId ? "branch" : "store",
      Number(effectiveBranchId || scope.storeId || 0),
    ),
    queryFn: () =>
      api<EmployeeRecord[]>(
        effectiveBranchId ? `/api/employees/branch/${effectiveBranchId}` : `/api/employees/store/${scope.storeId}`,
      ),
    enabled: Boolean(canManageOperations && (effectiveBranchId || scope.storeId)),
  });
  const payrollEmployees = useQuery({
    queryKey: managementKeys.employees("store", scope.storeId ?? 0),
    queryFn: () => api<EmployeeRecord[]>(`/api/employees/store/${scope.storeId}`),
    enabled: Boolean(canManagePayroll && scope.storeId),
  });
  const commonSearch = useMemo(() => {
    const search = new URLSearchParams({ from, to });
    if (scope.storeId) search.set("storeId", String(scope.storeId));
    if (effectiveBranchId) search.set("branchId", effectiveBranchId);
    return search.toString();
  }, [effectiveBranchId, from, scope.storeId, to]);
  const schedules = useQuery({
    queryKey: ["workforce", "schedules", commonSearch],
    queryFn: () => api<WorkScheduleRecord[]>(`/api/workforce/schedules?${commonSearch}`),
    enabled: Boolean(scope.profile && from <= to),
  });
  const attendance = useQuery({
    queryKey: ["workforce", "attendance", commonSearch],
    queryFn: () => api<AttendanceRecord[]>(`/api/workforce/attendance?${commonSearch}`),
    enabled: Boolean(scope.profile && from <= to),
  });
  const payrollSearch = useMemo(() => {
    const search = new URLSearchParams({ from, to });
    if (scope.storeId) search.set("storeId", String(scope.storeId));
    return search.toString();
  }, [from, scope.storeId, to]);
  const payrolls = useQuery({
    queryKey: ["workforce", "payrolls", payrollSearch],
    queryFn: () => api<PayrollRecord[]>(`/api/workforce/payrolls?${payrollSearch}`),
    enabled: Boolean(scope.profile && from <= to),
  });
  const schedulePagination = useClientPagination(schedules.data ?? [], 10);
  const attendancePagination = useClientPagination(attendance.data ?? [], 10);
  const payrollPagination = useClientPagination(payrolls.data ?? [], 10);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["workforce"] });
  const saveSchedule = useMutation({
    mutationFn: () => {
      if (!effectiveBranchId || !scheduleForm.employeeId) throw new Error("Hãy chọn chi nhánh và nhân viên");
      return api<WorkScheduleRecord>("/api/workforce/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...scheduleForm,
          employeeId: Number(scheduleForm.employeeId),
          branchId: Number(effectiveBranchId),
          status: "SCHEDULED",
        }),
      });
    },
    onSuccess: () => {
      refresh();
      setScheduleForm((value) => ({ ...value, employeeId: "", note: "" }));
      toast.success("Đã xếp lịch làm việc");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteSchedule = useMutation({
    mutationFn: (id: number) => api<void>(`/api/workforce/schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      refresh();
      toast.success("Đã xóa lịch làm việc");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const attendanceAction = useMutation({
    mutationFn: (action: "check-in" | "check-out") =>
      api<AttendanceRecord>(`/api/workforce/attendance/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "check-in" ? JSON.stringify({ branchId: scope.branchId, status: "PRESENT" }) : undefined,
      }),
    onSuccess: (_, action) => {
      refresh();
      toast.success(action === "check-in" ? "Đã chấm công vào ca" : "Đã chấm công kết thúc");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateAttendance = useMutation({
    mutationFn: ({ record, status }: { record: AttendanceRecord; status: AttendanceRecord["status"] }) =>
      api<AttendanceRecord>(`/api/workforce/attendance/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: record.branchId, status, note: record.note ?? "" }),
      }),
    onSuccess: () => {
      refresh();
      toast.success("Đã cập nhật chấm công");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const savePayroll = useMutation({
    mutationFn: () => {
      if (!payrollForm.employeeId) throw new Error("Hãy chọn nhân viên");
      return api<PayrollRecord>("/api/workforce/payrolls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payrollForm,
          employeeId: Number(payrollForm.employeeId),
          baseSalary: Number(payrollForm.baseSalary || 0),
          hourlyRate: Number(payrollForm.hourlyRate || 0),
          bonus: Number(payrollForm.bonus || 0),
          deduction: Number(payrollForm.deduction || 0),
          status: "DRAFT",
        }),
      });
    },
    onSuccess: () => {
      refresh();
      setPayrollForm((value) => ({ ...value, employeeId: "", baseSalary: "", hourlyRate: "0", bonus: "0", deduction: "0", note: "" }));
      toast.success("Đã tính và lập bảng lương");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const pay = useMutation({
    mutationFn: (id: number) => api<PayrollRecord>(`/api/workforce/payrolls/${id}/pay`, { method: "POST" }),
    onSuccess: () => {
      refresh();
      toast.success("Đã xác nhận chi trả lương");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (scope.isLoading)
    return (
      <ManagementPage title="Nhân sự & tiền lương" description="Lịch làm, chấm công và chi trả lương.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage title="Nhân sự & tiền lương" description="Lịch làm, chấm công và chi trả lương.">
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );

  return (
    <ManagementPage
      title="Nhân sự & tiền lương"
      description="Quản lý lịch làm và chấm công theo chi nhánh; dữ liệu lương được giới hạn theo cấp quyền."
    >
      <AdminStoreSelector scope={scope} />
      <Panel title="Phạm vi thời gian">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">
            Từ ngày
            <input
              className={fieldClassName}
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            Đến ngày
            <input className={fieldClassName} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          {!scope.branchId ? (
            <label className="min-w-56 text-sm font-medium">
              Chi nhánh
              <select className={fieldClassName} value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                <option value="">Tất cả chi nhánh</option>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {scope.branchId ? (
            <div className="ml-auto flex gap-2">
              <PrimaryButton
                type="button"
                disabled={attendanceAction.isPending}
                onClick={() => attendanceAction.mutate("check-in")}
              >
                <LogIn className="mr-2 inline h-4 w-4" />
                Vào ca
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={attendanceAction.isPending}
                onClick={() => attendanceAction.mutate("check-out")}
              >
                <LogOut className="mr-2 inline h-4 w-4" />
                Kết thúc
              </SecondaryButton>
            </div>
          ) : null}
        </div>
        {from > to ? <p className="mt-3 text-sm text-red-700">Ngày bắt đầu không được sau ngày kết thúc.</p> : null}
      </Panel>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Lịch làm việc">
          {schedules.isPending ? (
            <LoadingState />
          ) : schedules.isError ? (
            <ErrorState message={schedules.error.message} />
          ) : schedules.data?.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-3">Ngày / ca</th>
                      <th>Nhân viên</th>
                      <th>Chi nhánh</th>
                      <th>Trạng thái</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {schedulePagination.pageItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-3">
                          <p className="font-medium">
                            {new Date(`${item.workDate}T00:00:00`).toLocaleDateString("vi-VN")}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)}
                          </p>
                        </td>
                        <td>{item.employeeName}</td>
                        <td>{item.branchName}</td>
                        <td>
                          <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
                            {scheduleLabels[item.status]}
                          </span>
                        </td>
                        <td className="text-right">
                          {canManageOperations ? (
                            <DangerButton
                              type="button"
                              onClick={() => {
                                if (window.confirm("Xóa lịch làm việc này?")) deleteSchedule.mutate(item.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </DangerButton>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ClientPagination {...schedulePagination} label="lịch làm" />
            </>
          ) : (
            <EmptyState>Chưa có lịch làm việc trong khoảng đã chọn.</EmptyState>
          )}
        </Panel>
        {canManageOperations ? (
          <Panel title="Xếp lịch mới">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Nhân viên
                <select
                  className={fieldClassName}
                  value={scheduleForm.employeeId}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, employeeId: event.target.value })}
                >
                  <option value="">Chọn nhân viên</option>
                  {employees.data?.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Ngày làm
                <input
                  className={fieldClassName}
                  type="date"
                  value={scheduleForm.workDate}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, workDate: event.target.value })}
                />
              </label>
              <label className="text-sm font-medium">
                Bắt đầu
                <input
                  className={fieldClassName}
                  type="time"
                  value={scheduleForm.startTime}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, startTime: event.target.value })}
                />
              </label>
              <label className="text-sm font-medium">
                Kết thúc
                <input
                  className={fieldClassName}
                  type="time"
                  value={scheduleForm.endTime}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, endTime: event.target.value })}
                />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Ghi chú
                <input
                  className={fieldClassName}
                  value={scheduleForm.note}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, note: event.target.value })}
                />
              </label>
              <PrimaryButton
                type="button"
                disabled={saveSchedule.isPending || !effectiveBranchId}
                onClick={() => saveSchedule.mutate()}
              >
                <CalendarDays className="mr-2 inline h-4 w-4" />
                Lưu lịch làm
              </PrimaryButton>
            </div>
            {!effectiveBranchId ? <p className="mt-3 text-xs text-amber-700">Chọn một chi nhánh để xếp lịch.</p> : null}
          </Panel>
        ) : null}
      </section>

      <Panel title="Bảng chấm công" className="mt-6">
        {attendance.isPending ? (
          <LoadingState />
        ) : attendance.isError ? (
          <ErrorState message={attendance.error.message} />
        ) : attendance.data?.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-3">Ngày</th>
                    <th>Nhân viên</th>
                    <th>Chi nhánh</th>
                    <th>Vào ca</th>
                    <th>Kết thúc</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {attendancePagination.pageItems.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3 font-medium">
                        {new Date(`${item.workDate}T00:00:00`).toLocaleDateString("vi-VN")}
                      </td>
                      <td>{item.employeeName}</td>
                      <td>{item.branchName}</td>
                      <td>
                        {item.checkIn
                          ? new Date(item.checkIn).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td>
                        {item.checkOut
                          ? new Date(item.checkOut).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td>
                        {canManageOperations ? (
                          <select
                            className="rounded-md border px-2 py-1"
                            value={item.status}
                            onChange={(event) =>
                              updateAttendance.mutate({
                                record: item,
                                status: event.target.value as AttendanceRecord["status"],
                              })
                            }
                          >
                            {Object.entries(attendanceLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          attendanceLabels[item.status]
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ClientPagination {...attendancePagination} label="bản ghi" />
          </>
        ) : (
          <EmptyState>Chưa có dữ liệu chấm công.</EmptyState>
        )}
      </Panel>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="Bảng lương">
          {payrolls.isPending ? (
            <LoadingState />
          ) : payrolls.isError ? (
            <ErrorState message={payrolls.error.message} />
          ) : payrolls.data?.length ? (
            <>
              <div className="mb-3 flex justify-end">
                <SecondaryButton type="button" onClick={() => exportPayroll(payrolls.data ?? [])}>
                  <Download className="mr-2 inline h-4 w-4" />
                  Xuất CSV
                </SecondaryButton>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-3">Nhân viên / kỳ</th>
                      <th className="text-right">Giờ công</th>
                      <th className="text-right">Lương cơ bản</th>
                      <th className="text-right">Thưởng</th>
                      <th className="text-right">Khấu trừ</th>
                      <th className="text-right">Thực nhận</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollPagination.pageItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-3">
                          <p className="font-medium">{item.employeeName}</p>
                          <p className="text-xs text-slate-500">
                            {item.periodStart} – {item.periodEnd}
                          </p>
                        </td>
                        <td className="text-right">
                          <p>{formatWorkedTime(item.workedMinutes)}</p>
                          <p className="text-xs text-slate-500">
                            {item.hourlyRate > 0 ? `${money.format(item.hourlyRate)}/giờ` : "Lương cố định"}
                          </p>
                        </td>
                        <td className="text-right">{money.format(item.baseSalary)}</td>
                        <td className="text-right text-emerald-700">+{money.format(item.bonus)}</td>
                        <td className="text-right text-rose-700">-{money.format(item.deduction)}</td>
                        <td className="text-right font-bold">{money.format(item.netSalary)}</td>
                        <td>
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">
                            {payrollLabels[item.status]}
                          </span>
                          {canPay && item.status !== "PAID" ? (
                            <button
                              className="ml-2 text-xs font-semibold text-indigo-700 underline"
                              type="button"
                              onClick={() => pay.mutate(item.id)}
                            >
                              Xác nhận trả
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ClientPagination {...payrollPagination} label="bảng lương" />
            </>
          ) : (
            <EmptyState>Chưa có bảng lương trong kỳ đã chọn.</EmptyState>
          )}
        </Panel>
        {canManagePayroll ? (
          <Panel title="Lập bảng lương">
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Nhân viên
                <select
                  className={fieldClassName}
                  value={payrollForm.employeeId}
                  onChange={(event) => setPayrollForm({ ...payrollForm, employeeId: event.target.value })}
                >
                  <option value="">Chọn nhân viên</option>
                  {payrollEmployees.data?.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">
                  Từ ngày
                  <input
                    className={fieldClassName}
                    type="date"
                    value={payrollForm.periodStart}
                    onChange={(event) => setPayrollForm({ ...payrollForm, periodStart: event.target.value })}
                  />
                </label>
                <label className="text-sm font-medium">
                  Đến ngày
                  <input
                    className={fieldClassName}
                    type="date"
                    value={payrollForm.periodEnd}
                    onChange={(event) => setPayrollForm({ ...payrollForm, periodEnd: event.target.value })}
                  />
                </label>
              </div>
              <label className="block text-sm font-medium">
                Đơn giá theo giờ
                <input
                  className={fieldClassName}
                  type="number"
                  min="0"
                  value={payrollForm.hourlyRate}
                  onChange={(event) => setPayrollForm({ ...payrollForm, hourlyRate: event.target.value })}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Nếu lớn hơn 0, máy chủ tính lương cơ bản từ tổng thời gian chấm công đã kết thúc.
                </span>
              </label>
              <label className="block text-sm font-medium">
                Lương cơ bản cố định
                <input
                  className={fieldClassName}
                  type="number"
                  min="0"
                  value={payrollForm.baseSalary}
                  onChange={(event) => setPayrollForm({ ...payrollForm, baseSalary: event.target.value })}
                  disabled={Number(payrollForm.hourlyRate) > 0}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Chỉ dùng khi đơn giá theo giờ bằng 0.
                </span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">
                  Thưởng
                  <input
                    className={fieldClassName}
                    type="number"
                    min="0"
                    value={payrollForm.bonus}
                    onChange={(event) => setPayrollForm({ ...payrollForm, bonus: event.target.value })}
                  />
                </label>
                <label className="text-sm font-medium">
                  Khấu trừ
                  <input
                    className={fieldClassName}
                    type="number"
                    min="0"
                    value={payrollForm.deduction}
                    onChange={(event) => setPayrollForm({ ...payrollForm, deduction: event.target.value })}
                  />
                </label>
              </div>
              <label className="block text-sm font-medium">
                Ghi chú
                <input
                  className={fieldClassName}
                  value={payrollForm.note}
                  onChange={(event) => setPayrollForm({ ...payrollForm, note: event.target.value })}
                />
              </label>
              <PrimaryButton
                className="w-full"
                type="button"
                disabled={savePayroll.isPending}
                onClick={() => savePayroll.mutate()}
              >
                <Banknote className="mr-2 inline h-4 w-4" />
                Tính và lập bảng lương
              </PrimaryButton>
            </div>
          </Panel>
        ) : null}
      </section>
    </ManagementPage>
  );
}

function exportPayroll(records: PayrollRecord[]) {
  const rows = [
    ["Nhân viên", "Từ ngày", "Đến ngày", "Phút công", "Đơn giá giờ", "Lương cơ bản", "Thưởng", "Khấu trừ", "Thực nhận", "Trạng thái"],
    ...records.map((item) => [
      item.employeeName,
      item.periodStart,
      item.periodEnd,
      item.workedMinutes,
      item.hourlyRate,
      item.baseSalary,
      item.bonus,
      item.deduction,
      item.netSalary,
      payrollLabels[item.status],
    ]),
  ];
  const blob = new Blob(
    [`\ufeff${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n")}`],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bang-luong-${today()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatWorkedTime(minutes: number) {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  return `${Math.floor(safeMinutes / 60)}h ${safeMinutes % 60}m`;
}
