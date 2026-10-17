/**
 * Response shapes used by the dashboard. Request bodies are typed from the generated
 * OpenAPI schema (`schema.d.ts`); responses are described here because the API returns
 * service objects that Swagger doesn't model.
 */

export type PaymentStatus = "AWAITING_PROOF" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED";
export type BrandStatus = "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "SUSPENDED";
/** Kind of business behind a store. Missing on stores created before the field existed (= BRAND). */
export type StoreType = "BRAND" | "SHOWROOM" | "WAREHOUSE" | "SHOP";
export type BillingPeriod = "MONTHLY" | "YEARLY";
export type SubscriptionStatus = "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "CANCELLED";

export interface BrandRef {
  _id: string;
  name: string;
  slug: string;
  status: BrandStatus;
  logo?: { url: string };
  contact?: { phone?: string; email?: string; whatsapp?: string };
  subscriptionEndsAt?: string | null;
}

export interface PlanSnapshot {
  code: string;
  nameAr: string;
  nameEn: string;
  price: number;
  durationDays: number;
  limits: { maxActiveProducts: number };
}

export interface SubscriptionRef {
  _id: string;
  planSnapshot: PlanSnapshot;
  billingPeriod: BillingPeriod;
  status: SubscriptionStatus;
  startsAt?: string;
  endsAt?: string;
  renewalOf?: string;
}

export interface ProofAttempt {
  transactionReference: string;
  senderName?: string;
  submittedAt: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

/** GET /admin/payments (list): brandId populated. */
export interface PaymentListItem {
  _id: string;
  /** Set when soft-deleted by an admin. */
  deletedAt?: string | null;
  brandId: BrandRef;
  subscriptionId: string;
  amount: number;
  currency: string;
  method: "INSTAPAY_MANUAL";
  status: PaymentStatus;
  transactionReference?: string;
  senderName?: string;
  paidAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewNote?: string;
  rejectionReason?: string;
  previousAttempts: ProofAttempt[];
  createdAt: string;
}

/** GET /admin/payments/:id: brand and subscription populated. */
export interface PaymentDetail extends Omit<PaymentListItem, "subscriptionId"> {
  subscriptionId: SubscriptionRef;
  proofFileId?: string;
}

// ---------- Brands ----------

export interface ShippingZone {
  governorate: string;
  fee: number;
}

export interface AdminBrand {
  _id: string;
  /** Set when soft-deleted by an admin. */
  deletedAt?: string | null;
  name: string;
  slug: string;
  storeType?: StoreType;
  description: string;
  status: BrandStatus;
  statusReason?: string;
  logo?: { url: string };
  cover?: { url: string };
  ownerUserId: { _id: string; name: string; email: string; phone: string; status?: string } | string;
  categoryIds: ({ _id: string; nameAr: string; nameEn: string; slug: string } | string)[];
  contact: { phone?: string; email?: string; whatsapp?: string };
  socialLinks: { instagram?: string; facebook?: string; tiktok?: string; website?: string };
  settings: {
    shippingZones: ShippingZone[];
    defaultShippingFee: number | null;
    freeShippingThreshold: number | null;
    minOrderAmount: number;
    processingDays: number;
    shippingPolicy: string;
    returnPolicy: string;
    acceptsOrders: boolean;
  };
  subscriptionEndsAt: string | null;
  ratingAvg: number;
  ratingCount: number;
  approvedAt?: string;
  createdAt: string;
  isVisible?: boolean;
}

export interface AdminSubscription {
  _id: string;
  brandId: string | { _id: string; name: string };
  planSnapshot: PlanSnapshot;
  billingPeriod: BillingPeriod;
  status: SubscriptionStatus;
  startsAt?: string;
  endsAt?: string;
  renewalOf?: string;
  createdAt: string;
}

// ---------- Orders ----------

export type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export interface OrderSummary {
  id: string;
  orderNumber: string;
  brand: { id: string; name: string; slug: string; phone?: string };
  status: OrderStatus;
  statusLabelAr: string;
  itemsCount: number;
  grandTotal: number;
  currency: string;
  paymentMethod: "COD";
  paymentStatus: "UNPAID" | "PAID";
  createdAt: string;
  customer?: { name: string; phone: string };
  previewImageUrl?: string | null;
}

export interface OrderDetail extends OrderSummary {
  items: {
    productId: string;
    variantId: string;
    title: string;
    imageUrl?: string;
    size?: string;
    color?: string;
    sku?: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  address: {
    recipientName: string;
    phone: string;
    governorateName: string;
    city: string;
    area: string;
    street: string;
    building: string;
    floor: string;
    apartment: string;
    landmark: string;
    location: { lat: number; lng: number } | null;
  };
  subtotal: number;
  shippingFee: number;
  discountTotal: number;
  notes: string;
  cancelReason: string | null;
  deliveredAt: string | null;
  history: { status: OrderStatus; at: string; actor: "CUSTOMER" | "BRAND" | "ADMIN" | "SYSTEM"; note: string | null }[];
  allowedNextStatuses: OrderStatus[];
}

// ---------- Moderation ----------

export type ReportTarget = "REVIEW" | "PRODUCT" | "BRAND";
export type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

export interface AdminReport {
  _id: string;
  /** Set when soft-deleted by an admin. */
  deletedAt?: string | null;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  details: string;
  status: ReportStatus;
  resolutionNote?: string;
  createdAt: string;
  reporter: { id: string; name?: string; email?: string } | null;
  target: {
    title: string;
    subtitle?: string;
    status: string;
    imageUrl?: string | null;
    productId?: string;
    brandId?: string;
    /** The reported store/review was soft-deleted. */
    deleted?: boolean;
  } | null;
}

// ---------- Users ----------

export interface AdminUser {
  id: string;
  /** Set when soft-deleted by an admin. */
  deletedAt?: string | null;
  name: string;
  email: string;
  phone: string;
  roles: ("CUSTOMER" | "SUPER_ADMIN")[];
  status: "ACTIVE" | "SUSPENDED";
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
}

// ---------- Audit ----------

export interface AuditEntry {
  _id: string;
  actorId?: { _id: string; name: string; email: string } | string | null;
  actorType: "USER" | "ADMIN" | "SYSTEM";
  action: string;
  entityType: string;
  entityId: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

// ---------- Settings ----------

export interface Plan {
  _id: string;
  /** Set when soft-deleted by an admin. */
  deletedAt?: string | null;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  priceMonthly: number;
  priceYearly: number;
  limits: { maxActiveProducts: number };
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface Category {
  _id: string;
  /** Set when soft-deleted by an admin. */
  deletedAt?: string | null;
  nameAr: string;
  nameEn: string;
  slug: string;
  parentId: string | null;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  /** Store types offered this category when opening a store; empty = all types. */
  storeTypes?: StoreType[];
}

// ---------- Analytics ----------

export interface AdminOverview {
  range: { from: string; to: string };
  brands: { byStatus: Record<BrandStatus, number>; visible: number; expiringIn7Days: number };
  users: { total: number; newInRange: number };
  subscriptions: {
    active: number;
    byPlan: Record<string, number>;
    mrr: number;
    collectedInRange: number;
    approvedPaymentsInRange: number;
    renewalsInRange: number;
  };
  queues: { pendingPayments: number; pendingBrandApplications: number; openReports: number };
  orders: { count: number; gmv: number };
}
