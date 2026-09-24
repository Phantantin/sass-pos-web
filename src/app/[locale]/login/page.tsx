"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { isUserRole, roleHome } from "@/lib/auth/roles";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
type LoginValues = z.infer<typeof loginSchema>;

function responseMessage(data: unknown) {
  return typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
    ? data.message
    : undefined;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale() as "vi" | "en";
  const t = useTranslations("Auth");
  const common = useTranslations("Common");
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  async function submit(values: LoginValues) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(responseMessage(data) ?? t("failed"));
      return;
    }
    const role =
      typeof data === "object" &&
      data !== null &&
      "user" in data &&
      typeof data.user === "object" &&
      data.user !== null &&
      "role" in data.user
        ? data.user.role
        : null;
    if (!isUserRole(role)) {
      toast.error(t("unknownRole"));
      return;
    }
    const requestedPath = searchParams.get("next");
    const safeNext = requestedPath?.startsWith(`/${locale}/`) ? requestedPath : null;
    toast.success(t("success"));
    router.replace(safeNext ?? roleHome(role, locale));
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <form
        onSubmit={form.handleSubmit(submit)}
        className="w-full max-w-md space-y-5 rounded-xl bg-white p-8 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{common("appName")}</h1>
            <p className="text-sm text-slate-600">{t("title")}</p>
          </div>
          <LocaleSwitcher />
        </div>
        <label className="block text-sm font-medium">
          {t("email")}
          <input
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded-md border p-2"
            {...form.register("email")}
          />
        </label>
        {form.formState.errors.email && (
          <p role="alert" className="-mt-3 text-sm text-rose-600">
            {locale === "vi" ? "Email không hợp lệ" : "Enter a valid email"}
          </p>
        )}
        <label className="block text-sm font-medium">
          {t("password")}
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border p-2"
            {...form.register("password")}
          />
        </label>
        {form.formState.errors.password && (
          <p role="alert" className="-mt-3 text-sm text-rose-600">
            {locale === "vi" ? "Cần nhập mật khẩu" : "Password is required"}
          </p>
        )}
        <button
          disabled={form.formState.isSubmitting}
          className="w-full rounded-md bg-slate-900 p-2 font-medium text-white disabled:opacity-60"
        >
          {form.formState.isSubmitting ? t("submitting") : t("submit")}
        </button>
        <Link className="block text-center text-sm underline" href={`/${locale}/signup`}>
          {t("newHere")}
        </Link>
      </form>
    </main>
  );
}
