"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Flag, ReceiptText, Store } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import type { AdminOverview, Plan } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { Panel } from "@/components/data/detail-list";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";

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

/** Active subscriptions per plan — a single series, so one hue and values written beside the bars. */
function PlanBars({ byPlan, plans }: { byPlan: Record<string, number>; plans: Plan[] }) {
  const rows = useMemo(() => {
    const names = new Map(plans.map((p) => [p.code, { name: p.nameAr, order: p.sortOrder }]));
    return Object.entries(byPlan)
      .map(([code, count]) => ({ code, count, name: names.get(code)?.name ?? code, order: names.get(code)?.order ?? 99 }))
      .sort((a, b) => a.order - b.order);
  }, [byPlan, plans]);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((s, r) => s + r.count, 0);

  if (!rows.length) return <p className="text-ui text-ink-3">لا توجد اشتراكات فعّالة حتى الآن.</p>;
  return (
    <ul className="flex flex-col gap-3" aria-label="الاشتراكات الفعّالة حسب الباقة">
      {rows.map((r) => (
        <li key={r.code} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3" title={`${r.name}: ${r.count} من ${total}`}>
          <span className="truncate text-ui text-ink-2">{r.name}</span>
          <span className="h-2.5 rounded-e-[4px] bg-sunken" aria-hidden>
            <span className="block h-full rounded-e-[4px] bg-brand" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="num min-w-8 text-end text-ui font-semibold text-ink">
            {r.count}
            <span className="sr-only"> اشتراك فعّال في باقة {r.name}</span>
          </span>
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
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api.get<Plan[]>("/admin/plans") });

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
        <Body data={overview.data} plans={plans.data ?? []} />
      )}
    </PageShell>
  );
}

function Body({ data, plans }: { data: AdminOverview; plans: Plan[] }) {
  const q = data.queues;
  return (
    <>
      <section aria-labelledby="queues" className="mt-8">
        <h2 id="queues" className="mb-3 text-ui font-semibold text-ink">
          ينتظر قرارك
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Queue count={q.pendingPayments} label="إيصالات دفع" hint="طابقها مع InstaPay لتفعيل الاشتراكات" href="/payments" icon={ReceiptText} />
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
            <Figure lead label="الإيراد الشهري المتكرر" value={formatMoney(data.subscriptions.mrr)} note="من الاشتراكات الفعّالة الآن" />
            <Figure label="محصّل في الفترة" value={formatMoney(data.subscriptions.collectedInRange)} note={`${formatNumber(data.subscriptions.approvedPaymentsInRange)} دفعة معتمدة`} />
            <Figure label="اشتراكات فعّالة" value={formatNumber(data.subscriptions.active)} note={`${formatNumber(data.subscriptions.renewalsInRange)} تجديد في الفترة`} />
            <Figure label="براندات ظاهرة للعملاء" value={formatNumber(data.brands.visible)} note={data.brands.expiringIn7Days ? `${data.brands.expiringIn7Days} ينتهي اشتراكها خلال 7 أيام` : "لا اشتراكات تنتهي قريبًا"} />
            <Figure label="قيمة الطلبات" value={formatMoney(data.orders.gmv)} note={`${formatNumber(data.orders.count)} طلب — ليست إيرادًا للمنصة`} />
          </dl>
        </Panel>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="text-ui font-semibold text-ink">الاشتراكات الفعّالة حسب الباقة</h2>
          <p className="mb-4 mt-0.5 text-meta text-ink-3">عدد البراندات المشتركة الآن في كل باقة</p>
          <PlanBars byPlan={data.subscriptions.byPlan} plans={plans} />
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
