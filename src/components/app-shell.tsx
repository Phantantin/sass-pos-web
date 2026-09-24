"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  BarChart3,
  Building2,
  CalendarClock,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  ScrollText,
  Tags,
  Users,
  Warehouse,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { can, roleTitle } from "@/lib/auth/roles";
import { api } from "@/lib/api/client";
import type { CurrentUser } from "@/types/api";

type NavigationItem = { href: string; label: string; icon: typeof LayoutDashboard; permission?: string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as "vi" | "en";
  const t = useTranslations("Common");
  const isPublic = pathname.endsWith("/login") || pathname.endsWith("/signup");
  const isPos = pathname.includes("/pos");
  const profile = useQuery({
    queryKey: ["current-user"],
    queryFn: () => api<CurrentUser>("/api/users/profile"),
    enabled: !isPublic,
    retry: false,
  });
  const transferNotifications = useQuery({
    queryKey: ["management", "inventory-transfers"],
    queryFn: () => api<Array<{ status: string; canApprove: boolean }>>("/api/inventory-transfers"),
    enabled: Boolean(profile.data && can(profile.data.role, "transfer")),
    refetchInterval: 15_000,
  });

  if (isPublic || isPos) return <>{children}</>;
  if (profile.isPending)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600">{t("loading")}</main>
    );
  if (profile.isError || !profile.data)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center">
        <div>
          <p className="font-medium">{t("sessionVerificationFailed")}</p>
          <button type="button" className="mt-3 underline" onClick={() => router.replace(`/${locale}/login`)}>
            {t("signInAgain")}
          </button>
        </div>
      </main>
    );

  const pendingTransferCount =
    transferNotifications.data?.filter((request) => request.status === "PENDING" && request.canApprove).length ?? 0;
  const currentRoleTitle = roleTitle(profile.data.role, locale);
  const navigation: NavigationItem[] = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/store", label: t("store"), icon: Building2, permission: "store" },
    { href: "/branches", label: t("branches"), icon: Building2, permission: "branch" },
    { href: "/employees", label: t("employees"), icon: Users, permission: "employee" },
    { href: "/workforce", label: t("workforce"), icon: CalendarClock, permission: "workforce" },
    { href: "/categories", label: t("categories"), icon: Tags, permission: "category" },
    { href: "/products", label: t("products"), icon: Package, permission: "product" },
    { href: "/inventory", label: t("inventory"), icon: Warehouse, permission: "inventory" },
    {
      href: "/inventory-transfers",
      label: `${t("inventoryTransfers")}${pendingTransferCount ? ` (${pendingTransferCount})` : ""}`,
      icon: ArrowRightLeft,
      permission: "transfer",
    },
    { href: "/customers", label: t("customers"), icon: Users, permission: "customer" },
    { href: "/orders", label: t("orders"), icon: Package, permission: "order" },
    { href: "/refunds", label: t("refunds"), icon: Package, permission: "refund" },
    { href: "/shifts", label: t("shifts"), icon: Warehouse, permission: "shift" },
    { href: "/reports", label: t("reports"), icon: BarChart3, permission: "report" },
    { href: "/subscriptions", label: t("subscriptions"), icon: CreditCard, permission: "subscription" },
    { href: "/audit-logs", label: t("auditLogs"), icon: ScrollText, permission: "audit" },
  ].filter((item) => !item.permission || can(profile.data.role, item.permission));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace(`/${locale}/login`);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-100 md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white shadow-xl md:flex md:flex-col">
        <Link
          href={`/${locale}/dashboard`}
          className="border-b border-white/10 px-5 py-5 text-lg font-bold tracking-wide"
        >
          <span className="bg-gradient-to-r from-sky-300 to-indigo-300 bg-clip-text text-transparent">
            {t("appName")}
          </span>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navigation.map((item) => (
            <NavigationLink key={item.href} item={item} locale={locale} pathname={pathname} />
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <p className="truncate px-2 text-sm font-semibold">{profile.data.fullName}</p>
          <p className="truncate px-2 text-xs font-medium text-sky-300">{currentRoleTitle}</p>
          <p className="truncate px-2 text-xs text-slate-400">{profile.data.email}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            <LogOut size={16} />
            {t("logout")}
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-indigo-100 bg-white/90 px-4 shadow-sm backdrop-blur md:px-6">
          <Link href={`/${locale}/dashboard`} className="font-bold text-indigo-700 md:hidden">
            {t("appName")}
          </Link>
          <div className="ml-auto min-w-0 text-right">
            <p className="truncate text-sm font-semibold">{profile.data.fullName}</p>
            <p className="truncate text-xs text-indigo-600">{currentRoleTitle}</p>
          </div>
          <LocaleSwitcher />
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b bg-white px-2 py-2 md:hidden">
          {navigation.map((item) => (
            <NavigationLink key={item.href} item={item} locale={locale} pathname={pathname} compact />
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}

function NavigationLink({
  item,
  locale,
  pathname,
  compact = false,
}: {
  item: NavigationItem;
  locale: "vi" | "en";
  pathname: string;
  compact?: boolean;
}) {
  const href = `/${locale}${item.href}`;
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const Icon = item.icon;
  const className = active
    ? "flex shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
    : compact
      ? "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
      : "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white";
  return (
    <Link href={href} className={className}>
      <Icon size={16} />
      {item.label}
      {!compact && active ? <ChevronRight className="ml-auto" size={15} /> : null}
    </Link>
  );
}
