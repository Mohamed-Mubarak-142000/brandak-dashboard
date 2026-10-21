"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import type { BrandCommissionStatus, LedgerType } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import {
  DetailList,
  DetailRow,
  Muted,
  Panel,
} from "@/components/data/detail-list";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/states";

export const LEDGER_TYPE: Record<
  LedgerType,
  {
    label: string;
    tone: "neutral" | "accent" | "success" | "warning" | "danger";
  }
> = {
  COMMISSION: { label: "عمولة طلب", tone: "accent" },
  REVERSAL: { label: "مرتجع", tone: "neutral" },
  PAYMENT: { label: "سداد", tone: "success" },
  // Manual corrections, and the platform crediting a store for a Fatrina coupon (the note says which).
  ADJUSTMENT: { label: "تسوية", tone: "warning" },
  // A reseller's margin the store collected in cash (+), or gave back on a return (−); Fatrina pays it to the reseller.
  RESELLER_MARGIN: { label: "ربح مسوّق", tone: "accent" },
};

/** 0.05 → "5%", 0.025 → "2.5%". */
export const formatRate = (rate: number) =>
  `${formatNumber(Math.round(rate * 10_000) / 100)}%`;

/** What a store's balance means for it right now. */
export function BalanceBadge({
  balance,
  blocked,
}: {
  balance: number;
  blocked: boolean;
}) {
  if (blocked) return <Badge tone="danger">متوقف عن الطلبات</Badge>;
  if (balance > 0) return <Badge tone="warning">عليه مستحقات</Badge>;
  if (balance < 0) return <Badge tone="accent">له رصيد</Badge>;
  return <Badge tone="success">مسدّد</Badge>;
}

/** "+25 ج.م" in the owing colour, "−25 ج.م" in the paid colour. */
export function SignedMoney({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  return (
    <span
      dir="ltr"
      className={cn(
        "num font-semibold",
        amount > 0 ? "text-ink" : amount < 0 ? "text-success" : "text-ink-3",
        className,
      )}
    >
      {amount > 0 ? "+" : amount < 0 ? "−" : ""}
      {formatMoney(Math.abs(amount))}
    </span>
  );
}

export function useBrandCommission(brandId: string) {
  return useQuery({
    queryKey: qk.commissionBrand(brandId),
    queryFn: () =>
      api.get<BrandCommissionStatus>(`/admin/commissions/brands/${brandId}`),
  });
}

/** The store's balance and when it must pay, as label/value rows. */
export function CommissionFacts({ status }: { status: BrandCommissionStatus }) {
  return (
    <>
      <DetailRow label="المستحق الآن" strong>
        {status.balance < 0 ? (
          <>
            <span className="num text-success">
              {formatMoney(-status.balance)}
            </span>
            <span className="text-meta font-normal text-ink-3">
              رصيد للمتجر
            </span>
          </>
        ) : (
          <span className="num">{formatMoney(status.balance)}</span>
        )}
      </DetailRow>
      <DetailRow label="الحالة">
        <BalanceBadge balance={status.balance} blocked={status.blocked} />
      </DetailRow>
      <DetailRow label="مستحق من">
        {status.dueSince ? formatDate(status.dueSince) : <Muted>—</Muted>}
      </DetailRow>
      <DetailRow label="آخر موعد للسداد">
        {status.dueBy ? (
          <span className={cn(status.blocked && "text-danger")}>
            {formatDate(status.dueBy)}
          </span>
        ) : (
          <Muted>—</Muted>
        )}
      </DetailRow>
      <DetailRow label="إيصال قيد المراجعة">
        {status.pendingSettlement ? (
          <Link
            href="/commissions?tab=settlements"
            className="text-accent underline-offset-4 hover:underline"
          >
            <span className="num">
              {formatMoney(status.pendingSettlement.amount)}
            </span>{" "}
            — أُرسل {formatDate(status.pendingSettlement.createdAt)}
          </Link>
        ) : (
          <Muted>لا يوجد</Muted>
        )}
      </DetailRow>
    </>
  );
}

/** Compact commission summary for the store's detail page, linking to the full ledger. */
export function CommissionPanel({ brandId }: { brandId: string }) {
  const status = useBrandCommission(brandId);
  return (
    <Panel>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-ui font-semibold text-ink">العمولة</h2>
        <Link
          href={`/commissions/${brandId}`}
          className="inline-flex items-center gap-1 text-ui text-accent underline-offset-4 hover:underline"
        >
          السجل والتسوية
          <ArrowLeft aria-hidden className="size-4" />
        </Link>
      </div>
      {status.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : status.isError || !status.data ? (
        <p className="text-ui text-ink-3">تعذّر تحميل حالة العمولة.</p>
      ) : (
        <DetailList>
          <CommissionFacts status={status.data} />
        </DetailList>
      )}
    </Panel>
  );
}
