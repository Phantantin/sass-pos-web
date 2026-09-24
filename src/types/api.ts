import type { UserRole } from "@/lib/auth/roles";

export type ApiError = { message?: string; fieldErrors?: Record<string, string> };
export type CurrentUser = {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  storeId: number | null;
  branchId: number | null;
};
export type Product = {
  id: number;
  name: string;
  sku: string;
  sellingPrice: number;
  image?: string | null;
  category?: { id: number; name: string } | null;
};
export type Inventory = { id: number; productId: number; quantity: number; minStockLevel?: number; product: Product };
export type PaymentType = "CASH" | "CARD" | "UPI";

export type Customer = {
  id: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
};

export type CustomerHistory = {
  customerId: number;
  customerName: string;
  page: number;
  pageSize: number;
  totalOrders: number;
  totalPages: number;
  orders: Array<{
    orderId: number;
    branchId?: number | null;
    branchName?: string | null;
    createdAt: string;
    paymentType: PaymentType;
    status: string;
    totalAmount: number;
    refundedAmount: number;
    netAmount: number;
  }>;
};

export type ShiftProgress = {
  id: number;
  shiftStart: string;
  shiftEnd?: string | null;
  totalSales: number;
  totalRefund: number;
  netSale: number;
  totalOrder: number;
};

export type CompletedOrder = {
  id: number;
  totalAmount: number;
  createdAt: string;
  paymentType: PaymentType;
  customer?: Customer | null;
  items: Array<{ id: number; quantity: number; price: number; product: Product }>;
};

export type DashboardOverview = {
  storeId: number | null;
  branchId: number | null;
  salesToday: number;
  refundsToday: number;
  netSalesToday: number;
  ordersToday: number;
  lowStockItems: number;
  recentOrders: Array<{
    id: number;
    totalAmount: number;
    createdAt: string;
    paymentType: PaymentType;
    status: string;
    customer?: Customer | null;
  }>;
};

export type SalesReport = {
  from: string;
  to: string;
  storeId: number | null;
  branchId: number | null;
  grossSales: number;
  refunds: number;
  netSales: number;
  costOfGoodsSold: number;
  refundedCost: number;
  netCost: number;
  netProfit: number;
  averageOrderValue: number;
  orderCount: number;
  dailySales: Array<{
    date: string;
    grossSales: number;
    refunds: number;
    netSales: number;
    netCost: number;
    netProfit: number;
    orderCount: number;
  }>;
  paymentBreakdown: Array<{
    paymentType: PaymentType;
    amount: number;
    orderCount: number;
  }>;
  topProducts: Array<{
    productId: number;
    productName: string;
    sku: string;
    quantity: number;
    grossSales: number;
    refunds: number;
    netSales: number;
    netCost: number;
    netProfit: number;
  }>;
  branchPerformance: Array<{
    storeId: number;
    storeName: string;
    branchId: number;
    branchName: string;
    orderCount: number;
    grossSales: number;
    refunds: number;
    netSales: number;
    netCost: number;
    netProfit: number;
  }>;
  storePerformance: Array<{
    storeId: number;
    storeName: string;
    orderCount: number;
    grossSales: number;
    refunds: number;
    netSales: number;
    netCost: number;
    netProfit: number;
  }>;
  shiftReports: Array<{
    shiftId: number;
    branchId: number | null;
    branchName: string | null;
    cashierId: number | null;
    cashierName: string | null;
    shiftStart: string;
    shiftEnd: string | null;
    totalSales: number;
    totalRefund: number;
    netSale: number;
    totalOrder: number;
  }>;
  employeePerformance: Array<{
    employeeId: number;
    employeeName: string;
    shiftCount: number;
    orderCount: number;
    grossSales: number;
    refunds: number;
    netSales: number;
    averageOrderValue: number;
  }>;
};

export type InventoryMovementReport = {
  from: string;
  to: string;
  storeId: number | null;
  branchId: number | null;
  movementCount: number;
  inboundQuantity: number;
  outboundQuantity: number;
  netQuantity: number;
  dailyMovements: Array<{
    date: string;
    movementCount: number;
    inboundQuantity: number;
    outboundQuantity: number;
    netQuantity: number;
  }>;
  typeBreakdown: Array<{
    type: string;
    movementCount: number;
    inboundQuantity: number;
    outboundQuantity: number;
    netQuantity: number;
  }>;
  topProducts: Array<{
    productId: number;
    productName: string;
    sku: string;
    movementCount: number;
    inboundQuantity: number;
    outboundQuantity: number;
    netQuantity: number;
    movementVolume: number;
  }>;
};

export type SubscriptionPlan = "FREE" | "BASIC" | "PRO";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";

export type StoreSubscription = {
  id: number;
  storeId: number;
  storeBrand: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialStart?: string | null;
  trialEnd?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  branchLimit: number;
  employeeLimit: number;
  productLimit: number;
  updatedAt: string;
};

export type AuditLog = {
  id: number;
  storeId?: number | null;
  storeBrand?: string | null;
  actorId?: number | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  detail?: string | null;
  createdAt: string;
};

export type AuditLogPage = {
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  logs: AuditLog[];
};
