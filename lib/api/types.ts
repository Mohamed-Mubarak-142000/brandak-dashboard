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

export interface PlanLimits {
  /** Integer >= 1. */
  maxActiveProducts: number;
  /** Integer >= 1, or null = unlimited. */
  maxOrdersPerMonth: number | null;
  /** Integer 1..10. */
  maxImagesPerProduct: number;
}

export interface PlanSnapshot {
  code: string;
  nameAr: string;
  nameEn: string;
  price: number;
  durationDays: number;
  /** Snapshots taken before the orders/images limits existed only carry maxActiveProducts. */
  limits: Pick<PlanLimits, "maxActiveProducts"> & Partial<Omit<PlanLimits, "maxActiveProducts">>;
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
  /** Buyer-protection cases decided against the store; 3 suspend it. Missing on older stores (= 0). */
  protectionStrikes?: number;
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

export type OrderStatus =
  /** Placed, but the customer hasn't confirmed it with the email code yet; the store doesn't see it. */
  | "AWAITING_CONFIRMATION"
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  /** The customer refused the parcel at the door. */
  | "REFUSED";

/** Platform commission charged when an order is delivered (amount = base × rate, in EGP). */
export interface OrderCommission {
  rate: number;
  base: number;
  amount: number;
}

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
  /** Set on delivered orders (admin view); null when no commission was charged. */
  commission?: OrderCommission | null;
  /** The coupon used at checkout; null/missing when none. Its discount is part of discountTotal. */
  coupon?: OrderCoupon | null;
  /** Set once the store ships the order; null/missing before that. */
  shipment?: OrderShipment | null;
}

/** BRAND = a store's own coupon; PLATFORM = a Fatrina coupon, credited back to the store on delivery. */
export type CouponFunder = "BRAND" | "PLATFORM";

export interface OrderCoupon {
  code: string;
  /** EGP taken off the order. */
  discount: number;
  fundedBy: CouponFunder;
}

export interface OrderShipment {
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  shippedAt: string;
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
  /** 0 monthly and yearly = free plan, activates without payment. */
  limits: PlanLimits;
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

// ---------- Commission ----------

/** GET/PATCH /admin/platform-settings. */
export interface PlatformSettings {
  /** Fraction of the order, e.g. 0.05 = 5%. */
  commissionRate: number;
  /** Days a store has to pay what it owes before it stops receiving orders. */
  settlementDays: number;
  /** EGP; owing more than this stops new orders right away. */
  maxUnpaidBalance: number;
}

/** GET /admin/commissions/summary (money in EGP). */
export interface CommissionSummary {
  commissionThisMonth: number;
  ordersThisMonth: number;
  outstanding: number;
  storesOwing: number;
  storesBlocked: number;
  pendingSettlements: number;
}

/** GET /admin/commissions/brands — one row per store with a ledger, owing/blocked first. */
export interface BrandCommissionRow {
  brandId: string;
  name: string;
  slug: string;
  balance: number;
  totalCommission: number;
  dueSince: string | null;
  blocked: boolean;
}

/** GET /admin/commissions/brands/:brandId (also returned by /adjust). */
export interface BrandCommissionStatus extends PlatformSettings {
  /** Positive = the store owes the platform. */
  balance: number;
  dueSince: string | null;
  dueBy: string | null;
  blocked: boolean;
  pendingSettlement: { id: string; amount: number; createdAt: string } | null;
}

export type LedgerType = "COMMISSION" | "REVERSAL" | "PAYMENT" | "ADJUSTMENT";

export interface LedgerEntry {
  _id: string;
  brandId: string;
  type: LedgerType;
  /** + = the store owes more, − = paid / credit. */
  amount: number;
  orderId?: string;
  orderNumber?: string;
  rate?: number;
  base?: number;
  note?: string;
  createdAt: string;
}

export type SettlementStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

/** GET /admin/settlements — a store paying what it owes, with an InstaPay receipt. */
export interface Settlement {
  id: string;
  _id: string;
  brandId: string;
  brandName: string;
  amount: number;
  transactionReference: string;
  status: SettlementStatus;
  createdAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

// ---------- Promotions ----------

export type CouponType = "PERCENT" | "FIXED";

/** GET /admin/coupons — Fatrina-wide coupons (brandId null), valid in every store; the platform pays the discount. */
export interface AdminCoupon {
  _id: string;
  brandId: null;
  /** Stored upper-case. */
  code: string;
  type: CouponType;
  /** PERCENT: 1..90 (%); FIXED: EGP >= 1. */
  value: number;
  /** Cap on a percent discount, EGP; null = no cap. */
  maxDiscount: number | null;
  minSubtotal: number;
  /** null = unlimited. */
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  createdAt: string;
}

/** GET /admin/campaigns — a season (e.g. «الجمعة البيضاء») stores join by putting products on sale inside it. */
export interface Campaign {
  _id: string;
  nameAr: string;
  slug: string;
  descriptionAr: string;
  startsAt: string;
  endsAt: string;
  /** Smallest sale percent a product needs to count in the season. */
  minPercent: number;
  /** Hex, e.g. #F16B21. */
  color: string;
  isActive: boolean;
  createdAt: string;
}

/** Public product card (GET /products?campaignId=…). */
export interface ProductCard {
  id: string;
  title: string;
  /** Current (sale) price. */
  price: number;
  compareAtPrice: number | null;
  sale: { percent: number; endsAt: string; campaignId: string | null } | null;
  imageUrl: string | null;
  brand: { id?: string; name: string; slug?: string };
}

// ---------- Support ----------

export type TicketType = "NOT_RECEIVED" | "NOT_AS_DESCRIBED" | "ORDER_PROBLEM" | "PAYMENT" | "ACCOUNT" | "OTHER";
/** WAITING_STORE, OPEN and ESCALATED are the active ones; replies and decisions only work on those. */
export type TicketStatus = "WAITING_STORE" | "OPEN" | "ESCALATED" | "RESOLVED" | "CLOSED";
export type TicketOutcome = "CUSTOMER" | "STORE" | "NEUTRAL";

export interface TicketMessage {
  id: string;
  author: "CUSTOMER" | "BRAND" | "ADMIN";
  text: string;
  /** Public image URLs. */
  images: string[];
  at: string;
}

/** GET /admin/tickets (list, no messages). Sorted escalated first. */
export interface Ticket {
  id: string;
  /** e.g. T-261021-123456. */
  number: string;
  userName: string;
  type: TicketType;
  subject: string;
  orderId: string | null;
  orderNumber: string | null;
  brandId: string | null;
  brandName: string | null;
  /** Buyer-protection case ("didn't arrive" / "not as described"): the store has 48 hours to answer. */
  protection: boolean;
  /** When the store's reply window ends (protection cases only). */
  storeDeadline: string | null;
  status: TicketStatus;
  escalatedAt: string | null;
  resolution: { outcome: TicketOutcome; note: string; at: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /admin/tickets/:id (also returned by reply and resolve). */
export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
}

/** GET /admin/tickets/counts — active tickets only. */
export type TicketCounts = Record<"WAITING_STORE" | "OPEN" | "ESCALATED", number>;

// ---------- Returns ----------

export type ReturnReason = "WRONG_SIZE" | "DAMAGED" | "NOT_AS_DESCRIBED" | "WRONG_ITEM" | "CHANGED_MIND" | "OTHER";
export type ReturnStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "RECEIVED" | "REFUNDED" | "CANCELLED";

/** GET /admin/returns — a customer sending items back from a delivered order. */
export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  brandId: string;
  customerName: string;
  items: {
    productId: string;
    variantId: string;
    title: string;
    imageUrl?: string;
    size?: string;
    color?: string;
    unitPrice: number;
    quantity: number;
  }[];
  reason: ReturnReason;
  note?: string;
  /** Public image URLs. */
  images: string[];
  /** EGP: the items' value minus their share of the order's discount. */
  refundAmount: number;
  status: ReturnStatus;
  history: { status: ReturnStatus; at: string; actor: "CUSTOMER" | "BRAND" | "ADMIN"; note?: string | null }[];
  /** EGP of commission given back to the store once refunded (0 before that). */
  commissionReversed: number;
  createdAt: string;
  updatedAt: string;
}

// ---------- Ads ----------

export type AdPlacement = "SEARCH_TOP" | "CATEGORY_TOP" | "HOME_BANNER";
/** EXPIRED isn't stored: the API reports an ACTIVE ad past its end that way. */
export type AdStatus = "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "EXPIRED";

/** GET /admin/ads — a store paying (InstaPay) to put a product in a sponsored slot for 1–4 weeks. */
export interface Ad {
  id: string;
  brandId: string;
  brandName: string;
  productId: string;
  productTitle: string;
  placement: AdPlacement;
  placementName: string;
  weeks: number;
  /** EGP: week price × weeks, fixed when bought. */
  price: number;
  transactionReference: string;
  status: AdStatus;
  /** Set on approval; the ad runs from approval for the weeks paid. */
  startsAt: string | null;
  endsAt: string | null;
  rejectReason: string | null;
  impressions: number;
  clicks: number;
  createdAt: string;
}

/** GET /ads/prices (public). */
export interface AdPrice {
  placement: AdPlacement;
  name: string;
  /** EGP per week. */
  weekPrice: number;
  /** Sponsored products shown at once in this placement. */
  slots: number;
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
