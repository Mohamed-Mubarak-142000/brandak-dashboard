"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import type { BrandCommissionRow, CommissionSummary, PlatformSettings } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, formatNumber, formatRelative, normalizeSearch } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { Panel } from "@/components/data/detail-list";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { SearchInput } from "@/components/data/search-input";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { BalanceBadge, formatRate } from "./commission-status";
import { SettlementsTab } from "./settlements-tab";

const helper = createColumnHelper<TableFeatures, BrandCommissionRow>();
const NO_ROWS: BrandCommissionRow[] = [];

/** One figure in the summary line: label above, value below (same ledger style as the overview). */
function Figure({ label, value, note, tone, href }: { label: string; value: React.ReactNode; note?: React.ReactNode; tone?: "danger" | "accent"; href?: string }) {
  const body = (
    <>
      <dt className="text-meta text-ink-2">{label}</dt>
      <dd className={cn("num mt-1 text-section font-semibold whitespace-nowrap", tone === "danger" ? "text-danger" : tone === "accent" ? "text-accent" : "text-ink")}>{value}</dd>
      {note && <dd className="mt-0.5 text-meta text-ink-3">{note}</dd>}
    </>
  );
  return (
    <div className="min-w-0 border-line py-3 lg:border-s lg:px-5 lg:py-4 lg:first:border-s-0 lg:first:ps-0">
      {href ? (
        <Link href={href} className="block rounded-sm hover:text-accent">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

function SummaryTiles() {
  const summary = useQuery({
    queryKey: qk.commissionSummary,
    queryFn: () => api.get<CommissionSummary>("/admin/commissions/summary"),
    refetchInterval: 60_000,
  });
  if (summary.isPending) return <Skeleton className="h-24 w-full" />;
  if (summary.isError || !summary.data) return <ErrorState error={summary.error} onRetry={() => summary.refetch()} className="py-8" />;
  const s = summary.data;
  return (
    <Panel className="py-1 sm:py-1">
      <dl className="grid grid-cols-2 gap-x-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-0">
        <Figure label="عمولة الشهر" value={formatMoney(s.commissionThisMonth)} note="من الطلبات المسلَّمة" />
        <Figure label="عدد الطلبات" value={formatNumber(s.ordersThisMonth)} note="اتحسب عليها عمولة الشهر ده" />
        <Figure label="المستحق على المتاجر" value={formatMoney(s.outstanding)} note="لسه متدفعش" />
        <Figure label="متاجر عليها فلوس" value={formatNumber(s.storesOwing)} />
        <Figure label="متاجر متوقفة" value={formatNumber(s.storesBlocked)} tone={s.storesBlocked ? "danger" : undefined} note="مش بتستقبل طلبات جديدة" />
        <Figure
          label="إيصالات مستنية مراجعة"
          value={formatNumber(s.pendingSettlements)}
          tone={s.pendingSettlements ? "accent" : undefined}
          href="/commissions?tab=settlements"
          note="راجعها من التبويب"
        />
      </dl>
    </Panel>
  );
}

function TermsLine() {
  const terms = useQuery({ queryKey: qk.platformSettings, queryFn: () => api.get<PlatformSettings>("/admin/platform-settings") });
  if (!terms.data) return null;
  const t = terms.data;
  return (
    <p className="mt-3 text-meta text-ink-3">
      العمولة الحالية <span className="num font-semibold text-ink-2">{formatRate(t.commissionRate)}</span> من كل طلب مسلَّم. المتجر بيقف عن استقبال الطلبات لو المستحق
      عدّى <span className="num font-semibold text-ink-2">{formatMoney(t.maxUnpaidBalance)}</span> أو فات عليه <span className="num font-semibold text-ink-2">{t.settlementDays}</span> يوم
      من غير سداد.{" "}
      <Link href="/settings" className="text-accent underline-offset-4 hover:underline">
        تعديل الشروط
      </Link>
    </p>
  );
}

function BrandsTab() {
  const router = useRouter();
  const url = useUrlState();
  const q = url.get("q") ?? "";
  const list = useQuery({
    queryKey: qk.commissionBrands,
    queryFn: () => api.get<BrandCommissionRow[]>("/admin/commissions/brands"),
  });

  // The API returns every store with a ledger (not paginated), so search runs here.
  const rows = useMemo(() => {
    const all = list.data ?? NO_ROWS;
    const needle = normalizeSearch(q);
    return needle ? all.filter((b) => normalizeSearch(b.name).includes(needle) || normalizeSearch(b.slug).includes(needle)) : all;
  }, [list.data, q]);

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "المتجر",
          cell: (info) => (
            <span className="flex flex-col">
              <Link
                href={`/commissions/${info.row.original.brandId}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-ink underline-offset-4 hover:text-accent hover:underline"
              >
                {info.getValue() || "متجر محذوف"}
              </Link>
              <span className="num text-meta text-ink-3">{info.row.original.slug}</span>
            </span>
          ),
        }),
        helper.accessor("balance", {
          header: "المستحق",
          cell: (info) => {
            const v = info.getValue();
            return v < 0 ? (
              <span className="num font-semibold text-success" title="رصيد للمتجر">
                {formatMoney(-v)} رصيد
              </span>
            ) : (
              <span className={cn("num font-semibold", v > 0 ? "text-ink" : "text-ink-3")}>{formatMoney(v)}</span>
            );
          },
        }),
        helper.accessor("totalCommission", {
          header: "إجمالي العمولة",
          cell: (info) => <span className="num text-ink-2">{formatMoney(info.getValue())}</span>,
        }),
        helper.accessor("dueSince", {
          header: "مستحق من",
          cell: (info) =>
            info.getValue() ? (
              <time dateTime={info.getValue()!} title={formatDate(info.getValue())} className="text-ink-2">
                {formatRelative(info.getValue())}
              </time>
            ) : (
              <span className="text-ink-3">—</span>
            ),
        }),
        helper.accessor("blocked", {
          header: "الحالة",
          cell: (info) => <BalanceBadge balance={info.row.original.balance} blocked={info.getValue()} />,
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">إجراءات</span>,
          cell: (info) => (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/commissions/${info.row.original.brandId}`);
                }}
              >
                السجل
              </Button>
            </div>
          ),
        }),
      ]),
    [router],
  );

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <SearchInput value={q} onChange={(v) => url.set({ q: v })} placeholder="ابحث باسم المتجر" label="بحث باسم المتجر" />
      </div>
      <DataTable
        label="جدول عمولات المتاجر"
        columns={columns}
        data={rows}
        getRowId={(b) => b.brandId}
        onRowClick={(b) => router.push(`/commissions/${b.brandId}`)}
        isPending={list.isPending}
        isFetching={list.isFetching}
        error={list.error}
        onRetry={() => list.refetch()}
        empty={
          q
            ? { title: "لا توجد نتائج", description: "جرّب اسمًا آخر أو امسح البحث." }
            : { title: "لسه مفيش عمولات", description: "أول ما متجر يسلّم طلب، العمولة بتتسجل عليه وبيظهر هنا." }
        }
        mobileItem={(b) => (
          <MobileRow
            href={`/commissions/${b.brandId}`}
            title={b.name || "متجر محذوف"}
            trailing={<span className="num">{formatMoney(b.balance)}</span>}
            meta={b.dueSince ? `مستحق من ${formatDate(b.dueSince)}` : `إجمالي العمولة ${formatMoney(b.totalCommission)}`}
            badge={<BalanceBadge balance={b.balance} blocked={b.blocked} />}
          />
        )}
      />
    </>
  );
}

export function CommissionsPage() {
  const url = useUrlState();
  const tab = url.get("tab") === "settlements" ? "settlements" : "brands";
  const trigger =
    "relative h-11 px-1 text-ui text-ink-2 transition-colors hover:text-ink data-[state=active]:font-semibold data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-brand";
  return (
    <PageShell>
      <PageHeader title="العمولات" description="فاترينة بتاخد عمولة على كل طلب بيتسلّم. تابع اللي على كل متجر وراجع إيصالات السداد." />
      <div className="mt-6">
        <SummaryTiles />
        <TermsLine />
      </div>
      <Tabs.Root
        value={tab}
        // Each tab keeps its own filters; switching starts the other one fresh.
        onValueChange={(v) => url.set({ tab: v === "brands" ? null : v, q: null, status: null })}
        dir="rtl"
        className="mt-8"
      >
        <Tabs.List aria-label="العمولات" className="mb-6 flex gap-6 border-b border-line">
          <Tabs.Trigger value="brands" className={trigger}>
            المتاجر
          </Tabs.Trigger>
          <Tabs.Trigger value="settlements" className={trigger}>
            إيصالات السداد
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="brands">
          <BrandsTab />
        </Tabs.Content>
        <Tabs.Content value="settlements">
          <SettlementsTab />
        </Tabs.Content>
      </Tabs.Root>
    </PageShell>
  );
}
