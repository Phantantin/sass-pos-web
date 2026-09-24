"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  function changeLocale(nextLocale: AppLocale) {
    if (nextLocale === locale) return;
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div className="inline-flex items-center rounded-md border bg-white p-0.5 text-sm" aria-label="Chọn ngôn ngữ">
      <Languages size={15} className="mx-1.5 text-slate-500" aria-hidden="true" />
      {routing.locales.map((candidate) => (
        <button
          key={candidate}
          type="button"
          onClick={() => changeLocale(candidate)}
          aria-pressed={candidate === locale}
          className={
            candidate === locale
              ? "rounded px-2 py-1 font-medium bg-slate-900 text-white"
              : "rounded px-2 py-1 text-slate-600 hover:bg-slate-100"
          }
        >
          {candidate.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
