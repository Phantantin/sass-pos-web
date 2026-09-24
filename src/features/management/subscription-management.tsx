"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CreditCard, Store } from "lucide-react";
import { toast } from "sonner";
import { ClientPagination, useClientPagination } from "@/components/management/client-pagination";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ManagementPage,
  Panel,
  PrimaryButton,
  fieldClassName,
} from "@/components/management/ui";
import { api } from "@/lib/api/client";
import { useStoreScope } from "./use-store-scope";
import type { StoreSubscription, SubscriptionPlan, SubscriptionStatus } from "@/types/api";

type StripeSessionResponse = { url: string };

const planDetails: Record<
  SubscriptionPlan,
  { label: string; description: string; branch: string; employee: string; product: string }
> = {
  FREE: {
    label: "Free",
    description: "Không áp quota dữ liệu trong cấu hình hiện tại.",
    branch: "Không giới hạn",
    employee: "Không giới hạn",
    product: "Không giới hạn",
  },
  BASIC: {
    label: "Basic",
    description: "Không áp quota dữ liệu trong cấu hình hiện tại.",
    branch: "Không giới hạn",
    employee: "Không giới hạn",
    product: "Không giới hạn",
  },
  PRO: {
    label: "Pro",
    description: "Không giới hạn quota tiêu chuẩn của hệ thống.",
    branch: "Không giới hạn",
    employee: "Không giới hạn",
    product: "Không giới hạn",
  },
};

const statusLabel: Record<SubscriptionStatus, string> = {
  TRIALING: "Đang dùng thử",
  ACTIVE: "Đang hoạt động",
  PAST_DUE: "Quá hạn thanh toán",
  CANCELED: "Đã hủy",
  EXPIRED: "Đã hết hạn",
};

function limitLabel(value: number, resource: string) {
  return value < 0 ? "Không giới hạn" : `${value.toLocaleString("vi-VN")} ${resource}`;
}

function dateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

export function SubscriptionManagement() {
  const scope = useStoreScope();
  const isAdmin = scope.profile?.role === "ROLE_ADMIN";
  const canManageBilling = scope.profile?.role === "ROLE_STORE_ADMIN";
  const current = useQuery({
    queryKey: ["subscriptions", "current"],
    queryFn: () => api<StoreSubscription>("/api/subscriptions/current"),
    enabled: Boolean(scope.profile) && !isAdmin,
  });
  const all = useQuery({
    queryKey: ["subscriptions", "all"],
    queryFn: () => api<StoreSubscription[]>("/api/subscriptions"),
    enabled: isAdmin,
  });
  const redirectToStripe = (session: StripeSessionResponse) => {
    window.location.assign(session.url);
  };
  const checkout = useMutation({
    mutationFn: (plan: SubscriptionPlan) =>
      api<StripeSessionResponse>("/api/subscriptions/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      }),
    onSuccess: redirectToStripe,
    onError: (error: Error) => toast.error(error.message),
  });
  const portal = useMutation({
    mutationFn: () => api<StripeSessionResponse>("/api/subscriptions/stripe/portal", { method: "POST" }),
    onSuccess: redirectToStripe,
    onError: (error: Error) => toast.error(error.message),
  });

  if (scope.isLoading)
    return (
      <ManagementPage title="Gói dịch vụ" description="Theo dõi gói SaaS và các giới hạn được áp dụng cho cửa hàng.">
        <LoadingState />
      </ManagementPage>
    );
  if (scope.error)
    return (
      <ManagementPage title="Gói dịch vụ" description="Theo dõi gói SaaS và các giới hạn được áp dụng cho cửa hàng.">
        <ErrorState message={scope.error.message} />
      </ManagementPage>
    );
  if (isAdmin) return <AdminSubscriptions subscriptions={all} />;
  if (current.isPending)
    return (
      <ManagementPage title="Gói dịch vụ" description="Theo dõi gói SaaS và các giới hạn được áp dụng cho cửa hàng.">
        <LoadingState />
      </ManagementPage>
    );
  if (current.isError)
    return (
      <ManagementPage title="Gói dịch vụ" description="Theo dõi gói SaaS và các giới hạn được áp dụng cho cửa hàng.">
        <ErrorState
          message={current.error.message}
          retry={() => {
            void current.refetch();
          }}
        />
      </ManagementPage>
    );
  if (!current.data)
    return (
      <ManagementPage title="Gói dịch vụ" description="Theo dõi gói SaaS và các giới hạn được áp dụng cho cửa hàng.">
        <EmptyState>Tài khoản chưa thuộc cửa hàng có subscription.</EmptyState>
      </ManagementPage>
    );

  return (
    <ManagementPage
      title="Gói dịch vụ"
      description="Thông tin gói và giới hạn hiện do máy chủ xác nhận; giao dịch Stripe không bị giả lập."
    >
      <CurrentSubscription
        subscription={current.data}
        canManageBilling={canManageBilling}
        isPortalPending={portal.isPending}
        openPortal={() => portal.mutate()}
      />
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {(Object.keys(planDetails) as SubscriptionPlan[]).map((plan) => (
          <PlanCard
            key={plan}
            plan={plan}
            currentPlan={current.data!.plan}
            canManageBilling={canManageBilling}
            isCheckoutPending={checkout.isPending}
            startCheckout={() => checkout.mutate(plan)}
          />
        ))}
      </section>
    </ManagementPage>
  );
}

function CurrentSubscription({
  subscription,
  canManageBilling,
  isPortalPending,
  openPortal,
}: {
  subscription: StoreSubscription;
  canManageBilling: boolean;
  isPortalPending: boolean;
  openPortal: () => void;
}) {
  const statusTone =
    subscription.status === "ACTIVE" || subscription.status === "TRIALING"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-amber-100 text-amber-900";
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Panel title="Subscription hiện tại">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard size={19} />
              <h2 className="text-xl font-bold">{planDetails[subscription.plan].label}</h2>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone}`}>
                {statusLabel[subscription.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{planDetails[subscription.plan].description}</p>
          </div>
          <Store className="text-slate-500" />
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <Limit label="Chi nhánh" value={limitLabel(subscription.branchLimit, "chi nhánh")} />
          <Limit label="Nhân viên" value={limitLabel(subscription.employeeLimit, "nhân viên")} />
          <Limit label="Sản phẩm" value={limitLabel(subscription.productLimit, "sản phẩm")} />
        </dl>
      </Panel>
      <Panel title="Chu kỳ">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Kết thúc dùng thử</dt>
            <dd className="font-medium">{dateTime(subscription.trialEnd)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Kết thúc chu kỳ hiện tại</dt>
            <dd className="font-medium">{dateTime(subscription.currentPeriodEnd)}</dd>
          </div>
        </dl>
        {canManageBilling ? (
          <PrimaryButton type="button" className="mt-5 w-full" disabled={isPortalPending} onClick={openPortal}>
            {isPortalPending ? "Đang mở Stripe…" : "Quản lý thanh toán"}
          </PrimaryButton>
        ) : (
          <p className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Chỉ chủ cửa hàng có thể thay đổi phương thức thanh toán hoặc gói dịch vụ.
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">Trạng thái chỉ được cập nhật sau webhook Stripe đã xác thực.</p>
      </Panel>
    </div>
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function PlanCard({
  plan,
  currentPlan,
  canManageBilling,
  isCheckoutPending,
  startCheckout,
}: {
  plan: SubscriptionPlan;
  currentPlan: SubscriptionPlan;
  canManageBilling: boolean;
  isCheckoutPending: boolean;
  startCheckout: () => void;
}) {
  const detail = planDetails[plan];
  return (
    <article
      className={
        plan === currentPlan
          ? "rounded-xl border-2 border-slate-900 bg-white p-5 shadow-sm"
          : "rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      }
    >
      <p className="font-bold">{detail.label}</p>
      <p className="mt-2 min-h-10 text-sm text-slate-600">{detail.description}</p>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        <li>{detail.branch}</li>
        <li>{detail.employee}</li>
        <li>{detail.product}</li>
      </ul>
      {plan === currentPlan ? (
        <p className="mt-5 text-xs font-semibold text-slate-900">Gói hiện tại</p>
      ) : plan === "FREE" ? (
        <p className="mt-5 text-xs text-slate-500">Không cần thanh toán.</p>
      ) : canManageBilling ? (
        <PrimaryButton type="button" className="mt-5 w-full" disabled={isCheckoutPending} onClick={startCheckout}>
          {isCheckoutPending ? "Đang mở Stripe…" : `Chọn ${detail.label}`}
        </PrimaryButton>
      ) : (
        <p className="mt-5 text-xs text-slate-500">Chỉ chủ cửa hàng có thể chọn gói.</p>
      )}
    </article>
  );
}

function AdminSubscriptions({ subscriptions }: { subscriptions: ReturnType<typeof useQuery<StoreSubscription[]>> }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, { plan: SubscriptionPlan; status: SubscriptionStatus }>>({});
  const subscriptionPagination = useClientPagination(subscriptions.data ?? [], 12);
  const update = useMutation({
    mutationFn: ({
      subscription,
      plan,
      status,
    }: {
      subscription: StoreSubscription;
      plan: SubscriptionPlan;
      status: SubscriptionStatus;
    }) =>
      api<StoreSubscription>(`/api/subscriptions/store/${subscription.storeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, status }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscriptions", "all"] });
      toast.success("Đã cập nhật subscription");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (subscriptions.isPending)
    return (
      <ManagementPage title="Quản trị subscription" description="Quản trị gói SaaS theo từng cửa hàng.">
        <LoadingState />
      </ManagementPage>
    );
  if (subscriptions.isError)
    return (
      <ManagementPage title="Quản trị subscription" description="Quản trị gói SaaS theo từng cửa hàng.">
        <ErrorState
          message={subscriptions.error.message}
          retry={() => {
            void subscriptions.refetch();
          }}
        />
      </ManagementPage>
    );

  return (
    <ManagementPage
      title="Quản trị subscription"
      description="Admin có thể rà soát và điều chỉnh dữ liệu subscription khi cần hỗ trợ vận hành."
    >
      <Panel title="Subscription của các cửa hàng">
        {subscriptions.data?.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-3">Cửa hàng</th>
                    <th className="px-2 py-3">Plan</th>
                    <th className="px-2 py-3">Trạng thái</th>
                    <th className="px-2 py-3">Chu kỳ kết thúc</th>
                    <th className="px-2 py-3">
                      <span className="sr-only">Lưu</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionPagination.pageItems.map((subscription) => {
                    const draft = drafts[subscription.id] ?? { plan: subscription.plan, status: subscription.status };
                    return (
                      <tr key={subscription.id} className="border-b last:border-0">
                        <td className="px-2 py-3">
                          <p className="font-medium">{subscription.storeBrand}</p>
                          <p className="text-xs text-slate-500">Store #{subscription.storeId}</p>
                        </td>
                        <td className="px-2 py-3">
                          <select
                            aria-label={`Gói của ${subscription.storeBrand}`}
                            value={draft.plan}
                            onChange={(event) =>
                              setDrafts((previous) => ({
                                ...previous,
                                [subscription.id]: { ...draft, plan: event.target.value as SubscriptionPlan },
                              }))
                            }
                            className={fieldClassName}
                          >
                            {(Object.keys(planDetails) as SubscriptionPlan[]).map((plan) => (
                              <option key={plan} value={plan}>
                                {plan}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-3">
                          <select
                            aria-label={`Trạng thái của ${subscription.storeBrand}`}
                            value={draft.status}
                            onChange={(event) =>
                              setDrafts((previous) => ({
                                ...previous,
                                [subscription.id]: { ...draft, status: event.target.value as SubscriptionStatus },
                              }))
                            }
                            className={fieldClassName}
                          >
                            {(Object.keys(statusLabel) as SubscriptionStatus[]).map((status) => (
                              <option key={status} value={status}>
                                {statusLabel[status]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap">{dateTime(subscription.currentPeriodEnd)}</td>
                        <td className="px-2 py-3 text-right">
                          <PrimaryButton
                            type="button"
                            disabled={
                              update.isPending ||
                              (draft.plan === subscription.plan && draft.status === subscription.status)
                            }
                            onClick={() => update.mutate({ subscription, ...draft })}
                          >
                            Lưu
                          </PrimaryButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ClientPagination {...subscriptionPagination} label="subscription" />
          </>
        ) : (
          <EmptyState>Chưa có store subscription nào.</EmptyState>
        )}
      </Panel>
      <p className="mt-4 flex items-start gap-2 text-sm text-amber-800">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        Thay đổi plan/status là thao tác hỗ trợ vận hành. Khi bật Stripe, webhook có chữ ký hợp lệ sẽ là nguồn đồng bộ
        thanh toán chính.
      </p>
    </ManagementPage>
  );
}
