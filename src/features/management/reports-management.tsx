"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  CircleDollarSign,
  Download,
  ReceiptText,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  WalletCards,
  Warehouse,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api/client";
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
import type { BranchRecord } from "./types";
import type { InventoryMovementReport, SalesReport } from "@/types/api";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const chartColors = ["#0f766e", "#0284c7", "#d97706"];

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadFile(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function xmlEscape(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function downloadReportCsv(report: SalesReport) {
  const rows = [
    ["Ngày", "Doanh thu gộp", "Hoàn tiền", "Doanh thu thuần", "Giá vốn thuần", "Lợi nhuận", "Số đơn"],
    ...report.dailySales.map((day) => [
      day.date,
      day.grossSales,
      day.refunds,
      day.netSales,
      day.netCost,
      day.netProfit,
      day.orderCount,
    ]),
    [],
    ["Cửa hàng", "Số đơn", "Doanh thu thuần", "Giá vốn thuần", "Lợi nhuận"],
    ...report.storePerformance.map((store) => [
      store.storeName,
      store.orderCount,
      store.netSales,
      store.netCost,
      store.netProfit,
    ]),
    [],
    ["Chi nhánh", "Cửa hàng", "Số đơn", "Doanh thu thuần", "Giá vốn thuần", "Lợi nhuận"],
    ...report.branchPerformance.map((branch) => [
      branch.branchName,
      branch.storeName,
      branch.orderCount,
      branch.netSales,
      branch.netCost,
      branch.netProfit,
    ]),
    [],
    ["Sản phẩm", "SKU", "SL ròng", "Doanh thu thuần", "Giá vốn thuần", "Lợi nhuận"],
    ...report.topProducts.map((product) => [
      product.productName,
      product.sku,
      product.quantity,
      product.netSales,
      product.netCost,
      product.netProfit,
    ]),
    [],
    ["Nhân viên", "Số ca", "Số đơn", "Doanh thu gộp", "Hoàn tiền", "Doanh thu thuần", "Giá trị đơn TB"],
    ...report.employeePerformance.map((employee) => [
      employee.employeeName,
      employee.shiftCount,
      employee.orderCount,
      employee.grossSales,
      employee.refunds,
      employee.netSales,
      employee.averageOrderValue,
    ]),
    [],
    ["Mã ca", "Bắt đầu", "Kết thúc", "Chi nhánh", "Thu ngân", "Số đơn", "Doanh thu", "Hoàn tiền", "Doanh thu thuần"],
    ...report.shiftReports.map((shift) => [
      shift.shiftId,
      shift.shiftStart,
      shift.shiftEnd ?? "Đang mở",
      shift.branchName ?? "—",
      shift.cashierName ?? "—",
      shift.totalOrder,
      shift.totalSales,
      shift.totalRefund,
      shift.netSale,
    ]),
  ];
  const content = `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  downloadFile(content, "text/csv;charset=utf-8", `bao-cao-doanh-thu-${report.from}-${report.to}.csv`);
}

function downloadReportExcel(report: SalesReport) {
  const rows = [
    ["Báo cáo doanh thu", `${report.from} đến ${report.to}`],
    [],
    ["Ngày", "Doanh thu gộp", "Hoàn tiền", "Doanh thu thuần", "Giá vốn thuần", "Lợi nhuận", "Số đơn"],
    ...report.dailySales.map((day) => [
      day.date,
      day.grossSales,
      day.refunds,
      day.netSales,
      day.netCost,
      day.netProfit,
      day.orderCount,
    ]),
    [],
    ["Cửa hàng", "Đơn", "Doanh thu thuần", "Giá vốn thuần", "Lợi nhuận"],
    ...report.storePerformance.map((store) => [
      store.storeName,
      store.orderCount,
      store.netSales,
      store.netCost,
      store.netProfit,
    ]),
    [],
    ["Chi nhánh", "Cửa hàng", "Đơn", "Doanh thu thuần", "Giá vốn thuần", "Lợi nhuận"],
    ...report.branchPerformance.map((branch) => [
      branch.branchName,
      branch.storeName,
      branch.orderCount,
      branch.netSales,
      branch.netCost,
      branch.netProfit,
    ]),
    [],
    ["Sản phẩm", "SKU", "SL ròng", "Doanh thu thuần", "Giá vốn thuần", "Lợi nhuận"],
    ...report.topProducts.map((product) => [
      product.productName,
      product.sku,
      product.quantity,
      product.netSales,
      product.netCost,
      product.netProfit,
    ]),
    [],
    ["Nhân viên", "Số ca", "Số đơn", "Doanh thu gộp", "Hoàn tiền", "Doanh thu thuần", "Giá trị đơn TB"],
    ...report.employeePerformance.map((employee) => [
      employee.employeeName,
      employee.shiftCount,
      employee.orderCount,
      employee.grossSales,
      employee.refunds,
      employee.netSales,
      employee.averageOrderValue,
    ]),
    [],
    ["Mã ca", "Bắt đầu", "Kết thúc", "Chi nhánh", "Thu ngân", "Số đơn", "Doanh thu", "Hoàn tiền", "Doanh thu thuần"],
    ...report.shiftReports.map((shift) => [
      shift.shiftId,
      shift.shiftStart,
      shift.shiftEnd ?? "Đang mở",
      shift.branchName ?? "—",
      shift.cashierName ?? "—",
      shift.totalOrder,
      shift.totalSales,
      shift.totalRefund,
      shift.netSale,
    ]),
  ];
  const worksheet = rows
    .map(
      (row) =>
        `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`).join("")}</Row>`,
    )
    .join("");
  const workbook = `<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Báo cáo"><Table>${worksheet}</Table></Worksheet></Workbook>`;
  downloadFile(workbook, "application/vnd.ms-excel;charset=utf-8", `bao-cao-van-hanh-${report.from}-${report.to}.xls`);
}

async function downloadReportPdf(report: SalesReport) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  pdf.setFontSize(14);
  pdf.text(`Báo cáo vận hành ${report.from} đến ${report.to}`, 40, 36);
  pdf.setFontSize(10);
  pdf.text(
    `Doanh thu thuần: ${money.format(report.netSales)}   Giá vốn thuần: ${money.format(report.netCost)}   Lợi nhuận: ${money.format(report.netProfit)}`,
    40,
    51,
  );
  autoTable(pdf, {
    startY: 62,
    head: [["Cửa hàng", "Đơn", "Doanh thu thuần", "Giá vốn thuần", "Lợi nhuận"]],
    body: report.storePerformance.map((store) => [
      store.storeName,
      store.orderCount,
      money.format(store.netSales),
      money.format(store.netCost),
      money.format(store.netProfit),
    ]),
  });
  const storeY = (pdf as typeof pdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 74;
  autoTable(pdf, {
    startY: storeY + 18,
    head: [["Chi nhánh", "Cửa hàng", "Đơn", "Doanh thu thuần", "Giá vốn", "Lợi nhuận"]],
    body: report.branchPerformance.map((branch) => [
      branch.branchName,
      branch.storeName,
      branch.orderCount,
      money.format(branch.netSales),
      money.format(branch.netCost),
      money.format(branch.netProfit),
    ]),
  });
  const branchY = (pdf as typeof pdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? storeY + 30;
  autoTable(pdf, {
    startY: branchY + 18,
    head: [["Sản phẩm", "SKU", "SL ròng", "Doanh thu thuần", "Giá vốn", "Lợi nhuận"]],
    body: report.topProducts.map((product) => [
      product.productName,
      product.sku,
      product.quantity,
      money.format(product.netSales),
      money.format(product.netCost),
      money.format(product.netProfit),
    ]),
  });
  pdf.addPage();
  autoTable(pdf, {
    startY: 40,
    head: [["Nhân viên", "Ca", "Đơn", "Doanh thu thuần", "Giá trị đơn TB"]],
    body: report.employeePerformance.map((employee) => [
      employee.employeeName,
      employee.shiftCount,
      employee.orderCount,
      money.format(employee.netSales),
      money.format(employee.averageOrderValue),
    ]),
  });
  const finalY = (pdf as typeof pdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 52;
  autoTable(pdf, {
    startY: finalY + 26,
    head: [["Bắt đầu", "Kết thúc", "Chi nhánh", "Thu ngân", "Đơn", "Doanh thu thuần"]],
    body: report.shiftReports.map((shift) => [
      new Date(shift.shiftStart).toLocaleString("vi-VN"),
      shift.shiftEnd ? new Date(shift.shiftEnd).toLocaleString("vi-VN") : "Đang mở",
      shift.branchName ?? "—",
      shift.cashierName ?? "—",
      shift.totalOrder,
      money.format(shift.netSale),
    ]),
  });
  pdf.save(`bao-cao-van-hanh-${report.from}-${report.to}.pdf`);
}

function downloadInventoryReportCsv(report: InventoryMovementReport) {
  const rows = [
    ["Ngày", "Lượt biến động", "Nhập kho", "Xuất kho", "Thay đổi ròng"],
    ...report.dailyMovements.map((day) => [
      day.date,
      day.movementCount,
      day.inboundQuantity,
      day.outboundQuantity,
      day.netQuantity,
    ]),
    [],
    ["Sản phẩm", "SKU", "Lượt biến động", "Nhập kho", "Xuất kho", "Thay đổi ròng"],
    ...report.topProducts.map((product) => [
      product.productName,
      product.sku,
      product.movementCount,
      product.inboundQuantity,
      product.outboundQuantity,
      product.netQuantity,
    ]),
  ];
  const content = `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  downloadFile(content, "text/csv;charset=utf-8", `bao-cao-bien-dong-ton-kho-${report.from}-${report.to}.csv`);
}

export function ReportsManagement() {
  const t = useTranslations("Reports");
  const scope = useStoreScope();
  const [from, setFrom] = useState(() => format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const invalidRange = from > to;
  const branches = useQuery({
    queryKey: managementKeys.branches(scope.storeId ?? 0),
    queryFn: () => api<BranchRecord[]>(`/api/branches/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId),
  });

  const effectiveBranchId = scope.branchId ? String(scope.branchId) : selectedBranchId;

  const reportPath = useMemo(() => {
    const search = new URLSearchParams({ from, to });
    if (effectiveBranchId) search.set("branchId", effectiveBranchId);
    if (scope.profile?.role === "ROLE_STORE_ADMIN" && scope.storeId) search.set("storeId", String(scope.storeId));
    return `/api/reports/sales?${search.toString()}`;
  }, [effectiveBranchId, from, scope.profile?.role, scope.storeId, to]);
  const report = useQuery({
    queryKey: ["reports", "sales", from, to, effectiveBranchId],
    queryFn: () => api<SalesReport>(reportPath),
    enabled: Boolean(scope.profile) && !invalidRange,
  });
  const inventoryReportPath = useMemo(() => {
    const search = new URLSearchParams({ from, to });
    if (effectiveBranchId) search.set("branchId", effectiveBranchId);
    return `/api/reports/inventory-movements?${search.toString()}`;
  }, [effectiveBranchId, from, to]);
  const inventoryReport = useQuery({
    queryKey: ["reports", "inventory-movements", from, to, effectiveBranchId],
    queryFn: () => api<InventoryMovementReport>(inventoryReportPath),
    enabled: Boolean(scope.profile) && !invalidRange,
  });

  if (scope.isLoading)
    return (
      <ManagementPage
        title="Báo cáo vận hành"
        description="Tổng hợp doanh thu, tồn kho và vận hành từ dữ liệu giao dịch thực."
      >
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage
        title="Báo cáo vận hành"
        description="Tổng hợp doanh thu, tồn kho và vận hành từ dữ liệu giao dịch thực."
      >
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );

  const data = report.data;
  return (
    <ManagementPage
      title="Báo cáo vận hành"
      description="Số liệu được tổng hợp tại máy chủ theo đúng phạm vi quyền của tài khoản."
    >
      <AdminStoreSelector scope={scope} />
      <Panel title="Bộ lọc báo cáo">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 text-sm font-medium">
            Từ ngày
            <input
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="min-w-48 text-sm font-medium">
            Đến ngày
            <input
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="min-w-56 text-sm font-medium">
            Chi nhánh
            <select
              value={effectiveBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className={fieldClassName}
              disabled={Boolean(scope.branchId) || branches.isPending}
            >
              <option value="">Tất cả chi nhánh trong phạm vi</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          {data ? (
            <SecondaryButton
              type="button"
              className="inline-flex items-center gap-2"
              onClick={() => downloadReportCsv(data)}
            >
              <Download size={16} />
              Xuất CSV doanh thu
            </SecondaryButton>
          ) : null}
          {data ? (
            <SecondaryButton
              type="button"
              className="inline-flex items-center gap-2"
              onClick={() => downloadReportExcel(data)}
            >
              <Download size={16} />
              {t("exportExcel")}
            </SecondaryButton>
          ) : null}
          {data ? (
            <SecondaryButton
              type="button"
              className="inline-flex items-center gap-2"
              onClick={() => {
                void downloadReportPdf(data);
              }}
            >
              <Download size={16} />
              {t("exportPdf")}
            </SecondaryButton>
          ) : null}
          {inventoryReport.data ? (
            <SecondaryButton
              type="button"
              className="inline-flex items-center gap-2"
              onClick={() => downloadInventoryReportCsv(inventoryReport.data!)}
            >
              <Download size={16} />
              Xuất CSV tồn kho
            </SecondaryButton>
          ) : null}
        </div>
        {invalidRange ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            Ngày bắt đầu không được sau ngày kết thúc.
          </p>
        ) : null}
        {branches.isError ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            Không tải được danh sách chi nhánh: {branches.error.message}
          </p>
        ) : null}
      </Panel>

      <section className="mt-6">
        {invalidRange ? (
          <EmptyState>Chọn lại khoảng thời gian để xem báo cáo.</EmptyState>
        ) : report.isPending ? (
          <LoadingState label="Đang tổng hợp báo cáo…" />
        ) : report.isError ? (
          <ErrorState
            message={report.error.message}
            retry={() => {
              void report.refetch();
            }}
          />
        ) : !data ? (
          <EmptyState>Chưa có dữ liệu báo cáo.</EmptyState>
        ) : (
          <ReportContent report={data} />
        )}
      </section>
      <section className="mt-10 border-t border-slate-200 pt-8">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-950">Báo cáo biến động tồn kho</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tổng hợp từ nhật ký nhập, xuất, điều chỉnh và hoàn hàng trong phạm vi quyền của tài khoản.
          </p>
        </div>
        {invalidRange ? (
          <EmptyState>Chọn lại khoảng thời gian để xem báo cáo tồn kho.</EmptyState>
        ) : inventoryReport.isPending ? (
          <LoadingState label="Đang tổng hợp biến động tồn kho…" />
        ) : inventoryReport.isError ? (
          <ErrorState
            message={inventoryReport.error.message}
            retry={() => {
              void inventoryReport.refetch();
            }}
          />
        ) : !inventoryReport.data ? (
          <EmptyState>Chưa có dữ liệu biến động tồn kho.</EmptyState>
        ) : (
          <InventoryReportContent report={inventoryReport.data} />
        )}
      </section>
    </ManagementPage>
  );
}

function ReportContent({ report }: { report: SalesReport }) {
  const metrics = [
    {
      label: "Doanh thu gộp",
      value: money.format(report.grossSales),
      icon: TrendingUp,
      tone: "text-emerald-700 bg-emerald-50",
    },
    { label: "Hoàn tiền", value: money.format(report.refunds), icon: RotateCcw, tone: "text-amber-700 bg-amber-50" },
    {
      label: "Doanh thu thuần",
      value: money.format(report.netSales),
      icon: WalletCards,
      tone: "text-sky-700 bg-sky-50",
    },
    {
      label: "Giá vốn thuần",
      value: money.format(report.netCost),
      icon: Warehouse,
      tone: "text-orange-700 bg-orange-50",
    },
    {
      label: "Lợi nhuận",
      value: money.format(report.netProfit),
      icon: CircleDollarSign,
      tone: report.netProfit >= 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50",
    },
    {
      label: "Đơn hàng",
      value: report.orderCount.toLocaleString("vi-VN"),
      icon: ReceiptText,
      tone: "text-violet-700 bg-violet-50",
    },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`inline-flex rounded-lg p-2 ${metric.tone}`}>
                <Icon size={18} />
              </div>
              <p className="mt-4 text-sm text-slate-500">{metric.label}</p>
              <p className="mt-1 text-2xl font-bold">{metric.value}</p>
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Giá trị đơn trung bình: <strong>{money.format(report.averageOrderValue)}</strong>
      </p>
      <p className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950">
        Lợi nhuận = doanh thu thuần − giá vốn thuần. Hãy cập nhật giá vốn trong hồ sơ sản phẩm; giao dịch trước khi có
        giá vốn được lưu sẽ hiển thị giá vốn 0 và chưa phản ánh đúng lãi thực tế.
      </p>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Doanh thu thuần theo ngày">
          <ChartContainer
            hasData={report.dailySales.some((day) => day.netSales !== 0)}
            empty="Chưa có giao dịch trong khoảng thời gian đã chọn."
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={report.dailySales}>
                <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} />
                <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} width={48} />
                <Tooltip formatter={(value) => money.format(Number(value))} />
                <Line
                  type="monotone"
                  dataKey="netSales"
                  name="Doanh thu thuần"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="netProfit"
                  name="Lợi nhuận"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Panel>
        <Panel title="Doanh thu theo phương thức thanh toán">
          <ChartContainer
            hasData={report.paymentBreakdown.length > 0}
            empty="Chưa có phương thức thanh toán trong khoảng thời gian đã chọn."
          >
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={report.paymentBreakdown} dataKey="amount" nameKey="paymentType" outerRadius={90}>
                  {report.paymentBreakdown.map((entry, index) => (
                    <Cell key={entry.paymentType} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => money.format(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Panel>
        <Panel title="Sản phẩm bán chạy">
          <ChartContainer
            hasData={report.topProducts.length > 0}
            empty="Chưa có sản phẩm bán trong khoảng thời gian đã chọn."
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={report.topProducts} layout="vertical" margin={{ left: 12 }}>
                <XAxis type="number" tickFormatter={(value) => `${Number(value) / 1000}k`} />
                <YAxis type="category" dataKey="productName" width={100} />
                <Tooltip formatter={(value) => money.format(Number(value))} />
                <Bar dataKey="netProfit" name="Lợi nhuận" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Panel>
        <Panel title="Bảng sản phẩm bán chạy">
          {report.topProducts.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Sản phẩm</th>
                    <th className="px-2 py-3 text-right">SL</th>
                    <th className="px-2 py-3 text-right">Doanh thu</th>
                    <th className="px-2 py-3 text-right">Giá vốn</th>
                    <th className="px-2 py-3 text-right">Lợi nhuận</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((product) => (
                    <tr key={product.productId} className="border-b last:border-0">
                      <td className="px-2 py-3">
                        <p className="font-medium">{product.productName}</p>
                        <p className="text-xs text-slate-500">{product.sku}</p>
                      </td>
                      <td className="px-2 py-3 text-right">{product.quantity}</td>
                      <td className="px-2 py-3 text-right">{money.format(product.netSales)}</td>
                      <td className="px-2 py-3 text-right">{money.format(product.netCost)}</td>
                      <td
                        className={`px-2 py-3 text-right font-semibold ${product.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {money.format(product.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Chưa có dữ liệu sản phẩm.</EmptyState>
          )}
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <PerformanceTable
          title="Lợi nhuận theo cửa hàng"
          rows={report.storePerformance.map((store) => ({
            id: `store-${store.storeId}`,
            name: store.storeName,
            orders: store.orderCount,
            sales: store.netSales,
            cost: store.netCost,
            profit: store.netProfit,
          }))}
        />
        <PerformanceTable
          title="Lợi nhuận theo chi nhánh"
          rows={report.branchPerformance.map((branch) => ({
            id: `branch-${branch.branchId}`,
            name: `${branch.branchName} · ${branch.storeName}`,
            orders: branch.orderCount,
            sales: branch.netSales,
            cost: branch.netCost,
            profit: branch.netProfit,
          }))}
        />
      </div>
      <OperationsReportContent report={report} />
    </>
  );
}

function PerformanceTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; name: string; orders: number; sales: number; cost: number; profit: number }>;
}) {
  return (
    <Panel title={title}>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-3">Đơn vị</th>
                <th className="px-2 py-3 text-right">Đơn</th>
                <th className="px-2 py-3 text-right">Doanh thu</th>
                <th className="px-2 py-3 text-right">Giá vốn</th>
                <th className="px-2 py-3 text-right">Lợi nhuận</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-2 py-3 font-medium">{row.name}</td>
                  <td className="px-2 py-3 text-right">{row.orders}</td>
                  <td className="px-2 py-3 text-right">{money.format(row.sales)}</td>
                  <td className="px-2 py-3 text-right">{money.format(row.cost)}</td>
                  <td
                    className={`px-2 py-3 text-right font-semibold ${row.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                  >
                    {money.format(row.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>Chưa có dữ liệu trong kỳ đã chọn.</EmptyState>
      )}
    </Panel>
  );
}

function OperationsReportContent({ report }: { report: SalesReport }) {
  const t = useTranslations("Reports.operations");
  return (
    <section className="mt-10 border-t border-slate-200 pt-8">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-950">{t("title")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("description")}</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t("employeePerformance")}>
          {report.employeePerformance.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-3">{t("employee")}</th>
                    <th className="px-2 py-3 text-right">{t("shifts")}</th>
                    <th className="px-2 py-3 text-right">{t("orders")}</th>
                    <th className="px-2 py-3 text-right">{t("netSales")}</th>
                    <th className="px-2 py-3 text-right">{t("averageOrder")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.employeePerformance.map((employee) => (
                    <tr key={employee.employeeId} className="border-b last:border-0">
                      <td className="px-2 py-3 font-medium">{employee.employeeName}</td>
                      <td className="px-2 py-3 text-right">{employee.shiftCount.toLocaleString("vi-VN")}</td>
                      <td className="px-2 py-3 text-right">{employee.orderCount.toLocaleString("vi-VN")}</td>
                      <td className="px-2 py-3 text-right font-medium">{money.format(employee.netSales)}</td>
                      <td className="px-2 py-3 text-right">{money.format(employee.averageOrderValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>{t("noEmployees")}</EmptyState>
          )}
        </Panel>
        <Panel title={t("shiftDetails")}>
          {report.shiftReports.length ? (
            <div className="max-h-[30rem] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 border-b bg-white text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-3">{t("startedAt")}</th>
                    <th className="px-2 py-3">{t("cashier")}</th>
                    <th className="px-2 py-3">{t("branch")}</th>
                    <th className="px-2 py-3 text-right">{t("orders")}</th>
                    <th className="px-2 py-3 text-right">{t("netSales")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.shiftReports.map((shift) => (
                    <tr key={shift.shiftId} className="border-b last:border-0">
                      <td className="px-2 py-3">
                        <p>{new Date(shift.shiftStart).toLocaleString("vi-VN")}</p>
                        <p className="text-xs text-slate-500">
                          {shift.shiftEnd
                            ? t("endedPrefix", { value: new Date(shift.shiftEnd).toLocaleString("vi-VN") })
                            : t("stillOpen")}
                        </p>
                      </td>
                      <td className="px-2 py-3">{shift.cashierName ?? "—"}</td>
                      <td className="px-2 py-3">{shift.branchName ?? "—"}</td>
                      <td className="px-2 py-3 text-right">{shift.totalOrder}</td>
                      <td className="px-2 py-3 text-right font-medium">{money.format(shift.netSale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>{t("noShifts")}</EmptyState>
          )}
        </Panel>
      </div>
    </section>
  );
}

function InventoryReportContent({ report }: { report: InventoryMovementReport }) {
  const metrics = [
    {
      label: "Nhập kho",
      value: report.inboundQuantity.toLocaleString("vi-VN"),
      icon: TrendingUp,
      tone: "text-emerald-700 bg-emerald-50",
    },
    {
      label: "Xuất kho",
      value: report.outboundQuantity.toLocaleString("vi-VN"),
      icon: TrendingDown,
      tone: "text-rose-700 bg-rose-50",
    },
    {
      label: "Thay đổi ròng",
      value: report.netQuantity.toLocaleString("vi-VN"),
      icon: Warehouse,
      tone: "text-sky-700 bg-sky-50",
    },
    {
      label: "Lượt biến động",
      value: report.movementCount.toLocaleString("vi-VN"),
      icon: ReceiptText,
      tone: "text-violet-700 bg-violet-50",
    },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`inline-flex rounded-lg p-2 ${metric.tone}`}>
                <Icon size={18} />
              </div>
              <p className="mt-4 text-sm text-slate-500">{metric.label}</p>
              <p className="mt-1 text-2xl font-bold">{metric.value}</p>
            </article>
          );
        })}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Nhập và xuất kho theo ngày">
          <ChartContainer
            hasData={report.dailyMovements.some((day) => day.movementCount > 0)}
            empty="Chưa có biến động tồn kho trong khoảng thời gian đã chọn."
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={report.dailyMovements}>
                <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} />
                <YAxis allowDecimals={false} width={44} />
                <Tooltip />
                <Legend />
                <Bar dataKey="inboundQuantity" name="Nhập kho" fill="#0f766e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outboundQuantity" name="Xuất kho" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Panel>
        <Panel title="Phân loại biến động">
          {report.typeBreakdown.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Loại</th>
                    <th className="px-2 py-3 text-right">Lượt</th>
                    <th className="px-2 py-3 text-right">Nhập</th>
                    <th className="px-2 py-3 text-right">Xuất</th>
                    <th className="px-2 py-3 text-right">Ròng</th>
                  </tr>
                </thead>
                <tbody>
                  {report.typeBreakdown.map((item) => (
                    <tr key={item.type} className="border-b last:border-0">
                      <td className="px-2 py-3 font-medium">{movementTypeLabel(item.type)}</td>
                      <td className="px-2 py-3 text-right">{item.movementCount.toLocaleString("vi-VN")}</td>
                      <td className="px-2 py-3 text-right text-emerald-700">
                        +{item.inboundQuantity.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-2 py-3 text-right text-rose-700">
                        -{item.outboundQuantity.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-2 py-3 text-right">{formatSignedQuantity(item.netQuantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Chưa có loại biến động nào.</EmptyState>
          )}
        </Panel>
        <Panel title="Sản phẩm có biến động lớn">
          {report.topProducts.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Sản phẩm</th>
                    <th className="px-2 py-3 text-right">Lượt</th>
                    <th className="px-2 py-3 text-right">Nhập</th>
                    <th className="px-2 py-3 text-right">Xuất</th>
                    <th className="px-2 py-3 text-right">Ròng</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((product) => (
                    <tr key={product.productId} className="border-b last:border-0">
                      <td className="px-2 py-3">
                        <p className="font-medium">{product.productName}</p>
                        <p className="text-xs text-slate-500">{product.sku}</p>
                      </td>
                      <td className="px-2 py-3 text-right">{product.movementCount.toLocaleString("vi-VN")}</td>
                      <td className="px-2 py-3 text-right text-emerald-700">
                        +{product.inboundQuantity.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-2 py-3 text-right text-rose-700">
                        -{product.outboundQuantity.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-2 py-3 text-right">{formatSignedQuantity(product.netQuantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Chưa có sản phẩm có biến động.</EmptyState>
          )}
        </Panel>
      </div>
    </>
  );
}

function movementTypeLabel(type: string) {
  const labels: Record<string, string> = {
    INITIAL_STOCK: "Tồn đầu kỳ",
    ADJUSTMENT: "Điều chỉnh",
    SALE: "Bán hàng",
    REFUND: "Hoàn hàng",
    REMOVAL: "Xuất/huỷ kho",
  };
  return labels[type] ?? type;
}

function formatSignedQuantity(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("vi-VN")}`;
}

function ChartContainer({ hasData, empty, children }: { hasData: boolean; empty: string; children: React.ReactNode }) {
  return hasData ? <div className="mt-2 min-w-0">{children}</div> : <EmptyState>{empty}</EmptyState>;
}
