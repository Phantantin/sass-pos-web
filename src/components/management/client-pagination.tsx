"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SecondaryButton } from "./ui";

export function useClientPagination<T>(items: readonly T[], pageSize = 12) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = useMemo(
    () => items.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
    [items, currentPage, pageSize],
  );
  return { page: currentPage, setPage, totalPages, totalItems: items.length, pageItems };
}

export function ClientPagination({
  page,
  setPage,
  totalPages,
  totalItems,
  label = "mục",
}: {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  totalItems: number;
  label?: string;
}) {
  if (totalItems <= 0) return null;
  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4" aria-label="Phân trang">
      <p className="text-sm text-slate-600">
        {totalItems.toLocaleString("vi-VN")} {label} · Trang {page + 1}/{totalPages}
      </p>
      <div className="flex gap-2">
        <SecondaryButton type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> <span className="sr-only">Trang trước</span>
        </SecondaryButton>
        <SecondaryButton type="button" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
          <ChevronRight className="h-4 w-4" /> <span className="sr-only">Trang sau</span>
        </SecondaryButton>
      </div>
    </nav>
  );
}
