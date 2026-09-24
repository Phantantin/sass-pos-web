"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CirclePlus, Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { api, RequestError } from "@/lib/api/client";
import { can, roleTitle } from "@/lib/auth/roles";
import type {
  CompletedOrder,
  CurrentUser,
  Customer,
  Inventory,
  PaymentType,
  Product,
  ShiftProgress,
} from "@/types/api";

type CartLine = { product: Product; quantity: number; stock: number };
type CustomerForm = { fullName: string; phone: string; email: string };

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const vietQrBankId = process.env.NEXT_PUBLIC_VIETQR_BANK_ID?.trim();
const vietQrAccountNo = process.env.NEXT_PUBLIC_VIETQR_ACCOUNT_NO?.trim();
const vietQrAccountName = process.env.NEXT_PUBLIC_VIETQR_ACCOUNT_NAME?.trim();

function orderItemUnitPrice(item: CompletedOrder["items"][number]) {
  return item.quantity ? item.price / item.quantity : 0;
}

export default function PosPage() {
  const queryClient = useQueryClient();
  const checkoutKey = useRef<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerForm>({ fullName: "", phone: "", email: "" });
  const [paymentType, setPaymentType] = useState<PaymentType>("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [lastOrder, setLastOrder] = useState<CompletedOrder | null>(null);

  const user = useQuery({ queryKey: ["current-user"], queryFn: () => api<CurrentUser>("/api/users/profile") });
  const inventory = useQuery({
    enabled: Boolean(user.data?.branchId),
    queryKey: ["inventory", user.data?.branchId],
    queryFn: () => api<Inventory[]>(`/api/inventories/branch/${user.data!.branchId}`),
  });
  const shift = useQuery({
    queryKey: ["current-shift"],
    queryFn: () => api<ShiftProgress>("/api/shift-reports/current"),
    retry: false,
  });
  const customers = useQuery({
    queryKey: ["pos-customers", customerQuery],
    queryFn: () =>
      api<Customer[]>(
        customerQuery.trim() ? `/api/customers/search?q=${encodeURIComponent(customerQuery.trim())}` : "/api/customers",
      ),
    staleTime: 15_000,
  });

  const startShift = useMutation({
    mutationFn: () => api<ShiftProgress>("/api/shift-reports/start", { method: "POST" }),
    onSuccess: () => {
      toast.success("Đã mở ca. Bạn có thể thanh toán.");
      queryClient.invalidateQueries({ queryKey: ["current-shift"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createCustomer = useMutation({
    mutationFn: (payload: CustomerForm) =>
      api<Customer>("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (customer) => {
      setSelectedCustomer(customer);
      setCustomerQuery(customer.fullName);
      setCustomerForm({ fullName: "", phone: "", email: "" });
      setShowCustomerForm(false);
      queryClient.invalidateQueries({ queryKey: ["pos-customers"] });
      toast.success("Đã thêm khách hàng vào đơn.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.product.sellingPrice) * line.quantity, 0),
    [cart],
  );
  const received = Number(cashReceived.replace(/[^0-9]/g, "")) || 0;
  const change = paymentType === "CASH" ? Math.max(0, received - total) : 0;
  const isCashInsufficient = paymentType === "CASH" && received > 0 && received < total;
  const vietQrUrl = useMemo(() => {
    if (!vietQrBankId || !vietQrAccountNo || total <= 0) return null;
    const query = new URLSearchParams({
      amount: String(Math.round(total)),
      addInfo: "THANH TOAN POS",
      accountName: vietQrAccountName ?? "",
    });
    return `https://img.vietqr.io/image/${encodeURIComponent(vietQrBankId)}-${encodeURIComponent(vietQrAccountNo)}-compact2.png?${query.toString()}`;
  }, [total]);

  const checkout = useMutation({
    mutationFn: () => {
      if (!cart.length) throw new Error("Giỏ hàng đang trống");
      if (!shift.data) throw new Error("Hãy mở ca trước khi thanh toán");
      if (paymentType === "CASH" && received < total) throw new Error("Số tiền nhận chưa đủ");
      checkoutKey.current ??= crypto.randomUUID();
      return api<CompletedOrder>("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": checkoutKey.current },
        body: JSON.stringify({
          paymentType,
          customerId: selectedCustomer?.id ?? null,
          items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        }),
      });
    },
    onSuccess: (order) => {
      checkoutKey.current = null;
      setLastOrder(order);
      setCart([]);
      setCashReceived("");
      setSelectedCustomer(null);
      setCustomerQuery("");
      toast.success(`Thanh toán thành công đơn #${order.id}`);
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["current-shift"] });
    },
    onError: (error: Error) => {
      if (error instanceof RequestError && error.status === 409)
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.error(error.message);
    },
  });

  const products = useMemo(() => {
    const normalized = productQuery.trim().toLocaleLowerCase();
    return (inventory.data ?? []).filter(
      (item) =>
        item.quantity > 0 &&
        (!normalized || `${item.product.name} ${item.product.sku ?? ""}`.toLocaleLowerCase().includes(normalized)),
    );
  }, [inventory.data, productQuery]);

  function add(item: Inventory) {
    setCart((old) => {
      const found = old.find((line) => line.product.id === item.product.id);
      if (found) {
        if (found.quantity >= found.stock) toast.error("Số lượng đã đạt tồn kho khả dụng");
        return old.map((line) =>
          line.product.id === item.product.id ? { ...line, quantity: Math.min(line.quantity + 1, line.stock) } : line,
        );
      }
      return [...old, { product: item.product, quantity: 1, stock: item.quantity }];
    });
  }

  function changeQuantity(productId: number, delta: number) {
    setCart((old) =>
      old.flatMap((line) => {
        if (line.product.id !== productId) return [line];
        const next = line.quantity + delta;
        if (next <= 0) return [];
        return [{ ...line, quantity: Math.min(line.stock, next) }];
      }),
    );
  }

  function scanOrSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const exactSku = productQuery.trim().toLocaleLowerCase();
    const item = (inventory.data ?? []).find(
      (candidate) => candidate.product.sku?.toLocaleLowerCase() === exactSku && candidate.quantity > 0,
    );
    if (item) {
      add(item);
      setProductQuery("");
      return;
    }
    if (exactSku) toast.message("Không tìm thấy SKU chính xác; đang hiển thị kết quả gần đúng.");
  }

  function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerForm.fullName.trim()) {
      toast.error("Cần nhập tên khách hàng");
      return;
    }
    createCustomer.mutate({
      fullName: customerForm.fullName.trim(),
      phone: customerForm.phone.trim(),
      email: customerForm.email.trim(),
    });
  }

  if (user.isPending || inventory.isPending) {
    return <main className="grid min-h-screen place-items-center bg-slate-100">Đang tải POS…</main>;
  }
  if (user.isError || !user.data) {
    return (
      <main className="grid min-h-screen place-items-center p-8 text-center">
        <div>
          <p>Không tải được thông tin tài khoản.</p>
          <Link className="mt-3 inline-block underline" href="/vi/dashboard">
            Quay về tổng quan
          </Link>
        </div>
      </main>
    );
  }
  if (!can(user.data.role, "pos")) {
    return (
      <main className="grid min-h-screen place-items-center p-8 text-center">
        <div>
          <p>Tài khoản này không có quyền sử dụng điểm bán hàng.</p>
          <Link className="mt-3 inline-block underline" href="/vi/dashboard">
            Quay về tổng quan
          </Link>
        </div>
      </main>
    );
  }
  if (inventory.isError || !user.data.branchId) {
    return (
      <main className="grid min-h-screen place-items-center p-8 text-center">
        <div>
          <p>Không tải được dữ liệu POS hoặc tài khoản chưa được gán chi nhánh.</p>
          <Link className="mt-3 inline-block underline" href="/vi/dashboard">
            Quay về tổng quan
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 print:bg-white">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 print:hidden sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/vi/dashboard" className="rounded p-2 hover:bg-slate-100" aria-label="Về trang tổng quan">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-semibold">Điểm bán hàng</h1>
            <p className="text-xs font-medium text-slate-700">
              {user.data.fullName} · {roleTitle(user.data.role, "vi")}
            </p>
            <p className="text-xs text-slate-500">Chi nhánh #{user.data.branchId}</p>
          </div>
        </div>
        {shift.data ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">Ca đang mở</span>
        ) : (
          <button
            onClick={() => startShift.mutate()}
            disabled={startShift.isPending}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {startShift.isPending ? "Đang mở ca…" : "Mở ca"}
          </button>
        )}
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="p-4 sm:p-6 print:hidden">
          <form onSubmit={scanOrSearch} className="relative mb-5">
            <Search className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={18} />
            <input
              autoFocus
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Quét mã vạch hoặc tìm tên / SKU"
              className="w-full rounded-lg border bg-white py-3 pl-10 pr-4 shadow-sm outline-none focus:border-slate-900"
            />
          </form>
          {shift.isError && (
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Bạn chưa mở ca nên chưa thể thanh toán.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => add(item)}
                className="rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-slate-900 hover:shadow"
              >
                <p className="font-semibold">{item.product.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.product.sku || "Chưa có SKU"} · Còn {item.quantity}
                </p>
                <p className="mt-4 font-medium">{money.format(item.product.sellingPrice)}</p>
              </button>
            ))}
            {!products.length && (
              <p className="col-span-full rounded-lg border border-dashed p-8 text-center text-slate-500">
                Không có sản phẩm phù hợp hoặc hàng đã hết.
              </p>
            )}
          </div>
        </section>

        <aside className="border-l bg-white p-4 sm:p-5 print:hidden">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShoppingCart size={19} /> Giỏ hàng
            </h2>
            <span className="text-sm text-slate-500">{cart.reduce((count, line) => count + line.quantity, 0)} món</span>
          </div>

          <div className="mt-4 border-y py-3">
            <label className="text-sm font-medium" htmlFor="customer-search">
              Khách hàng (không bắt buộc)
            </label>
            {selectedCustomer ? (
              <div className="mt-1 flex items-center justify-between rounded-md bg-slate-100 p-2 text-sm">
                <span>
                  {selectedCustomer.fullName}
                  {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}
                </span>
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerQuery("");
                  }}
                >
                  Bỏ chọn
                </button>
              </div>
            ) : (
              <>
                <input
                  id="customer-search"
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="Tìm tên, email…"
                  className="mt-1 w-full rounded-md border p-2"
                />
                <div className="max-h-28 overflow-auto">
                  {customers.data?.slice(0, 5).map((customer) => (
                    <button
                      type="button"
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomerQuery("");
                      }}
                      className="block w-full border-b p-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium">{customer.fullName}</span>
                      {customer.phone && <span className="text-slate-500"> · {customer.phone}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowCustomerForm((visible) => !visible)}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline"
            >
              <CirclePlus size={15} /> Thêm khách nhanh
            </button>
            {showCustomerForm && (
              <form onSubmit={submitCustomer} className="mt-2 grid gap-2 rounded-md bg-slate-50 p-3">
                <input
                  required
                  value={customerForm.fullName}
                  onChange={(event) => setCustomerForm({ ...customerForm, fullName: event.target.value })}
                  placeholder="Tên khách hàng"
                  className="rounded border p-2 text-sm"
                />
                <input
                  value={customerForm.phone}
                  onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })}
                  placeholder="Số điện thoại"
                  className="rounded border p-2 text-sm"
                />
                <input
                  type="email"
                  value={customerForm.email}
                  onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })}
                  placeholder="Email (tuỳ chọn)"
                  className="rounded border p-2 text-sm"
                />
                <button
                  disabled={createCustomer.isPending}
                  className="rounded bg-slate-900 p-2 text-sm text-white disabled:opacity-60"
                >
                  {createCustomer.isPending ? "Đang lưu…" : "Lưu khách hàng"}
                </button>
              </form>
            )}
          </div>

          {cart.length ? (
            <div className="space-y-3 py-4">
              {cart.map((line) => (
                <div key={line.product.id} className="border-b pb-3">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium">{line.product.name}</p>
                      <p className="text-xs text-slate-500">{money.format(line.product.sellingPrice)} / món</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Xóa ${line.product.name}`}
                      onClick={() => changeQuantity(line.product.id, -line.quantity)}
                      className="rounded p-1 hover:bg-slate-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeQuantity(line.product.id, -1)}
                        className="rounded border p-1"
                        aria-label="Giảm số lượng"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="min-w-6 text-center">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(line.product.id, 1)}
                        className="rounded border p-1"
                        aria-label="Tăng số lượng"
                        disabled={line.quantity >= line.stock}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="font-medium">
                      {money.format(line.quantity * Number(line.product.sellingPrice))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Chưa có sản phẩm trong giỏ.</p>
          )}

          <div className="space-y-3 border-t pt-4">
            <label className="block text-sm font-medium">
              Phương thức thanh toán
              <select
                value={paymentType}
                onChange={(event) => setPaymentType(event.target.value as PaymentType)}
                className="mt-1 w-full rounded border bg-white p-2"
              >
                <option value="CASH">Tiền mặt</option>
                <option value="CARD">Thẻ</option>
                <option value="UPI">Chuyển khoản</option>
              </select>
            </label>
            {paymentType === "CASH" && (
              <label className="block text-sm font-medium">
                Tiền khách đưa
                <input
                  inputMode="numeric"
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                  placeholder={total ? `Ít nhất ${total.toLocaleString("vi-VN")}` : "0"}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Tổng cộng</span>
              <span>{money.format(total)}</span>
            </div>
            {paymentType === "UPI" &&
              (vietQrUrl ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-center">
                  <p className="text-sm font-semibold text-sky-950">Quét mã để chuyển khoản</p>
                  <Image
                    unoptimized
                    width={224}
                    height={224}
                    src={vietQrUrl}
                    alt={`Mã QR thanh toán ${money.format(total)}`}
                    className="mx-auto mt-3 aspect-square w-56 rounded-lg bg-white object-contain shadow-sm"
                  />
                  <p className="mt-3 text-lg font-bold text-sky-950">{money.format(total)}</p>
                  <p className="mt-1 text-xs text-sky-800">{vietQrAccountName || vietQrAccountNo}</p>
                  <p className="mt-2 text-xs text-slate-600">
                    Sau khi ngân hàng báo nhận tiền, thu ngân bấm Thanh toán để xác nhận thủ công.
                  </p>
                </div>
              ) : (
                <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Chưa cấu hình VietQR. Điền NEXT_PUBLIC_VIETQR_BANK_ID, NEXT_PUBLIC_VIETQR_ACCOUNT_NO và
                  NEXT_PUBLIC_VIETQR_ACCOUNT_NAME trong .env.local.
                </p>
              ))}
            {paymentType === "CASH" && received > 0 && (
              <div
                className={
                  isCashInsufficient
                    ? "flex justify-between text-sm text-rose-600"
                    : "flex justify-between text-sm text-emerald-700"
                }
              >
                <span>{isCashInsufficient ? "Còn thiếu" : "Tiền thối"}</span>
                <span>{money.format(isCashInsufficient ? total - received : change)}</span>
              </div>
            )}
            <button
              disabled={
                !cart.length ||
                checkout.isPending ||
                !shift.data ||
                isCashInsufficient ||
                (paymentType === "CASH" && received === 0) ||
                (paymentType === "UPI" && !vietQrUrl)
              }
              onClick={() => checkout.mutate()}
              className="w-full rounded-md bg-emerald-600 p-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkout.isPending ? "Đang xử lý…" : "Thanh toán"}
            </button>
          </div>
        </aside>
      </div>

      {lastOrder && (
        <section className="mx-auto hidden max-w-sm p-8 print:block">
          <header className="border-b pb-4 text-center">
            <h2 className="text-xl font-bold">SaaS POS</h2>
            <p>Hóa đơn #{lastOrder.id}</p>
            <p className="text-sm">{new Date(lastOrder.createdAt).toLocaleString("vi-VN")}</p>
          </header>
          <dl className="space-y-2 py-4">
            {lastOrder.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <dt>
                  {item.product.name} × {item.quantity}
                  <br />
                  <span className="text-sm">{money.format(orderItemUnitPrice(item))}</span>
                </dt>
                <dd>{money.format(item.price)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex justify-between border-t pt-3 font-bold">
            <span>Tổng</span>
            <span>{money.format(lastOrder.totalAmount)}</span>
          </div>
          <p className="mt-5 text-center text-sm">Cảm ơn quý khách!</p>
        </section>
      )}
      {lastOrder && (
        <button
          type="button"
          onClick={() => window.print()}
          className="fixed bottom-5 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg print:hidden"
        >
          <Printer size={17} /> In hoá đơn #{lastOrder.id}
        </button>
      )}
    </main>
  );
}
