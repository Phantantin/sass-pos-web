import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";

export function ManagementPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-sky-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-l-4 border-indigo-500 pl-4">
          <h1 className="bg-gradient-to-r from-slate-950 to-indigo-700 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </header>
        {children}
      </div>
    </main>
  );
}

export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-indigo-100/80 bg-white/95 p-5 shadow-sm shadow-indigo-100/60 backdrop-blur ${className}`}
    >
      {title ? <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2> : null}
      {children}
    </section>
  );
}

export function LoadingState({ label = "Đang tải dữ liệu…" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-600">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>{message}</p>
          {retry ? (
            <button type="button" onClick={retry} className="mt-2 font-semibold underline">
              Thử lại
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-600">{children}</p>;
}

export function PrimaryButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function SecondaryButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function DangerButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  return children ? (
    <p role="alert" className="mt-1 text-xs text-red-700">
      {children}
    </p>
  ) : null;
}

export const fieldClassName =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 transition focus:border-indigo-400 focus:ring-2 disabled:bg-slate-100";
