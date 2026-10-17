"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { CheckCircle2, EyeOff, Eye, PackageX, Store, XCircle } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/api/use-action";
import type { AdminReport } from "@/lib/api/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { FilterChips, FilterDialog, type FilterSection } from "@/components/data/filter-dialog";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { RowMenu, type RowMenuItem } from "@/components/data/row-menu";
import { Badge, REPORT_STATUS } from "@/components/ui/badge";
import { ReasonDialog } from "@/components/ui/reason-dialog";

const PAGE_SIZE = 20;
const helper = createColumnHelper<TableFeatures, AdminReport>();
const EMPTY: AdminReport[] = [];

export const REPORT_REASON: Record<string, string> = {
  SPAM: "محتوى مزعج",
  OFFENSIVE: "محتوى مسيء",
  FAKE: "تقييم أو منتج مزيف",
  PROHIBITED_PRODUCT: "منتج غير مسموح به",
  FRAUD: "احتيال",
  OTHER: "سبب آخر",
};
const TARGET_LABEL: Record<string, string> = { REVIEW: "تقييم", PRODUCT: "منتج", BRAND: "براند" };

const STATUS_OPTIONS = [
  { value: "OPEN", label: "مفتوحة", hint: "تنتظر قرارك" },
  { value: "RESOLVED", label: "تم الإجراء" },
  { value: "DISMISSED", label: "مرفوضة" },
  { value: "ALL", label: "الكل" },
];
const TYPE_OPTIONS = [
  { value: "ALL", label: "كل الأنواع" },
  { value: "REVIEW", label: "التقييمات" },
  { value: "PRODUCT", label: "المنتجات" },
  { value: "BRAND", label: "المتاجر" },
];

type Ask =
  | { kind: "resolve" | "dismiss"; report: AdminReport }
  | { kind: "takedown"; report: AdminReport };

export function ReportsPage() {
  const router = useRouter();
  const url = useUrlState();
  const status = url.get("status") ?? "OPEN";
  const type = url.get("type") ?? "ALL";
  const [ask, setAsk] = useState<Ask | null>(null);
  const invalidate = [["reports"]];

  const list = useQuery({
    queryKey: ["reports", status, type, url.page],
    queryFn: () =>
      api.page<AdminReport>("/admin/reports", {
        status: status === "ALL" ? undefined : status,
        targetType: type === "ALL" ? undefined : type,
        page: url.page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const decide = useAction({
    run: ({ report, kind, note }: { report: AdminReport; kind: "resolve" | "dismiss"; note: string }) =>
      api.patch(`/admin/reports/${report._id}`, { status: kind === "resolve" ? "RESOLVED" : "DISMISSED", resolutionNote: note }),
    success: ({ kind }) => ({ title: kind === "resolve" ? "تم إغلاق البلاغ بعد اتخاذ إجراء" : "تم رفض البلاغ" }),
    failure: "لم يتم حفظ القرار",
    invalidate,
    onDone: () => setAsk(null),
  });
  const review = useAction({
    run: ({ id, hidden }: { id: string; hidden: boolean }) => api.patch(`/admin/reviews/${id}`, { status: hidden ? "HIDDEN" : "VISIBLE" }),
    success: ({ hidden }) => ({ title: hidden ? "تم إخفاء التقييم" : "تم إظهار التقييم", description: hidden ? "لم يعد ظاهرًا للعملاء وأُعيد حساب التقييم." : undefined }),
    failure: "لم يتم تحديث التقييم",
    invalidate,
  });
  const takedown = useAction({
    run: ({ id, reason }: { id: string; reason: string }) => api.post(`/admin/products/${id}/archive`, { reason }),
    success: () => ({ title: "تمت إزالة المنتج", description: "لم يعد ظاهرًا للعملاء." }),
    failure: "لم تتم إزالة المنتج",
    invalidate,
    onDone: () => setAsk(null),
  });

  const sections: FilterSection[] = [
    { key: "status", label: "حالة البلاغ", options: STATUS_OPTIONS, defaultValue: "OPEN" },
    { key: "type", label: "نوع المحتوى", options: TYPE_OPTIONS, defaultValue: "ALL" },
  ];
  const values = { status, type };

  const itemsFor = (r: AdminReport): RowMenuItem[] => {
    const open = r.status === "OPEN";
    const t = r.target;
    return [
      { label: "إغلاق البلاغ بعد اتخاذ إجراء", icon: CheckCircle2, hidden: !open, onSelect: () => setAsk({ kind: "resolve", report: r }) },
      { label: "إخفاء التقييم", icon: EyeOff, separated: true, hidden: r.targetType !== "REVIEW" || !t || t.status !== "VISIBLE", onSelect: () => review.mutate({ id: r.targetId, hidden: true }) },
      { label: "إظهار التقييم", icon: Eye, separated: true, hidden: r.targetType !== "REVIEW" || !t || t.status !== "HIDDEN", onSelect: () => review.mutate({ id: r.targetId, hidden: false }) },
      { label: "إزالة المنتج", icon: PackageX, separated: true, danger: true, hidden: r.targetType !== "PRODUCT" || !t || t.status === "ARCHIVED", onSelect: () => setAsk({ kind: "takedown", report: r }) },
      { label: "فتح صفحة البراند", icon: Store, hidden: !(r.targetType === "BRAND" || t?.brandId), onSelect: () => router.push(`/brands/${r.targetType === "BRAND" ? r.targetId : t!.brandId}`) },
      { label: "رفض البلاغ", icon: XCircle, separated: true, danger: true, hidden: !open, onSelect: () => setAsk({ kind: "dismiss", report: r }) },
    ];
  };

  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: "target",
          header: "المحتوى المُبلَّغ عنه",
          cell: (info) => {
            const r = info.row.original;
            return (
              <span className="flex max-w-[22rem] items-center gap-3">
                {r.target?.imageUrl && <Image src={r.target.imageUrl} alt="" width={36} height={36} unoptimized className="size-9 shrink-0 rounded-sm border border-line object-cover" />}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-ink">{r.target?.title ?? <span className="text-ink-3">محتوى محذوف</span>}</span>
                  <span className="text-meta text-ink-3">
                    {TARGET_LABEL[r.targetType]}
                    {r.target?.subtitle && ` — ${r.target.subtitle}`}
                    {r.target?.status === "HIDDEN" && " — مخفي"}
                    {r.target?.status === "ARCHIVED" && " — أُزيل"}
                  </span>
                </span>
              </span>
            );
          },
        }),
        helper.accessor("reason", {
          header: "السبب",
          cell: (info) => (
            <span className="flex max-w-[16rem] flex-col whitespace-normal">
              <span>{REPORT_REASON[info.getValue()] ?? info.getValue()}</span>
              {info.row.original.details && <span className="line-clamp-1 text-meta text-ink-3">{info.row.original.details}</span>}
            </span>
          ),
        }),
        helper.accessor((r) => r.reporter?.name ?? "—", { id: "reporter", header: "المُبلِّغ" }),
        helper.accessor("status", {
          header: "الحالة",
          cell: (info) => (
            <span className="flex flex-col items-start gap-1">
              <Badge tone={REPORT_STATUS[info.getValue()].tone}>{REPORT_STATUS[info.getValue()].label}</Badge>
              {info.row.original.resolutionNote && <span className="line-clamp-1 max-w-[12rem] text-meta text-ink-3">{info.row.original.resolutionNote}</span>}
            </span>
          ),
        }),
        helper.accessor("createdAt", {
          header: "التاريخ",
          cell: (info) => <time title={formatDateTime(info.getValue())} className="text-ink-2">{formatRelative(info.getValue())}</time>,
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">إجراءات</span>,
          cell: (info) => (
            <div className="flex justify-end">
              <RowMenu label="إجراءات البلاغ" items={itemsFor(info.row.original)} />
            </div>
          ),
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <PageShell>
      <PageHeader title="البلاغات" description="بلاغات العملاء عن التقييمات والمنتجات والبراندات. كل قرار يُسجَّل في سجل العمليات." />
      <div className="mt-6 flex items-center gap-2">
        <FilterDialog
          title="تصفية البلاغات"
          sections={sections}
          values={values}
          onApply={(v) => url.set({ status: v.status === "OPEN" ? null : v.status, type: v.type === "ALL" ? null : v.type })}
        />
      </div>
      <FilterChips sections={sections} values={values} onClear={(key) => url.set(key === "all" ? { status: null, type: null } : { [key]: null })} />
      <div className="mt-4">
        <DataTable
          label="جدول البلاغات"
          columns={columns}
          data={list.data?.items ?? EMPTY}
          getRowId={(r) => r._id}
          isPending={list.isPending}
          isFetching={list.isFetching && list.isPlaceholderData}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={
            status === "OPEN"
              ? { title: "لا توجد بلاغات مفتوحة", description: "عندما يبلّغ عميل عن محتوى سيظهر هنا." }
              : { title: "لا توجد بلاغات هنا" }
          }
          paging={{ page: url.page, pageSize: PAGE_SIZE, total: list.data?.meta.total ?? 0, onPage: (p) => url.set({ page: p }, { resetPage: false }) }}
          mobileItem={(r) => (
            <MobileRow
              title={r.target?.title ?? "محتوى محذوف"}
              meta={`${TARGET_LABEL[r.targetType]} — ${REPORT_REASON[r.reason] ?? r.reason}`}
              badge={<Badge tone={REPORT_STATUS[r.status].tone}>{REPORT_STATUS[r.status].label}</Badge>}
              actions={<RowMenu label="إجراءات البلاغ" items={itemsFor(r)} />}
            />
          )}
        />
      </div>

      {ask && (ask.kind === "resolve" || ask.kind === "dismiss") && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setAsk(null)}
          title={ask.kind === "resolve" ? "إغلاق البلاغ بعد اتخاذ إجراء" : "رفض البلاغ"}
          description={ask.kind === "resolve" ? "اكتب الإجراء الذي اتخذته، مثل إخفاء التقييم أو إزالة المنتج." : "اكتب سبب رفض البلاغ لمراجعته لاحقًا."}
          confirmLabel={ask.kind === "resolve" ? "إغلاق البلاغ" : "رفض البلاغ"}
          tone={ask.kind === "resolve" ? "primary" : "danger"}
          label="ملاحظة القرار"
          quickReasons={ask.kind === "resolve" ? ["تم إخفاء التقييم", "تمت إزالة المنتج", "تم التواصل مع البراند"] : ["المحتوى لا يخالف السياسات", "بلاغ مكرر"]}
          loading={decide.isPending}
          onConfirm={(note) => decide.mutate({ report: ask.report, kind: ask.kind as "resolve" | "dismiss", note })}
        />
      )}
      {ask?.kind === "takedown" && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setAsk(null)}
          title={`إزالة المنتج: ${ask.report.target?.title ?? ""}`}
          description="سيختفي المنتج من المتجر فورًا. الطلبات السابقة لا تتأثر."
          confirmLabel="إزالة المنتج"
          quickReasons={["منتج غير مسموح به", "صور أو وصف مضلل", "انتهاك حقوق ملكية"]}
          loading={takedown.isPending}
          onConfirm={(reason) => takedown.mutate({ id: ask.report.targetId, reason })}
        />
      )}
    </PageShell>
  );
}
