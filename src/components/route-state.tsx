"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { AlertTriangle, FileQuestion, LoaderCircle, RotateCcw } from "lucide-react";

type RouteLocale = "vi" | "en";

type RouteContent = {
  errorTitle: string;
  errorDescription: string;
  loadingTitle: string;
  loadingDescription: string;
  notFoundTitle: string;
  notFoundDescription: string;
  retry: string;
  signIn: string;
};

const content: Record<RouteLocale, RouteContent> = {
  vi: {
    errorTitle: "Không thể tải trang này",
    errorDescription: "Đã xảy ra lỗi tạm thời. Bạn có thể thử lại hoặc đăng nhập lại để tiếp tục.",
    loadingTitle: "Đang chuẩn bị trang",
    loadingDescription: "Vui lòng chờ trong giây lát.",
    notFoundTitle: "Không tìm thấy trang",
    notFoundDescription: "Đường dẫn này không tồn tại hoặc bạn không còn quyền truy cập.",
    retry: "Thử lại",
    signIn: "Đi đến đăng nhập",
  },
  en: {
    errorTitle: "This page could not be loaded",
    errorDescription: "A temporary error occurred. Try again or sign in again to continue.",
    loadingTitle: "Preparing your page",
    loadingDescription: "Please wait a moment.",
    notFoundTitle: "Page not found",
    notFoundDescription: "This address does not exist or you no longer have access to it.",
    retry: "Try again",
    signIn: "Go to sign in",
  },
};

function useRouteLocale(): RouteLocale {
  const params = useParams<{ locale?: string | string[] }>();
  const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
  return locale === "en" ? "en" : "vi";
}

export function RouteLoadingState() {
  const locale = useRouteLocale();
  const copy = content[locale];

  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="grid min-h-[calc(100vh-3.5rem)] place-items-center bg-slate-50 p-6 text-center"
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin text-slate-700" />
        <p className="mt-3 font-semibold text-slate-950">{copy.loadingTitle}</p>
        <p className="mt-1 text-sm text-slate-600">{copy.loadingDescription}</p>
        <div aria-hidden="true" className="mt-5 space-y-2 animate-pulse">
          <div className="h-2 rounded bg-slate-200" />
          <div className="h-2 w-4/5 rounded bg-slate-200" />
        </div>
      </div>
    </main>
  );
}

export function RouteErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useRouteLocale();
  const copy = content[locale];

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("Route rendering failed", error);
    }
  }, [error]);

  return (
    <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center bg-slate-50 p-6 text-center">
      <section
        role="alert"
        aria-live="assertive"
        className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-6 shadow-sm"
      >
        <AlertTriangle aria-hidden="true" className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-3 text-lg font-bold text-slate-950">{copy.errorTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{copy.errorDescription}</p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <RotateCcw aria-hidden="true" size={16} />
            {copy.retry}
          </button>
          <Link
            href={`/${locale}/login`}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {copy.signIn}
          </Link>
        </div>
      </section>
    </main>
  );
}

export function RouteNotFoundState() {
  const locale = useRouteLocale();
  const copy = content[locale];

  return (
    <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center bg-slate-50 p-6 text-center">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <FileQuestion aria-hidden="true" className="mx-auto h-9 w-9 text-slate-500" />
        <p className="mt-3 text-sm font-semibold tracking-[0.2em] text-slate-500">404</p>
        <h1 className="mt-2 text-lg font-bold text-slate-950">{copy.notFoundTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{copy.notFoundDescription}</p>
        <Link
          href={`/${locale}/login`}
          className="mt-5 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {copy.signIn}
        </Link>
      </section>
    </main>
  );
}
