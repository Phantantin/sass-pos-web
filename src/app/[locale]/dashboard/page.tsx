"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  PackageSearch,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/lib/api/client";
import { can, roleTitle } from "@/lib/auth/roles";
import type { CurrentUser, DashboardOverview } from "@/types/api";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export default function DashboardPage() {
  const locale = useLocale() as "vi" | "en";
  const t = useTranslations("Dashboard");
  const user = useQuery({ queryKey: ["current-user"], queryFn: () => api<CurrentUser>("/api/users/profile") });
  const needsStoreOnboarding = user.data?.role === "ROLE_STORE_ADMIN" && !user.data.storeId;
  const overview = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => api<DashboardOverview>("/api/dashboard/overview"),
    enabled: Boolean(user.data) && !needsStoreOnboarding,
  });

  if (user.isPending || (!needsStoreOnboarding && overview.isPending))
    return (
      <main className="p-6">
        <p>Đang tải tổng quan…</p>
      </main>
    );
  if (user.isError || !user.data || (!needsStoreOnboarding && (overview.isError || !overview.data)))
    return (
      <main className="p-6">
        <p>Không tải được dữ liệu tổng quan.</p>
        <button
          type="button"
          className="mt-3 underline"
          onClick={() => {
            void user.refetch();
            void overview.refetch();
          }}
        >
          Thử lại
        </button>
      </main>
    );
  if (needsStoreOnboarding)
    return (
      <main className="p-4 sm:p-6">
        <section className="mx-auto max-w-2xl rounded-xl border bg-white p-6 shadow-sm">
          <Building2 className="rounded-lg bg-slate-100 p-2 text-slate-700" size={42} />
          <p className="mt-5 text-sm font-medium text-slate-500">{roleTitle(user.data.role, locale)}</p>
          <h1 className="mt-1 text-2xl font-bold">Xin chào, {user.data.fullName}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Tài khoản chủ cửa hàng của bạn chưa được gắn với cửa hàng nào. Hãy tạo cửa hàng đầu tiên để mở quản lý chi
            nhánh, sản phẩm và bán hàng.
          </p>
          <Link
            href={`/${locale}/store`}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Tạo cửa hàng <ArrowRight size={17} />
          </Link>
        </section>
      </main>
    );
  const dashboard = overview.data;
  if (!dashboard)
    return (
      <main className="p-6">
        <p>Không tải được dữ liệu tổng quan.</p>
      </main>
    );

  const cards = [
    {
      label: "Doanh thu hôm nay",
      value: money.format(dashboard.salesToday),
      icon: Banknote,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Đơn hàng hôm nay",
      value: dashboard.ordersToday.toLocaleString("vi-VN"),
      icon: ReceiptText,
      color: "bg-sky-50 text-sky-700",
    },
    {
      label: "Hoàn tiền hôm nay",
      value: money.format(dashboard.refundsToday),
      icon: RotateCcw,
      color: "bg-amber-50 text-amber-700",
    },
    {
      label: "Sắp hết hàng",
      value: dashboard.lowStockItems.toLocaleString("vi-VN"),
      icon: AlertTriangle,
      color: "bg-rose-50 text-rose-700",
    },
  ];

  return (
    <main className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{t("greeting")}</p>
          <h1 className="text-2xl font-bold">{user.data.fullName}</h1>
          <p className="mt-1 inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {roleTitle(user.data.role, locale)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Doanh thu thuần hôm nay: <strong>{money.format(dashboard.netSalesToday)}</strong>
          </p>
        </div>
        {can(user.data.role, "pos") && (
          <Link
            href={`/${locale}/pos`}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <ShoppingCart size={17} />
            {t("posTitle")}
          </Link>
        )}
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className={`mb-4 inline-flex rounded-lg p-2 ${card.color}`}>
                <Icon size={20} />
              </div>
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-1 text-2xl font-bold">{card.value}</p>
            </article>
          );
        })}
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Đơn hàng gần đây</h2>
              <p className="text-sm text-slate-500">Dữ liệu theo phạm vi quyền tài khoản hiện tại.</p>
            </div>
          </div>
          {dashboard.recentOrders.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Mã đơn</th>
                    <th className="px-2 py-3">Khách hàng</th>
                    <th className="px-2 py-3">Thanh toán</th>
                    <th className="px-2 py-3 text-right">Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="px-2 py-3">
                        <p className="font-medium">#{order.id}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(order.createdAt).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}
                        </p>
                      </td>
                      <td className="px-2 py-3">{order.customer?.fullName ?? "Khách lẻ"}</td>
                      <td className="px-2 py-3">{order.paymentType}</td>
                      <td className="px-2 py-3 text-right font-medium">{money.format(order.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-5 rounded-lg border border-dashed p-5 text-sm text-slate-500">
              Chưa có đơn hàng nào trong hôm nay.
            </p>
          )}
        </article>
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <PackageSearch className="text-slate-700" />
          <h2 className="mt-4 font-semibold">Tồn kho và vận hành</h2>
          <p className="mt-2 text-sm text-slate-600">
            Theo dõi hàng sắp hết, điều chỉnh tồn kho có lý do và xem lịch sử biến động theo chi nhánh.
          </p>
          {can(user.data.role, "inventory") && (
            <Link
              href={`/${locale}/inventory`}
              className="mt-5 inline-flex items-center gap-1 text-sm font-semibold underline"
            >
              Mở quản lý tồn kho <ArrowRight size={15} />
            </Link>
          )}
        </article>
      </section>
    </main>
  );
}
