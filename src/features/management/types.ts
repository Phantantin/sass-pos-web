import type { CurrentUser } from "@/types/api";

export type StoreStatus = "PENDING" | "ACTIVE" | "BLOCKED";

export type StoreContact = {
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type StoreRecord = {
  id: number;
  brand: string;
  description?: string | null;
  storeType?: string | null;
  status?: StoreStatus | null;
  contact?: StoreContact | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  storeAdmin?: { id: number; fullName: string; email: string } | null;
};

export type BranchRecord = {
  id: number;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  workingDays?: string[] | null;
  openTime?: string | null;
  closeTime?: string | null;
  storeId?: number | null;
};

export type EmployeeRole =
  "ROLE_ADMIN" | "ROLE_STORE_ADMIN" | "ROLE_STORE_MANAGER" | "ROLE_BRANCH_MANAGER" | "ROLE_BRANCH_CASHIER";

export type EmployeeRecord = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  role: EmployeeRole;
  storeId?: number | null;
  branchId?: number | null;
  createdAt?: string | null;
  lastLogin?: string | null;
};

export type CategoryRecord = {
  id: number;
  name: string;
  storeId?: number | null;
};

export type ProductRecord = {
  id: number;
  name: string;
  sku: string;
  description?: string | null;
  mrp: number;
  costPrice: number;
  sellingPrice: number;
  brand?: string | null;
  image?: string | null;
  category?: CategoryRecord | null;
  categoryId?: number | null;
  storeId?: number | null;
  catalogStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
};

export type InventoryRecord = {
  id: number;
  branchId: number;
  productId: number;
  product: ProductRecord;
  quantity: number;
  minStockLevel: number;
  lastUpdate?: string | null;
};

export type InventoryMovementRecord = {
  id: number;
  branchId: number;
  productId: number;
  product?: ProductRecord | null;
  performedBy?: { id: number; fullName: string; email: string } | null;
  type: "INITIAL_STOCK" | "ADJUSTMENT" | "SALE" | "REFUND" | "REMOVAL" | "TRANSFER_OUT" | "TRANSFER_IN";
  quantityBefore: number;
  quantityAfter: number;
  quantityDelta: number;
  reason?: string | null;
  createdAt: string;
};

export type TransferAvailabilityRecord = {
  productId: number;
  productName: string;
  sku: string;
  image?: string | null;
  sourceStoreId: number;
  sourceStoreName: string;
  sourceBranchId: number;
  sourceBranchName: string;
  availableQuantity: number;
};

export type InventoryTransferRecord = {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  sourceStoreId: number;
  sourceStoreName: string;
  sourceBranchId: number;
  sourceBranchName: string;
  destinationStoreId: number;
  destinationStoreName: string;
  destinationBranchId: number;
  destinationBranchName: string;
  quantity: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason?: string | null;
  reviewNote?: string | null;
  requestedById: number;
  requestedByName: string;
  reviewedById?: number | null;
  reviewedByName?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  updatedAt?: string | null;
  canApprove: boolean;
  canReject: boolean;
  canCancel: boolean;
};

export type CustomerRecord = {
  id: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type OrderRecord = {
  id: number;
  branchId?: number;
  totalAmount: number;
  createdAt: string;
  paymentType: "CASH" | "CARD" | "UPI";
  status: "PENDING" | "COMPLETED" | "PARTIALLY_REFUNDED" | "REFUNDED";
  customer?: CustomerRecord | null;
  cashier?: { id: number; fullName: string } | null;
  items?: Array<{ id: number; quantity: number; price: number; product?: ProductRecord | null }>;
};

export type RefundRecord = {
  id: number;
  orderId?: number;
  amount: number;
  reason: string;
  createdAt: string;
  paymentType: "CASH" | "CARD" | "UPI";
  cashierName?: string | null;
};

export type ShiftReportRecord = {
  id: number;
  shiftStart: string;
  shiftEnd?: string | null;
  totalSales: number;
  totalRefund: number;
  netSale: number;
  totalOrder: number;
  branchId: number;
  cashier?: { id: number; fullName: string } | null;
};

export type StoreScope = {
  profile: CurrentUser | undefined;
  storeId: number | null;
  branchId: number | null;
  adminStores?: StoreRecord[];
  selectAdminStore?: (storeId: number) => void;
  isLoading: boolean;
  error: Error | null;
};

export type WorkScheduleRecord = {
  id: number;
  employeeId: number;
  employeeName: string;
  branchId: number;
  branchName: string;
  workDate: string;
  startTime: string;
  endTime: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  note?: string | null;
};

export type AttendanceRecord = {
  id: number;
  employeeId: number;
  employeeName: string;
  branchId: number;
  branchName: string;
  workDate: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status: "PRESENT" | "LATE" | "ABSENT" | "LEAVE";
  note?: string | null;
};

export type PayrollRecord = {
  id: number;
  employeeId: number;
  employeeName: string;
  storeId: number;
  storeName: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  hourlyRate: number;
  workedMinutes: number;
  bonus: number;
  deduction: number;
  netSalary: number;
  status: "DRAFT" | "APPROVED" | "PAID";
  paidAt?: string | null;
  note?: string | null;
};
