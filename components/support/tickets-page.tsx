"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import type { Ticket, TicketCounts } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { Badge, TICKET_STATUS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { StoreDeadline } from "./ticket-detail";
import { TICKET_TYPE } from "./ticket-labels";

const PAGE_SIZE = 20;
const helper = createColumnHelper<TableFeatures, Ticket>();
const NO_ROWS: Ticket[] = [];

const DEFAULT_TAB = "ACTIVE";
/** ACTIVE = every ticket still open (escalated ones first); the rest map to one status. */
const TABS = [
  { value: "ACTIVE", label: "كل المفتوحة" },
  { value: "ESCALATED", label: "محتاجة حكم" },
  { value: "WAITING_STORE", label: "مستنية رد المتجر" },
  { value: "OPEN", label: "مفتوحة" },
  { value: "RESOLVED", label: "اتحلت" },
  { value: "CLOSED", label: "مقفولة" },
  { value: "ALL", label: "الكل" },
];

const EMPTY: Record<string, { title: string; description: string }> = {
  ACTIVE: { title: "مفيش تذاكر مفتوحة", description: "أي شكوى أو سؤال من عميل هيظهر هنا." },
  ESCALATED: { title: "مفيش شكاوى محتاجة حكم", description: "الشكوى بتوصل هنا لما المتجر ميردش خلال 48 ساعة." },
  WAITING_STORE: { title: "مفيش شكاوى مستنية المتجر", description: "شكاوى حماية المشتري بتستنى رد المتجر 48 ساعة الأول." },
  OPEN: { title: "مفيش تذاكر مفتوحة", description: "التذاكر العادية والشكاوى اللي المتجر رد عليها بتظهر هنا." },
  RESOLVED: { title: "لسه مفيش تذاكر اتحلت", description: "كل تذكرة تحكم فيها بتظهر هنا مع القرار." },
  CLOSED: { title: "مفيش تذاكر مقفولة", description: "العميل بيقفل التذكرة لما مشكلته تتحل." },
  ALL: { title: "لسه مفيش تذاكر دعم", description: "لما عميل يفتح تذكرة من التطبيق هتظهر هنا." },
};

/** Active tickets by status; escalated ones are the queue that needs an admin. */
function CountTiles({ counts, active, onPick }: { counts?: TicketCounts; active: string; onPick: (status: string) => void }) {
  if (!counts) return <Skeleton className="h-24 w-full" />;
  const tiles = [
    { status: "ESCALATED", label: "محتاجة حكم", note: "المتجر مردش في 48 ساعة", tone: counts.ESCALATED ? "danger" : undefined },
    { status: "WAITING_STORE", label: "مستنية رد المتجر", note: "لسه في مهلة الـ48 ساعة" },
    { status: "OPEN", label: "مفتوحة", note: "مع فريق الدعم" },
  ] as const;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map((t) => {
        const n = counts[t.status];
        const urgent = "tone" in t && t.tone === "danger";
        return (
          <button
            key={t.status}
            type="button"
            onClick={() => onPick(t.status)}
            aria-pressed={active === t.status}
            className={cn(
              "rounded-md border bg-surface px-5 py-4 text-start transition-colors hover:border-line-strong",
              urgent ? "border-danger/40 bg-danger-soft" : "border-line",
              active === t.status && "ring-2 ring-accent/40",
            )}
          >
            <span className={cn("flex items-center gap-1.5 text-meta", urgent ? "font-semibold text-danger" : "text-ink-2")}>
              {urgent && <ShieldAlert aria-hidden className="size-4" />}
              {t.label}
            </span>
            <span className={cn("num mt-1 block text-section font-semibold", urgent ? "text-danger" : "text-ink")}>{formatNumber(n)}</span>
            <span className="mt-0.5 block text-meta text-ink-3">{t.note}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TicketsPage() {
  const router = useRouter();
  const url = useUrlState();
  const tab = TABS.some((t) => t.value === url.get("status")) ? url.get("status")! : DEFAULT_TAB;

  const list = useQuery({
    queryKey: qk.tickets(tab, url.page),
    queryFn: () =>
      api.page<Ticket>("/admin/tickets", {
        status: tab === "ACTIVE" || tab === "ALL" ? undefined : tab,
        active: tab === "ACTIVE" ? true : undefined,
        page: url.page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const counts = useQuery({ queryKey: qk.ticketCounts, queryFn: () => api.get<TicketCounts>("/admin/tickets/counts"), refetchInterval: 60_000 });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("subject", {
          header: "التذكرة",
          cell: (info) => {
            const t = info.row.original;
            return (
              <span className="flex max-w-80 flex-col">
                <Link href={`/support/${t.id}`} onClick={(e) => e.stopPropagation()} className="truncate font-medium text-ink underline-offset-4 hover:text-accent hover:underline">
                  {info.getValue()}
                </Link>
                <span className="num text-meta text-ink-3">{t.number}</span>
              </span>
            );
          },
        }),
        helper.accessor("type", {
          header: "النوع",
          cell: (info) => (
            <span className="flex flex-col items-start gap-1">
              <span className="text-ink-2">{TICKET_TYPE[info.getValue()]}</span>
              {info.row.original.protection && <Badge tone="accent">حماية المشتري</Badge>}
            </span>
          ),
        }),
        helper.accessor("userName", { header: "العميل" }),
        helper.accessor((t) => t.brandName ?? "", {
          id: "order",
          header: "الطلب والمتجر",
          cell: (info) => {
            const t = info.row.original;
            if (!t.orderNumber) return <span className="text-ink-3">—</span>;
            return (
              <span className="flex flex-col">
                <span className="num text-ink">{t.orderNumber}</span>
                <span className="text-meta text-ink-3">{t.brandName}</span>
              </span>
            );
          },
        }),
        helper.accessor("status", {
          header: "الحالة",
          cell: (info) => {
            const t = info.row.original;
            return (
              <span className="flex flex-col items-start gap-1">
                <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
                {t.status === "WAITING_STORE" && t.storeDeadline && <StoreDeadline deadline={t.storeDeadline} compact />}
              </span>
            );
          },
        }),
        helper.accessor("updatedAt", {
          header: "آخر تحديث",
          cell: (info) => (
            <time dateTime={info.getValue()} title={formatDateTime(info.getValue())} className="text-ink-2">
              {formatRelative(info.getValue())}
            </time>
          ),
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">إجراءات</span>,
          cell: (info) => {
            const t = info.row.original;
            return (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant={t.status === "ESCALATED" ? "primary" : "ghost"}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/support/${t.id}`);
                  }}
                >
                  {t.status === "ESCALATED" ? "احكم" : "فتح"}
                </Button>
              </div>
            );
          },
        }),
      ]),
    [router],
  );

  const trigger =
    "relative h-11 shrink-0 px-1 text-ui text-ink-2 transition-colors hover:text-ink data-[state=active]:font-semibold data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-brand";
  const tabCount = (value: string) => (counts.data && value in counts.data ? counts.data[value as keyof TicketCounts] : undefined);

  return (
    <PageShell>
      <PageHeader
        title="الدعم والشكاوى"
        description="تذاكر العملاء وشكاوى حماية المشتري. المتجر عنده 48 ساعة يرد على الشكوى، وبعدها بتوصل لك تحكم فيها."
      />
      <div className="mt-6">
        <CountTiles counts={counts.data} active={tab} onPick={(s) => url.set({ status: s })} />
      </div>
      <Tabs.Root value={tab} onValueChange={(v) => url.set({ status: v === DEFAULT_TAB ? null : v })} dir="rtl" className="mt-8">
        <Tabs.List aria-label="حالة التذاكر" className="mb-6 flex gap-6 overflow-x-auto border-b border-line">
          {TABS.map((t) => {
            const n = tabCount(t.value);
            return (
              <Tabs.Trigger key={t.value} value={t.value} className={cn(trigger, t.value === "ESCALATED" && n ? "text-danger data-[state=active]:text-danger" : undefined)}>
                {t.label}
                {n ? <span className="num ms-1.5 text-meta">({n})</span> : null}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
        <Tabs.Content value={tab}>
          <DataTable
            label="جدول تذاكر الدعم"
            columns={columns}
            data={list.data?.items ?? NO_ROWS}
            getRowId={(t) => t.id}
            onRowClick={(t) => router.push(`/support/${t.id}`)}
            isPending={list.isPending}
            isFetching={list.isFetching && list.isPlaceholderData}
            error={list.error}
            onRetry={() => list.refetch()}
            empty={EMPTY[tab]}
            paging={{ page: url.page, pageSize: PAGE_SIZE, total: list.data?.meta.total ?? 0, onPage: (p) => url.set({ page: p }, { resetPage: false }) }}
            mobileItem={(t) => (
              <MobileRow
                href={`/support/${t.id}`}
                title={t.subject}
                trailing={t.protection ? <Badge tone="accent">حماية</Badge> : undefined}
                meta={`${t.userName} — ${formatRelative(t.updatedAt)}`}
                badge={<Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>}
              />
            )}
          />
        </Tabs.Content>
      </Tabs.Root>
    </PageShell>
  );
}
