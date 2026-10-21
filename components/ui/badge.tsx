import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2 border-line",
  accent: "bg-accent-soft text-accent border-accent/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/20",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-meta font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  AWAITING_PROOF: { label: "بانتظار الإيصال", tone: "neutral" },
  PENDING_REVIEW: { label: "قيد المراجعة", tone: "warning" },
  APPROVED: { label: "معتمد", tone: "success" },
  REJECTED: { label: "مرفوض", tone: "danger" },
  CANCELLED: { label: "ملغي", tone: "neutral" },
};

export const STORE_TYPE: Record<string, { label: string; plural: string }> = {
  BRAND: { label: "براند", plural: "براندات" },
  SHOWROOM: { label: "معرض", plural: "معارض" },
  WAREHOUSE: { label: "مخزن", plural: "مخازن" },
  SHOP: { label: "محل", plural: "محلات" },
};

export const BRAND_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING_REVIEW: { label: "قيد المراجعة", tone: "warning" },
  ACTIVE: { label: "مفعّل", tone: "success" },
  REJECTED: { label: "مرفوض", tone: "danger" },
  SUSPENDED: { label: "موقوف", tone: "danger" },
};

export const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING_PAYMENT: { label: "بانتظار الدفع", tone: "warning" },
  ACTIVE: { label: "فعّال", tone: "success" },
  EXPIRED: { label: "منتهي", tone: "neutral" },
  CANCELLED: { label: "ملغي", tone: "neutral" },
};

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  AWAITING_CONFIRMATION: { label: "مستني تأكيد العميل", tone: "neutral" },
  PENDING: { label: "قيد المراجعة", tone: "warning" },
  CONFIRMED: { label: "تم التأكيد", tone: "accent" },
  PROCESSING: { label: "قيد التجهيز", tone: "accent" },
  SHIPPED: { label: "تم الشحن", tone: "accent" },
  DELIVERED: { label: "تم التسليم", tone: "success" },
  CANCELLED: { label: "ملغي", tone: "neutral" },
  REFUSED: { label: "رفض الاستلام", tone: "danger" },
};

/** Commission settlements: a store paying what it owes by InstaPay. */
export const SETTLEMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING_REVIEW: { label: "قيد المراجعة", tone: "warning" },
  APPROVED: { label: "معتمد", tone: "success" },
  REJECTED: { label: "مرفوض", tone: "danger" },
};

export const REPORT_STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: "مفتوح", tone: "warning" },
  RESOLVED: { label: "تم الإجراء", tone: "success" },
  DISMISSED: { label: "مرفوض", tone: "neutral" },
};

export const USER_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "نشط", tone: "success" },
  SUSPENDED: { label: "موقوف", tone: "danger" },
};

/** Support tickets. ESCALATED is the one waiting for an admin's decision. */
export const TICKET_STATUS: Record<string, { label: string; tone: Tone }> = {
  WAITING_STORE: { label: "مستنية رد المتجر", tone: "neutral" },
  OPEN: { label: "مفتوحة", tone: "accent" },
  ESCALATED: { label: "محتاجة حكم", tone: "danger" },
  RESOLVED: { label: "اتحلت", tone: "success" },
  CLOSED: { label: "مقفولة", tone: "neutral" },
};

export const RETURN_STATUS: Record<string, { label: string; tone: Tone }> = {
  REQUESTED: { label: "مستني رد المتجر", tone: "warning" },
  APPROVED: { label: "اتوافق عليه", tone: "accent" },
  REJECTED: { label: "اترفض", tone: "danger" },
  RECEIVED: { label: "المتجر استلم", tone: "accent" },
  REFUNDED: { label: "الفلوس رجعت", tone: "success" },
  CANCELLED: { label: "اتلغى", tone: "neutral" },
};

/** Paid placements. */
export const AD_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING_REVIEW: { label: "قيد المراجعة", tone: "warning" },
  ACTIVE: { label: "شغال", tone: "success" },
  REJECTED: { label: "مرفوض", tone: "danger" },
  EXPIRED: { label: "انتهى", tone: "neutral" },
};
