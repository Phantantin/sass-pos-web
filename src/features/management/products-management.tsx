"use client";
/* eslint-disable @next/next/no-img-element -- Existing product records can contain legacy image URLs from arbitrary hosts. */

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Pencil, Search, Trash2, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "@/lib/api/client";
import { useUploadThing } from "@/lib/uploadthing";
import { ClientPagination, useClientPagination } from "@/components/management/client-pagination";
import {
  DangerButton,
  EmptyState,
  ErrorState,
  FieldError,
  LoadingState,
  ManagementPage,
  Panel,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
} from "@/components/management/ui";
import { canManageProducts, managementKeys, useStoreScope } from "./use-store-scope";
import { AdminStoreSelector } from "./admin-store-selector";
import type { CategoryRecord, ProductRecord } from "./types";

const moneyInput = z
  .string()
  .trim()
  .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, "Nhập số tiền từ 0 trở lên");
const productSchema = z.object({
  name: z.string().trim().min(2, "Tên sản phẩm cần ít nhất 2 ký tự").max(180),
  sku: z.string().trim().min(1, "SKU là bắt buộc").max(80),
  description: z.string().trim().max(1000, "Mô tả không được vượt quá 1000 ký tự"),
  mrp: moneyInput,
  costPrice: moneyInput,
  sellingPrice: moneyInput,
  brand: z.string().trim().max(120),
  image: z.string().trim().max(2048),
  categoryId: z.string().min(1, "Hãy chọn danh mục"),
});
type ProductFormValues = z.infer<typeof productSchema>;
const defaults: ProductFormValues = {
  name: "",
  sku: "",
  description: "",
  mrp: "0",
  costPrice: "0",
  sellingPrice: "0",
  brand: "",
  image: "",
  categoryId: "",
};
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export function ProductsManagement() {
  const scope = useStoreScope();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [search, setSearch] = useState("");
  const [localImagePreview, setLocalImagePreview] = useState<string | null>(null);
  const form = useForm<ProductFormValues>({ resolver: zodResolver(productSchema), defaultValues: defaults });
  const productImage = useWatch({ control: form.control, name: "image" });
  const { startUpload, isUploading } = useUploadThing("productImage");
  const categories = useQuery({
    queryKey: managementKeys.categories(scope.storeId ?? 0),
    queryFn: () => api<CategoryRecord[]>(`/api/categories/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId),
  });
  const products = useQuery({
    queryKey: managementKeys.products(scope.storeId ?? 0),
    queryFn: () => api<ProductRecord[]>(`/api/products/store/${scope.storeId}`),
    enabled: Boolean(scope.storeId),
  });
  const displayedProducts = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return products.data ?? [];
    return (products.data ?? []).filter((product) =>
      `${product.name} ${product.sku} ${product.brand ?? ""} ${product.category?.name ?? ""}`
        .toLocaleLowerCase("vi")
        .includes(keyword),
    );
  }, [products.data, search]);
  const productPagination = useClientPagination(displayedProducts, 10);
  const canEditCatalog = canManageProducts(scope.profile);
  const save = useMutation({
    mutationFn: (values: ProductFormValues) =>
      api<ProductRecord>(editing ? `/api/products/${editing.id}` : "/api/products", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          sku: values.sku,
          description: values.description || null,
          mrp: Number(values.mrp),
          costPrice: Number(values.costPrice),
          sellingPrice: Number(values.sellingPrice),
          brand: values.brand || null,
          image: values.image || null,
          categoryId: Number(values.categoryId),
          storeId: scope.storeId,
        }),
      }),
    onSuccess: (product) => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.products(scope.storeId!) });
      void queryClient.invalidateQueries({ queryKey: ["management", "inventory-catalog"] });
      toast.success(
        product.catalogStatus === "PENDING"
          ? "Đã lưu và gửi HQ duyệt catalog"
          : editing
            ? "Đã cập nhật sản phẩm"
            : "Đã tạo sản phẩm",
      );
      setEditing(null);
      setLocalImagePreview(null);
      form.reset(defaults);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/api/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.products(scope.storeId!) });
      void queryClient.invalidateQueries({ queryKey: ["management", "inventory"] });
      toast.success("Đã xóa sản phẩm");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "APPROVED" | "REJECTED" }) =>
      api<ProductRecord>(`/api/products/${id}/catalog-status?status=${status}`, { method: "PUT" }),
    onSuccess: (product) => {
      void queryClient.invalidateQueries({ queryKey: managementKeys.products(scope.storeId!) });
      void queryClient.invalidateQueries({ queryKey: ["management", "inventory-catalog"] });
      toast.success(
        product.catalogStatus === "APPROVED" ? "Đã duyệt sản phẩm vào catalog dùng chung" : "Đã từ chối sản phẩm",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
  function startEdit(product: ProductRecord) {
    setEditing(product);
    setLocalImagePreview(null);
    form.reset({
      name: product.name,
      sku: product.sku,
      description: product.description ?? "",
      mrp: String(product.mrp),
      costPrice: String(product.costPrice ?? 0),
      sellingPrice: String(product.sellingPrice),
      brand: product.brand ?? "",
      image: product.image ?? "",
      categoryId: String(product.categoryId ?? product.category?.id ?? ""),
    });
  }
  function cancelEdit() {
    setEditing(null);
    setLocalImagePreview(null);
    form.reset(defaults);
  }
  async function uploadProductImage(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Chỉ chấp nhận ảnh PNG, JPG hoặc WEBP");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Ảnh không được vượt quá 4 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLocalImagePreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    try {
      const uploadedFiles = await startUpload([file]);
      const url = uploadedFiles?.[0]?.serverData?.url ?? uploadedFiles?.[0]?.ufsUrl;
      if (!url) throw new Error("Máy chủ tải ảnh không trả về URL hợp lệ");
      form.setValue("image", url, { shouldDirty: true, shouldValidate: true });
      setLocalImagePreview(null);
      toast.success("Đã tải ảnh sản phẩm");
    } catch (error) {
      setLocalImagePreview(null);
      toast.error(error instanceof Error ? error.message : "Không thể tải ảnh lên");
    }
  }

  if (scope.isLoading)
    return (
      <ManagementPage title="Sản phẩm" description="Catalog sản phẩm, SKU và giá bán được dùng khi tạo đơn.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage title="Sản phẩm" description="Catalog sản phẩm, SKU và giá bán được dùng khi tạo đơn.">
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );
  if (!scope.storeId)
    return (
      <ManagementPage title="Sản phẩm" description="Catalog sản phẩm, SKU và giá bán được dùng khi tạo đơn.">
        <EmptyState>Hãy tạo hoặc được gán vào cửa hàng trước khi quản lý sản phẩm.</EmptyState>
      </ManagementPage>
    );

  return (
    <ManagementPage
      title="Sản phẩm"
      description="Giá trong đơn hàng được lấy từ máy chủ, không tin cậy giá gửi từ trình duyệt."
    >
      <AdminStoreSelector scope={scope} />
      <div className={canEditCatalog ? "grid gap-6 2xl:grid-cols-[minmax(0,1fr)_430px]" : "grid gap-6"}>
        <Panel title="Catalog sản phẩm">
          <label className="relative mb-4 block max-w-lg">
            <span className="sr-only">Tìm sản phẩm</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                productPagination.setPage(0);
              }}
              className={`${fieldClassName} mt-0 pl-9`}
              placeholder="Tìm theo tên, SKU, nhãn hàng hoặc danh mục"
            />
          </label>
          {products.isPending ? (
            <LoadingState />
          ) : products.isError ? (
            <ErrorState
              message={products.error.message}
              retry={() => {
                void products.refetch();
              }}
            />
          ) : displayedProducts.length ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {productPagination.pageItems.map((product) => (
                  <article key={product.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="aspect-[4/3] bg-slate-100">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-slate-400">
                          <ImagePlus className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">{product.name}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {product.sku}
                            {product.brand ? ` · ${product.brand}` : ""}
                          </p>
                          <span
                            className={
                              product.catalogStatus === "APPROVED"
                                ? "mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
                                : product.catalogStatus === "REJECTED"
                                  ? "mt-2 inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800"
                                  : "mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"
                            }
                          >
                            {product.catalogStatus === "APPROVED"
                              ? "Đã duyệt dùng chung"
                              : product.catalogStatus === "REJECTED"
                                ? "Đã từ chối"
                                : "Chờ HQ duyệt"}
                          </span>
                        </div>
                        {canEditCatalog ? (
                          <div className="flex shrink-0 gap-1">
                            <SecondaryButton
                              type="button"
                              aria-label={`Sửa ${product.name}`}
                              onClick={() => startEdit(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </SecondaryButton>
                            <DangerButton
                              type="button"
                              aria-label={`Xóa ${product.name}`}
                              disabled={remove.isPending}
                              onClick={() => {
                                if (window.confirm(`Xóa sản phẩm “${product.name}”?`)) remove.mutate(product.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </DangerButton>
                          </div>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm text-slate-600">{product.category?.name ?? "Chưa có danh mục"}</p>
                      <p className="mt-3 font-semibold">{money.format(product.sellingPrice)}</p>
                      <p className="text-xs text-slate-500">Giá niêm yết: {money.format(product.mrp)}</p>
                      {scope.profile?.role === "ROLE_ADMIN" ? (
                        <div className="mt-3 flex gap-2">
                          {product.catalogStatus !== "APPROVED" ? (
                            <PrimaryButton
                              type="button"
                              disabled={moderate.isPending}
                              onClick={() => moderate.mutate({ id: product.id, status: "APPROVED" })}
                            >
                              Duyệt
                            </PrimaryButton>
                          ) : null}
                          {product.catalogStatus !== "REJECTED" ? (
                            <DangerButton
                              type="button"
                              disabled={moderate.isPending}
                              onClick={() => moderate.mutate({ id: product.id, status: "REJECTED" })}
                            >
                              Từ chối
                            </DangerButton>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
              <ClientPagination {...productPagination} label="sản phẩm" />
            </>
          ) : (
            <EmptyState>{search ? "Không tìm thấy sản phẩm phù hợp." : "Chưa có sản phẩm nào."}</EmptyState>
          )}
        </Panel>
        {canEditCatalog ? (
          <Panel title={editing ? `Sửa: ${editing.name}` : "Thêm sản phẩm"}>
            {categories.isPending ? (
              <LoadingState label="Đang tải danh mục…" />
            ) : categories.isError ? (
              <ErrorState message={categories.error.message} />
            ) : !categories.data?.length ? (
              <EmptyState>Hãy tạo ít nhất một danh mục trước khi thêm sản phẩm.</EmptyState>
            ) : (
              <form className="space-y-3" noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))}>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    Tên sản phẩm
                    <input {...form.register("name")} className={fieldClassName} />
                    <FieldError>{form.formState.errors.name?.message}</FieldError>
                  </label>
                  <label>
                    SKU
                    <input {...form.register("sku")} className={fieldClassName} />
                    <FieldError>{form.formState.errors.sku?.message}</FieldError>
                  </label>
                </div>
                <label className="block">
                  Danh mục
                  <select {...form.register("categoryId")} className={fieldClassName}>
                    <option value="">Chọn danh mục</option>
                    {categories.data.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <FieldError>{form.formState.errors.categoryId?.message}</FieldError>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label>
                    Giá vốn
                    <input {...form.register("costPrice")} className={fieldClassName} type="number" min="0" step="1" />
                    <FieldError>{form.formState.errors.costPrice?.message}</FieldError>
                  </label>
                  <label>
                    Giá niêm yết
                    <input {...form.register("mrp")} className={fieldClassName} type="number" min="0" step="1" />
                    <FieldError>{form.formState.errors.mrp?.message}</FieldError>
                  </label>
                  <label>
                    Giá bán
                    <input
                      {...form.register("sellingPrice")}
                      className={fieldClassName}
                      type="number"
                      min="0"
                      step="1"
                    />
                    <FieldError>{form.formState.errors.sellingPrice?.message}</FieldError>
                  </label>
                </div>
                <label className="block">
                  Nhãn hàng
                  <input {...form.register("brand")} className={fieldClassName} />
                </label>
                <div>
                  <p className="text-sm font-medium">Ảnh sản phẩm</p>
                  <div className="mt-1 rounded-md border border-dashed border-slate-300 p-3">
                    {localImagePreview || productImage ? (
                      <img
                        src={localImagePreview ?? productImage}
                        alt="Xem trước ảnh sản phẩm"
                        className="mb-3 h-32 w-full rounded object-cover"
                      />
                    ) : (
                      <div className="mb-3 grid h-32 place-items-center rounded bg-slate-50 text-slate-400">
                        <ImagePlus className="h-8 w-8" />
                      </div>
                    )}
                    <label htmlFor="product-image-file" className="mb-1 block text-sm font-medium">
                      Chọn ảnh từ máy tính
                    </label>
                    <input
                      id="product-image-file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={isUploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        void uploadProductImage(file);
                      }}
                      className="block w-full cursor-pointer rounded-md border border-slate-300 bg-white text-sm text-slate-700 file:mr-3 file:cursor-pointer file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:font-semibold file:text-white disabled:cursor-wait disabled:opacity-60"
                    />
                    {isUploading ? (
                      <p role="status" className="mt-2 text-sm font-medium text-sky-700">
                        Đang tải ảnh lên…
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      PNG, JPG hoặc WEBP, tối đa 4 MB. Ảnh sẽ được tải lên ngay sau khi chọn.
                    </p>
                  </div>
                </div>
                <label className="block">
                  Mô tả
                  <textarea {...form.register("description")} className={fieldClassName} rows={3} />
                </label>
                <div className="flex gap-2">
                  <PrimaryButton type="submit" disabled={save.isPending}>
                    {save.isPending ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm sản phẩm"}
                  </PrimaryButton>
                  {editing ? (
                    <SecondaryButton type="button" onClick={cancelEdit}>
                      <X className="mr-1 inline h-4 w-4" />
                      Hủy
                    </SecondaryButton>
                  ) : null}
                </div>
              </form>
            )}
          </Panel>
        ) : null}
      </div>
    </ManagementPage>
  );
}
