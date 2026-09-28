"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { isUserRole, roleHome } from "@/lib/auth/roles";

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    phone: z.string().trim().max(30),
    password: z.string().min(8).max(100),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "passwordMismatch",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

function responseMessage(data: unknown) {
  return typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
    ? data.message
    : undefined;
}

export default function SignupPage() {
  const router = useRouter();
  const locale = useLocale() as "vi" | "en";
  const t = useTranslations("Auth");
  const common = useTranslations("Common");
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", phone: "", password: "", confirmPassword: "" },
  });

  async function submit(values: SignupValues) {
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          phone: values.phone || null,
          password: values.password,
        }),
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
      toast.success(t("signupSuccess"));
      router.replace(roleHome(role, locale));
      router.refresh();
    } catch {
      toast.error(t("backendUnavailable"));
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <form
        onSubmit={form.handleSubmit(submit)}
        className="w-full max-w-md space-y-4 rounded-xl bg-white p-8 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{common("appName")}</h1>
            <p className="text-sm text-slate-600">{t("createAccount")}</p>
          </div>
          <LocaleSwitcher />
        </div>
        <label className="block text-sm font-medium">
          {t("fullName")}
          <input autoComplete="name" className="mt-1 w-full rounded-md border p-2" {...form.register("fullName")} />
        </label>
        {form.formState.errors.fullName && (
          <p role="alert" className="-mt-2 text-sm text-rose-600">
            {locale === "vi" ? "Họ tên cần ít nhất 2 ký tự" : "Enter at least 2 characters"}
          </p>
        )}
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
          <p role="alert" className="-mt-2 text-sm text-rose-600">
            {locale === "vi" ? "Email không hợp lệ" : "Enter a valid email"}
          </p>
        )}
        <label className="block text-sm font-medium">
          {t("phone")}
          <input
            type="tel"
            autoComplete="tel"
            className="mt-1 w-full rounded-md border p-2"
            {...form.register("phone")}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("password")}
          <input
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border p-2"
            {...form.register("password")}
          />
        </label>
        {form.formState.errors.password && (
          <p role="alert" className="-mt-2 text-sm text-rose-600">
            {locale === "vi" ? "Mật khẩu cần từ 8 đến 100 ký tự" : "Password must contain 8–100 characters"}
          </p>
        )}
        <label className="block text-sm font-medium">
          {t("confirmPassword")}
          <input
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border p-2"
            {...form.register("confirmPassword")}
          />
        </label>
        {form.formState.errors.confirmPassword && (
          <p role="alert" className="-mt-2 text-sm text-rose-600">
            {t("passwordMismatch")}
          </p>
        )}
        <button
          disabled={form.formState.isSubmitting}
          className="w-full rounded-md bg-slate-900 p-2 font-medium text-white disabled:opacity-60"
        >
          {form.formState.isSubmitting ? t("signingUp") : t("signup")}
        </button>
        <Link className="block text-center text-sm underline" href={`/${locale}/login`}>
          {t("alreadyHaveAccount")}
        </Link>
      </form>
    </main>
  );
}
