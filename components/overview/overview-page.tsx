"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Flag, HandCoins, Store } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import type { AdminOverview, BrandCommissionRow, CommissionSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { Panel } from "@/components/data/detail-list";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";

const NO_OWING: BrandCommissionRow[] = [];

const RANGES = [
  { value: "7", label: "7 أيام" },
  { value: "30", label: "30 يومًا" },
  { value: "90", label: "90 يومًا" },
];

/** The decisions waiting on the admin — the reason to open the dashboard at all. */
function Queue({ count, label, hint, href, icon: Icon }: { count: number; label: string; hint: string; href: string; icon: typeof Flag }) {
  const waiting = count > 0;
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 rounded-md border px-5 py-4 transition-colors",
        waiting ? "border-brand/40 bg-surface hover:border-brand" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <Icon aria-hidden className={cn("size-5 shrink-0", waiting ? "text-brand" : "text-ink-3")} />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium text-ink">{label}</span>
        <span className="block text-meta text-ink-3">{waiting ? hint : "لا يوجد ما ينتظرك هنا"}</span>
      </span>
      <span className={cn("num font-display text-page leading-none", waiting ? "text-accent" : "text-ink-3")}>{count}</span>
      <ArrowLeft aria-hidden className="size-4 text-ink-3 transition-transform group-hover:-translate-x-0.5" />
    </Link>
  );
}

/** One figure in the ledger line: label above, value below, no card chrome. */
function Figure({ label, value, note, lead }: { label: string; value: React.ReactNode; note?: React.ReactNode; lead?: boolean }) {
  return (
    <div className="min-w-0 py-3 sm:border-s sm:border-line sm:px-5 sm:py-4 sm:first:border-s-0 sm:first:ps-0">
      <dt className="text-meta text-ink-2">{label}</dt>
      <dd className={cn("num mt-1 font-semibold whitespace-nowrap text-ink", lead ? "text-section sm:text-page" : "text-section")}>{value}</dd>
      {note && <dd className="mt-0.5 text-meta text-ink-3">{note}</dd>}
    </div>
  );
}

/** Stores that owe the most — a single series, so one hue and values written beside the bars. */
function OwingBars({ rows }: { rows: BrandCommissionRow[] }) {
  const top = useMemo(() => rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 6), [rows]);
  const max = Math.max(1, ...top.map((r) => r.balance));

  if (!top.length) return <p className="text-ui text-ink-3">مفيش متاجر عليها مستحقات دلوقتي.</p>;
  return (
    <ul className="flex flex-col gap-3" aria-label="أكثر المتاجر مستحقات">
      {top.map((r) => (
        <li key={r.brandId}>
          <Link href={`/commissions/${r.brandId}`} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 hover:text-accent">
            <span className={cn("truncate text-ui", r.blocked ? "text-danger" : "text-ink-2")}>{r.name || "متجر"}</span>
            <span className="h-2.5 rounded-e-[4px] bg-sunken" aria-hidden>
              <span className="block h-full rounded-e-[4px] bg-brand" style={{ width: `${(r.balance / max) * 100}%` }} />
            </span>
            <span className="num min-w-16 text-end text-ui font-semibold text-ink">
              {formatMoney(r.balance)}
              {r.blocked && <span className="sr-only"> — متوقف عن الطلبات</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const BRAND_ROWS: { key: keyof AdminOverview["brands"]["byStatus"]; label: string; href: string }[] = [
  { key: "ACTIVE", label: "مفعّلة", href: "/brands?status=ACTIVE" },
  { key: "PENDING_REVIEW", label: "قيد المراجعة", href: "/brands?status=PENDING_REVIEW" },
  { key: "SUSPENDED", label: "موقوفة", href: "/brands?status=SUSPENDED" },
  { key: "REJECTED", label: "مرفوضة", href: "/brands?status=REJECTED" },
];

export function OverviewPage() {
  const url = useUrlState();
  const range = RANGES.some((r) => r.value === url.get("range")) ? url.get("range")! : "30";
  const from = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - Number(range) + 1);
    return d.toISOString();
  }, [range]);

  const overview = useQuery({
    queryKey: ["overview", range],
    queryFn: () => api.get<AdminOverview>("/admin/analytics/overview", { from }),
    refetchInterval: 60_000,
  });
  const commission = useQuery({
    queryKey: qk.commissionSummary,
    queryFn: () => api.get<CommissionSummary>("/admin/commissions/summary"),
    refetchInterval: 60_000,
  });
  const owing = useQuery({ queryKey: qk.commissionBrands, queryFn: () => api.get<BrandCommissionRow[]>("/admin/commissions/brands") });

  const rangeSwitch = (
    <div role="radiogroup" aria-label="الفترة" className="inline-flex rounded-sm border border-line-strong bg-surface p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={range === r.value}
          onClick={() => url.set({ range: r.value === "30" ? null : r.value })}
          className={cn(
            "h-9 rounded-[3px] px-3 text-ui transition-colors",
            range === r.value ? "bg-ink font-semibold text-ground" : "text-ink-2 hover:text-ink",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  return (
    <PageShell>
      <PageHeader title="نظرة عامة" description="ما ينتظر قرارك الآن، وأداء المنصة في الفترة المختارة." actions={rangeSwitch} />

      {overview.isPending ? (
        <div className="mt-8 grid gap-6">
          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-24" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      ) : overview.isError || !overview.data ? (
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      ) : (
        <Body data={overview.data} commission={commission.data} owing={owing.data ?? NO_OWING} />
      )}
    </PageShell>
  );
}

function Body({ data, commission, owing }: { data: AdminOverview; commission?: CommissionSummary; owing: BrandCommissionRow[] }) {
  const q = data.queues;
  const money = (n?: number) => (n === undefined ? "—" : formatMoney(n));
  return (
    <>
      <section aria-labelledby="queues" className="mt-8">
        <h2 id="queues" className="mb-3 text-ui font-semibold text-ink">
          ينتظر قرارك
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Queue
            count={commission?.pendingSettlements ?? 0}
            label="إيصالات سداد العمولة"
            hint="طابقها مع InstaPay قبل خصمها من المستحق"
            href="/commissions?tab=settlements"
            icon={HandCoins}
          />
          <Queue count={q.pendingBrandApplications} label="طلبات براندات جديدة" hint="راجع البيانات قبل ظهور المتجر" href="/brands?status=PENDING_REVIEW" icon={Store} />
          <Queue count={q.openReports} label="بلاغات مفتوحة" hint="محتوى أبلغ عنه العملاء" href="/reports" icon={Flag} />
        </div>
      </section>

      <section aria-labelledby="ledger" className="mt-8">
        <h2 id="ledger" className="sr-only">
          الأرقام الأساسية
        </h2>
        <Panel className="py-1 sm:py-1">
          <dl className="grid grid-cols-2 gap-x-4 sm:grid-cols-5 sm:gap-x-0">
            <Figure
              lead
              label="عمولة الشهر"
              value={money(commission?.commissionThisMonth)}
              note={commission ? `من ${formatNumber(commission.ordersThisMonth)} طلب اتسلّم` : undefined}
            />
            <Figure label="المستحق على المتاجر" value={money(commission?.outstanding)} note={commission ? `على ${formatNumber(commission.storesOwing)} متجر` : undefined} />
            <Figure
              label="متاجر متوقفة"
              value={commission ? formatNumber(commission.storesBlocked) : "—"}
              note="مش بتستقبل طلبات لحد ما تسدد"
            />
            <Figure label="براندات ظاهرة للعملاء" value={formatNumber(data.brands.visible)} />
            <Figure label="قيمة الطلبات" value={formatMoney(data.orders.gmv)} note={`${formatNumber(data.orders.count)} طلب في الفترة — ليست إيرادًا للمنصة`} />
          </dl>
        </Panel>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-ui font-semibold text-ink">أكثر المتاجر مستحقات</h2>
            <Link href="/commissions" className="text-meta text-accent underline-offset-4 hover:underline">
              كل العمولات
            </Link>
          </div>
          <p className="mb-4 mt-0.5 text-meta text-ink-3">العمولة اللي لسه متدفعتش؛ الأحمر متوقف عن استقبال الطلبات</p>
          <OwingBars rows={owing} />
        </Panel>
        <Panel>
          <h2 className="text-ui font-semibold text-ink">البراندات</h2>
          <p className="mb-2 mt-0.5 text-meta text-ink-3">
            <span className="num">{formatNumber(data.users.total)}</span> مستخدم مسجّل، منهم <span className="num">{formatNumber(data.users.newInRange)}</span> جديد في الفترة
          </p>
          <ul className="divide-y divide-line">
            {BRAND_ROWS.map((r) => (
              <li key={r.key}>
                <Link href={r.href} className="flex items-center justify-between py-2.5 text-ui hover:text-accent">
                  <span className="text-ink-2">{r.label}</span>
                  <span className="num font-semibold text-ink">{formatNumber(data.brands.byStatus[r.key] ?? 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <p className="mt-4 text-meta text-ink-3">
        الفترة من {formatDate(data.range.from)} إلى {formatDate(data.range.to)}. الأرقام تتحدث تلقائيًا كل دقيقة.
      </p>
    </>
  );
}
