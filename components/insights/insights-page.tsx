"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import type { MissedSearch } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import {
  DataTable,
  MobileRow,
  type TableFeatures,
} from "@/components/data/data-table";
import { PageHeader, PageShell } from "@/components/data/page-header";

type Row = MissedSearch & { rank: number; share: number };

const helper = createColumnHelper<TableFeatures, Row>();
const NO_ROWS: Row[] = [];

const DEFAULT_DAYS = 30;
const PERIODS = [
  { days: 7, label: "آخر ٧ أيام" },
  { days: 30, label: "آخر ٣٠ يوم" },
  { days: 90, label: "آخر ٩٠ يوم" },
];

/** What to do with a term, by how often it was searched compared with the top one. */
function hintFor(row: Row) {
  if (row.share >= 0.5) return "طلب عالي: دوّر على متاجر بتبيعه وضمّها";
  if (row.searches >= 3) return "بلّغ المتاجر اللي في نفس المجال";
  return "طلب قليل لسه، تابعه";
}

/** Searches count with a bar proportional to the most searched term. */
function SearchesBar({ row }: { row: Row }) {
  return (
    <span className="flex items-center gap-2">
      <span className="num w-10 shrink-0 font-semibold text-ink">
        {formatNumber(row.searches)}
      </span>
      <span
        aria-hidden
        className="h-2 w-32 overflow-hidden rounded-full bg-sunken"
      >
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.max(4, row.share * 100)}%` }}
        />
      </span>
    </span>
  );
}

export function InsightsPage() {
  const url = useUrlState();
  const days =
    PERIODS.find((p) => String(p.days) === url.get("days"))?.days ??
    DEFAULT_DAYS;

  const list = useQuery({
    queryKey: qk.missedSearches(days),
    queryFn: () =>
      api.get<MissedSearch[]>("/admin/insights/searches", { days }),
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(() => {
    const items = list.data ?? [];
    const max = Math.max(1, ...items.map((s) => s.searches));
    return items.length
      ? items.map((s, i) => ({ ...s, rank: i + 1, share: s.searches / max }))
      : NO_ROWS;
  }, [list.data]);

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("rank", {
          header: "#",
          cell: (info) => (
            <span className="num text-ink-3">{info.getValue()}</span>
          ),
        }),
        helper.accessor("term", {
          header: "كلمة البحث",
          cell: (info) => (
            <span dir="auto" className="font-medium text-ink">
              {info.getValue()}
            </span>
          ),
        }),
        helper.accessor("searches", {
          header: "عدد مرات البحث",
          cell: (info) => <SearchesBar row={info.row.original} />,
        }),
        helper.display({
          id: "hint",
          header: "تعمل إيه",
          cell: (info) => (
            <span className="text-ink-2">{hintFor(info.row.original)}</span>
          ),
        }),
      ]),
    [],
  );

  return (
    <PageShell>
      <PageHeader
        title="الناس بتدوّر على إيه"
        description="حاجات العملاء دوّروا عليها في فاترينة وملقوش ولا منتج. استخدمها عشان تضم متاجر بتبيعها، أو تبلّغ المتاجر الموجودة. المتاجر كمان بتشوف ده في التطبيق تحت «الناس بتدوّر على إيه»، وبيوصلهم إيميل أسبوعي كل يوم أحد."
      />

      <div className="mt-6 flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="الفترة"
          className="inline-flex rounded-sm border border-line bg-sunken p-1 text-ui"
        >
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              role="tab"
              aria-selected={days === p.days}
              onClick={() =>
                url.set({ days: p.days === DEFAULT_DAYS ? null : p.days })
              }
              className={cn(
                "h-8 rounded-sm px-3",
                days === p.days
                  ? "bg-surface font-semibold text-ink shadow-sm"
                  : "text-ink-3",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="hidden text-meta text-ink-3 sm:block">
          أكتر ٥٠ كلمة، الأكتر بحثًا الأول
        </p>
      </div>

      <div className="mt-4">
        <DataTable
          label="جدول عمليات البحث اللي ملقتش نتايج"
          columns={columns}
          data={rows}
          getRowId={(s) => s.term}
          isPending={list.isPending}
          isFetching={list.isFetching && list.isPlaceholderData}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={{
            title: "لسه مفيش عمليات بحث من غير نتايج في الفترة دي",
            description:
              "لما العملاء يدوّروا على حاجة ومتطلعش ولا منتج، هتظهر هنا.",
          }}
          mobileItem={(s) => (
            <MobileRow
              title={
                <span dir="auto">
                  <span className="num me-2 text-ink-3">{s.rank}</span>
                  {s.term}
                </span>
              }
              trailing={
                <span className="num">{formatNumber(s.searches)} بحث</span>
              }
              meta={hintFor(s)}
            />
          )}
        />
      </div>
    </PageShell>
  );
}
