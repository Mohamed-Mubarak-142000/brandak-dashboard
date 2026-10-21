"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { AdminQuestion } from "@/lib/api/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { FilterChips, FilterDialog, type FilterSection } from "@/components/data/filter-dialog";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { SearchInput } from "@/components/data/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;
const helper = createColumnHelper<TableFeatures, AdminQuestion>();
const NO_ROWS: AdminQuestion[] = [];

const VISIBILITY = [
  { value: "ALL", label: "الكل" },
  { value: "VISIBLE", label: "ظاهرة", hint: "بتظهر في صفحة المنتج لما المتجر يرد" },
  { value: "HIDDEN", label: "مخفية", hint: "الإدارة أخفتها (سبام أو إساءة)" },
];
const ANSWER = [
  { value: "ALL", label: "الكل" },
  { value: "ANSWERED", label: "اترد عليها" },
  { value: "WAITING", label: "مستنية رد المتجر" },
];

/** Product questions across all stores: search them and hide spam or abuse. */
export function QuestionsPage() {
  const url = useUrlState();
  const visibility = VISIBILITY.some((o) => o.value === url.get("visibility")) ? url.get("visibility")! : "ALL";
  const answer = ANSWER.some((o) => o.value === url.get("answer")) ? url.get("answer")! : "ALL";
  const q = url.get("q") ?? "";

  const query = {
    hidden: visibility === "ALL" ? undefined : visibility === "HIDDEN",
    answered: answer === "ALL" ? undefined : answer === "ANSWERED",
    q: q || undefined,
    page: url.page,
    limit: PAGE_SIZE,
  };
  const list = useQuery({
    queryKey: qk.questions(visibility, answer, q, url.page),
    queryFn: () => api.page<AdminQuestion>("/admin/questions", query),
    placeholderData: keepPreviousData,
  });

  const toggle = useAction({
    run: (v: { id: string; hidden: boolean }) => api.post<AdminQuestion>(`/admin/questions/${v.id}/hidden`, { hidden: v.hidden }),
    success: (v) => ({ title: v.hidden ? "اتخفى السؤال" : "السؤال رجع يظهر" }),
    failure: "لم يتم تحديث السؤال",
    invalidate: [["questions"]],
  });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("text", {
          header: "السؤال",
          cell: (info) => (
            <span className="flex max-w-md flex-col gap-1">
              <span className="font-medium text-ink">{info.getValue()}</span>
              {info.row.original.answer ? (
                <span className="text-meta text-ink-2">
                  <span className="font-semibold text-accent">رد المتجر: </span>
                  {info.row.original.answer}
                </span>
              ) : (
                <span className="text-meta text-ink-3">لسه مفيش رد</span>
              )}
            </span>
          ),
        }),
        helper.accessor("productTitle", {
          header: "المنتج والمتجر",
          cell: (info) => (
            <span className="flex flex-col">
              <span className="truncate">{info.getValue()}</span>
              <Link href={`/brands/${info.row.original.brandId}`} onClick={(e) => e.stopPropagation()} className="text-meta text-accent underline-offset-4 hover:underline">
                {info.row.original.brandName}
              </Link>
            </span>
          ),
        }),
        helper.accessor("userName", { header: "السائل" }),
        helper.accessor("hidden", {
          header: "الحالة",
          cell: (info) => (info.getValue() ? <Badge tone="danger">مخفي</Badge> : info.row.original.answer ? <Badge tone="success">ظاهر</Badge> : <Badge tone="warning">مستني رد</Badge>),
        }),
        helper.accessor("createdAt", {
          header: "التاريخ",
          cell: (info) => (
            <time dateTime={info.getValue()} title={formatDateTime(info.getValue())} className="text-ink-2">
              {formatRelative(info.getValue())}
            </time>
          ),
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">إجراءات</span>,
          cell: (info) => <HideButton q={info.row.original} onToggle={(hidden) => toggle.mutate({ id: info.row.original.id, hidden })} />,
        }),
      ]),
    // toggle.mutate is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sections: FilterSection[] = [
    { key: "visibility", label: "الظهور", options: VISIBILITY, defaultValue: "ALL" },
    { key: "answer", label: "الرد", options: ANSWER, defaultValue: "ALL" },
  ];
  const values = { visibility, answer };

  return (
    <PageShell>
      <PageHeader
        title="أسئلة المنتجات"
        description="الأسئلة اللي العملاء بيسألوها للمتاجر قبل الشراء. الإجابة بتظهر للكل في صفحة المنتج، فاخفي أي سؤال فيه سبام أو إساءة أو أرقام تليفونات."
        actions={
          <FilterDialog
            title="تصفية الأسئلة"
            sections={sections}
            values={values}
            onApply={(v) => url.set({ visibility: v.visibility === "ALL" ? null : v.visibility, answer: v.answer === "ALL" ? null : v.answer })}
          />
        }
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={(v) => url.set({ q: v })} placeholder="ابحث في السؤال أو الرد أو اسم السائل" label="بحث في الأسئلة" />
      </div>
      <FilterChips sections={sections} values={values} onClear={() => url.set({ visibility: null, answer: null })} />
      <div className="mt-4">
        <DataTable
          label="جدول الأسئلة"
          columns={columns}
          data={list.data?.items ?? NO_ROWS}
          getRowId={(r) => r.id}
          isPending={list.isPending}
          isFetching={list.isFetching && list.isPlaceholderData}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={
            visibility === "ALL" && answer === "ALL" && !q
              ? { title: "لسه مفيش أسئلة", description: "لما عميل يسأل متجر عن منتج، السؤال هيظهر هنا." }
              : { title: "مفيش أسئلة مطابقة", description: "جرّب تصفية تانية أو امسح البحث." }
          }
          paging={{ page: url.page, pageSize: PAGE_SIZE, total: list.data?.meta.total ?? 0, onPage: (p) => url.set({ page: p }, { resetPage: false }) }}
          mobileItem={(item) => (
            <div className="flex items-start">
              <div className="min-w-0 flex-1">
                <MobileRow
                  title={item.text}
                  meta={`${item.productTitle} — ${item.brandName}${item.answer ? ` — رد: ${item.answer}` : ""}`}
                  badge={item.hidden ? <Badge tone="danger">مخفي</Badge> : undefined}
                />
              </div>
              <div className="pe-2 pt-3">
                <HideButton q={item} onToggle={(hidden) => toggle.mutate({ id: item.id, hidden })} />
              </div>
            </div>
          )}
        />
      </div>
    </PageShell>
  );
}

function HideButton({ q, onToggle }: { q: AdminQuestion; onToggle: (hidden: boolean) => void }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!q.hidden);
      }}
      aria-label={q.hidden ? `إظهار السؤال: ${q.text}` : `إخفاء السؤال: ${q.text}`}
    >
      {q.hidden ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
      {q.hidden ? "إظهار" : "إخفاء"}
    </Button>
  );
}
