"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { Page } from "@/lib/api/client";
import type { AuditEntry } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { ORDER_STATUS } from "@/components/ui/badge";
import { ErrorState, Skeleton } from "@/components/ui/states";

/** Every action the API records, in words an admin reads at a glance. */
export const AUDIT_ACTIONS: Record<string, string> = {
  ORDER_DELETED: "حذف الطلب",
  ORDER_RESTORED: "استرجع الطلب",
  PAYMENT_DELETED: "حذف الدفعة",
  PAYMENT_RESTORED: "استرجع الدفعة",
  BRAND_DELETED: "حذف المتجر",
  BRAND_RESTORED: "استرجع المتجر",
  USER_DELETED: "حذف الحساب",
  USER_RESTORED: "استرجع الحساب",
  CATEGORY_DELETED: "حذف التصنيف",
  CATEGORY_RESTORED: "استرجع التصنيف",
  PLAN_DELETED: "حذف الباقة",
  PLAN_RESTORED: "استرجع الباقة",
  REPORT_DELETED: "حذف البلاغ",
  REPORT_RESTORED: "استرجع البلاغ",
  REVIEW_DELETED: "حذف التقييم",
  REVIEW_RESTORED: "استرجع التقييم",
  BRAND_APPLIED: "قدّم طلب براند",
  BRAND_RESUBMITTED: "أعاد إرسال طلب البراند",
  BRAND_APPROVED: "وافق على البراند",
  BRAND_REJECTED: "رفض طلب البراند",
  BRAND_SUSPENDED: "أوقف البراند",
  BRAND_REINSTATED: "أعاد تفعيل البراند",
  SUBSCRIPTION_REQUESTED: "طلب اشتراكًا",
  PAYMENT_PROOF_SUBMITTED: "رفع إيصال دفع",
  PAYMENT_PROOF_VIEWED: "اطّلع على إيصال دفع",
  PAYMENT_APPROVED: "اعتمد دفعة",
  PAYMENT_REJECTED: "رفض إيصال دفع",
  PLAN_UPDATED: "عدّل باقة",
  ORDER_STATUS_CHANGED: "غيّر حالة طلب",
  REPORT_RESOLVED: "أنهى بلاغًا باتخاذ إجراء",
  REPORT_DISMISSED: "رفض بلاغًا",
  REVIEW_HIDDEN: "أخفى تقييمًا",
  REVIEW_VISIBLE: "أظهر تقييمًا",
  PRODUCT_TAKEN_DOWN: "أزال منتجًا",
  USER_ACTIVE: "أعاد تفعيل مستخدم",
  USER_SUSPENDED: "أوقف مستخدمًا",
  COMMISSION_TERMS_UPDATED: "عدّل شروط العمولة",
  COMMISSION_ADJUSTED: "سجّل تسوية عمولة يدوية",
  SETTLEMENT_PROOF_VIEWED: "اطّلع على إيصال سداد عمولة",
  SETTLEMENT_APPROVED: "اعتمد سداد عمولة",
  SETTLEMENT_REJECTED: "رفض إيصال سداد عمولة",
  SUBSCRIPTION_FREE_ACTIVATED: "فعّل باقة مجانية",
  COUPON_CREATED: "أنشأ كوبون فاترينة",
  CAMPAIGN_CREATED: "أنشأ موسم عروض",
  CAMPAIGN_UPDATED: "عدّل موسم عروض",
};

export const ENTITY_LABEL: Record<string, string> = {
  Brand: "براند",
  Payment: "دفعة",
  Subscription: "اشتراك",
  SubscriptionPlan: "باقة",
  Order: "طلب",
  Report: "بلاغ",
  Review: "تقييم",
  Product: "منتج",
  User: "مستخدم",
  Settlement: "سداد عمولة",
  PlatformSettings: "إعدادات المنصة",
  Coupon: "كوبون",
  Campaign: "موسم عروض",
};

export function actorName(entry: AuditEntry) {
  if (entry.actorType === "SYSTEM") return "النظام";
  if (entry.actorId && typeof entry.actorId === "object") return entry.actorId.name;
  return entry.actorType === "ADMIN" ? "مشرف" : "مستخدم";
}

/** The reason/note attached to an action, when there is one. */
export function auditNote(entry: AuditEntry): string | null {
  const d = entry.data ?? {};
  const note = (d.reason ?? d.note) as string | undefined;
  if (note) return note;
  if (entry.action === "ORDER_STATUS_CHANGED" && d.from && d.to) {
    const label = (s: unknown) => ORDER_STATUS[String(s)]?.label ?? String(s);
    return `من «${label(d.from)}» إلى «${label(d.to)}»`;
  }
  return null;
}

/** Compact timeline of audit entries (used on detail pages). */
export function ActivityList({ query, empty }: { query: UseQueryResult<Page<AuditEntry>>; empty: string }) {
  if (query.isPending) return <Skeleton className="h-24 w-full" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} className="py-6" />;
  if (!query.data.items.length) return <p className="text-ui text-ink-3">{empty}</p>;
  return (
    <ol className="relative flex flex-col gap-4 border-s border-line ps-4">
      {query.data.items.map((e) => (
        <li key={e._id} className="relative">
          <span aria-hidden className="absolute -start-[21px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-brand" />
          <p className="text-ui text-ink">
            <span className="font-semibold">{actorName(e)}</span> {AUDIT_ACTIONS[e.action] ?? e.action}
          </p>
          {auditNote(e) && <p className="mt-0.5 text-ui text-ink-2">{auditNote(e)}</p>}
          <time dateTime={e.createdAt} className="text-meta text-ink-3">
            {formatDateTime(e.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}
