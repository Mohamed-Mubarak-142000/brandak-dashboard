/**
 * Response shapes used by the dashboard. Request bodies are typed from the generated
 * OpenAPI schema (`schema.d.ts`); responses are described here because the API returns
 * service objects that Swagger doesn't model.
 */

export type PaymentStatus = "AWAITING_PROOF" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED";
export type BrandStatus = "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "SUSPENDED";
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
