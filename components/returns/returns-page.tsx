"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Check, Eye, PackageCheck, Undo2, Wallet, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { ReturnReason, ReturnRequest, ReturnStatus } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { DetailList, DetailRow } from "@/components/data/detail-list";
import { FilterChips, FilterDialog, type FilterSection } from "@/components/data/filter-dialog";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { PhotoStrip } from "@/components/data/photo-strip";
import { RowMenu, type RowMenuItem } from "@/components/data/row-menu";
import { Badge, RETURN_STATUS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ReasonDialog } from "@/components/ui/reason-dialog";

const PAGE_SIZE = 20;
const helper = createColumnHelper<TableFeatures, ReturnRequest>();
const NO_ROWS: ReturnRequest[] = [];

export const RETURN_REASON: Record<ReturnReason, string> = {
  WRONG_SIZE: "المقاس مش مظبوط",
  DAMAGED: "فيه عيب أو تالف",
  NOT_AS_DESCRIBED: "مختلف عن الوصف",
  WRONG_ITEM: "منتج غلط",
  CHANGED_MIND: "غيرت رأيي",
  OTHER: "أخرى",
};
const ACTOR: Record<string, string> = { CUSTOMER: "العميل", BRAND: "المتجر", ADMIN: "الإدارة" };

const STATUS_OPTIONS = [
  { value: "ALL", label: "الكل" },
  { value: "REQUESTED", label: "مستني رد المتجر", hint: "العميل طلب، والمتجر لسه مردش" },
  { value: "APPROVED", label: "اتوافق عليه", hint: "مستنيين المنتجات توصل للمتجر" },
  { value: "REJECTED", label: "اترفض", hint: "تقدر تلغي رفض المتجر لو العميل معاه حق" },
  { value: "RECEIVED", label: "المتجر استلم", hint: "مستنيين الفلوس ترجع للعميل" },
  { value: "REFUNDED", label: "الفلوس رجعت" },
  { value: "CANCELLED", label: "اتلغى", hint: "العميل سحب الطلب" },
];

type Move = "approved" | "rejected" | "received" | "refunded";

/** The moves an admin may make from each status (the API refuses the rest). */
const MOVES: Partial<Record<ReturnStatus, Move[]>> = {
  REQUESTED: ["approved", "rejected"],
  APPROVED: ["received"],
  RECEIVED: ["refunded"],
  REJECTED: ["approved"],
};

const MOVE: Record<Move, { label: string; title: string; description: string; done: string; icon: RowMenuItem["icon"]; danger?: boolean }> = {
  approved: {
    label: "الموافقة على المرتجع",
    title: "الموافقة على المرتجع",
    description: "العميل هيبعت المنتجات للمتجر، وبيوصله إشعار بالموافقة.",
    done: "تمت الموافقة على المرتجع",
    icon: Check,
  },
  rejected: {
    label: "رفض المرتجع",
    title: "رفض المرتجع",
    description: "السبب بيوصل للعميل.",
    done: "تم رفض المرتجع",
    icon: XCircle,
    danger: true,
  },
  received: {
    label: "تأكيد استلام المتجر",
    title: "المتجر استلم المنتجات",
    description: "الكميات بترجع لمخزون المتجر.",
    done: "تم تسجيل الاستلام",
    icon: PackageCheck,
  },
  refunded: {
    label: "تأكيد رجوع الفلوس",
    title: "الفلوس رجعت للعميل",
    description: "عمولة فاترينة على المنتجات دي بترجع للمتجر في سجل العمولة.",
    done: "تم تسجيل رجوع الفلوس",
    icon: Wallet,
  },
};

/** Admin overturning a store's rejection: buyer protection. */
const moveLabel = (r: ReturnRequest, m: Move) => (m === "approved" && r.status === "REJECTED" ? "إلغاء رفض المتجر والموافقة" : MOVE[m].label);

function useReturnMove(onDone: (saved: ReturnRequest) => void) {
  const [target, setTarget] = useState<{ r: ReturnRequest; move: Move } | null>(null);
  const run = useAction({
    run: ({ id, move, note }: { id: string; move: Move; note?: string }) => api.post<ReturnRequest>(`/admin/returns/${id}/${move}`, note ? { note } : {}),
    success: (v) => ({ title: MOVE[v.move].done }),
    failure: "لم يتم تحديث المرتجع",
    invalidate: [["returns"], ["commissions"]],
    onDone: (saved) => {
      setTarget(null);
      onDone(saved);
    },
  });
  const dialog = target ? (
    <ReasonDialog
      open
      onOpenChange={(o) => !o && setTarget(null)}
      title={`${target.r.status === "REJECTED" ? "إلغاء رفض المتجر" : MOVE[target.move].title} — ${target.r.orderNumber}`}
      description={
        target.r.status === "REJECTED"
          ? "حماية المشتري: المرتجع بيرجع «اتوافق عليه» والعميل يقدر يبعت المنتجات. اكتب ملاحظة للمتجر والعميل لو حابب."
          : MOVE[target.move].description
      }
      confirmLabel={moveLabel(target.r, target.move)}
      tone={MOVE[target.move].danger ? "danger" : "primary"}
      label={target.move === "rejected" ? "سبب الرفض" : "ملاحظة (اختياري)"}
      required={target.move === "rejected"}
      loading={run.isPending}
      onConfirm={(note) => run.mutate({ id: target.r.id, move: target.move, note: note || undefined })}
    />
  ) : null;
  return { ask: (r: ReturnRequest, move: Move) => setTarget({ r, move }), dialog };
}

function ReturnItems({ r }: { r: ReturnRequest }) {
  return (
    <ul className="divide-y divide-line">
      {r.items.map((item) => (
        <li key={item.variantId} className="flex items-center gap-3 py-3">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt="" width={48} height={48} unoptimized className="size-12 shrink-0 rounded-sm border border-line object-cover" />
          ) : (
            <span aria-hidden className="size-12 shrink-0 rounded-sm bg-sunken" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ui font-medium text-ink">{item.title}</span>
            <span className="block text-meta text-ink-3">
              {[item.size && `المقاس ${item.size}`, item.color && `اللون ${item.color}`].filter(Boolean).join("، ") || "—"}
            </span>
          </span>
          <span className="num text-ui text-ink-2">
            {item.quantity} × {formatMoney(item.unitPrice)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function History({ r }: { r: ReturnRequest }) {
  return (
    <ol className="flex flex-col">
      {r.history.map((h, i) => (
        <li key={`${h.status}-${h.at}`} className="relative flex gap-3 pb-4 last:pb-0">
          {i < r.history.length - 1 && <span aria-hidden className="absolute start-[7px] top-4 h-[calc(100%-8px)] w-0.5 bg-line" />}
          <span aria-hidden className={cn("relative z-10 mt-1 size-4 shrink-0 rounded-full border-2", i === r.history.length - 1 ? "border-brand bg-brand" : "border-line-strong bg-surface")} />
          <div className="min-w-0">
            <p className="text-ui font-medium text-ink">{RETURN_STATUS[h.status]?.label ?? h.status}</p>
            <p className="text-meta text-ink-3">
              {formatDateTime(h.at)} — {ACTOR[h.actor] ?? h.actor}
            </p>
            {h.note && <p className="mt-0.5 text-ui text-ink-2">{h.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ReturnDetail({ r, onClose, onMove }: { r: ReturnRequest; onClose: () => void; onMove: (move: Move) => void }) {
  const s = RETURN_STATUS[r.status];
  const moves = MOVES[r.status] ?? [];
  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(o) => !o && onClose()}
      title={`مرتجع من الطلب ${r.orderNumber}`}
      description={`${r.customerName} — طلبه ${formatRelative(r.createdAt)}`}
      footer={
        moves.length ? (
          <>
            {moves.map((m) => (
              <Button key={m} variant={MOVE[m].danger ? "danger" : "primary"} onClick={() => onMove(m)}>
                {moveLabel(r, m)}
              </Button>
            ))}
          </>
        ) : undefined
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-2">
            <Badge tone={s.tone}>{s.label}</Badge>
          </div>
          {r.status === "REJECTED" && (
            <div className="mb-4 rounded-sm border border-warning/30 bg-warning-soft px-4 py-3 text-ui">
              <p className="font-semibold text-warning">المتجر رفض المرتجع</p>
              <p className="mt-1 text-ink">لو العميل معاه حق (حماية المشتري)، تقدر تلغي الرفض وتوافق على المرتجع.</p>
            </div>
          )}
          <DetailList>
            <DetailRow label="السبب">{RETURN_REASON[r.reason] ?? r.reason}</DetailRow>
            {r.note && <DetailRow label="كلام العميل">{r.note}</DetailRow>}
            <DetailRow label="المبلغ المسترد" strong>
              <span className="num">{formatMoney(r.refundAmount)}</span>
            </DetailRow>
            <DetailRow label="الطلب">
              <Link href={`/orders/${r.orderId}`} className="num text-accent underline-offset-4 hover:underline">
                {r.orderNumber}
              </Link>
            </DetailRow>
            <DetailRow label="المتجر">
              <Link href={`/brands/${r.brandId}`} className="text-accent underline-offset-4 hover:underline">
                صفحة المتجر
              </Link>
            </DetailRow>
            {r.commissionReversed > 0 && (
              <DetailRow label="عمولة اترجعت">
                <Link href={`/commissions/${r.brandId}`} className="num text-accent underline-offset-4 hover:underline">
                  {formatMoney(r.commissionReversed)}
                </Link>
              </DetailRow>
            )}
          </DetailList>
          <h3 className="mb-1 mt-5 text-ui font-semibold text-ink">المنتجات</h3>
          <ReturnItems r={r} />
          {r.images.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-ui font-semibold text-ink">صور العميل</h3>
              <PhotoStrip urls={r.images} label="صور المرتجع" />
            </>
          )}
        </div>
        <section aria-label="مسار المرتجع">
          <h3 className="mb-3 text-ui font-semibold text-ink">المسار</h3>
          <History r={r} />
        </section>
      </div>
    </Dialog>
  );
}

export function ReturnsPage() {
  const url = useUrlState();
  const status = STATUS_OPTIONS.some((o) => o.value === url.get("status")) ? url.get("status")! : "ALL";
  const [viewing, setViewing] = useState<ReturnRequest | null>(null);
  // Keep the open detail in sync with what the API returned after a move.
  const move = useReturnMove((saved) => setViewing((v) => (v && v.id === saved.id ? saved : v)));

  const list = useQuery({
    queryKey: qk.returns(status, url.page),
    queryFn: () => api.page<ReturnRequest>("/admin/returns", { status: status === "ALL" ? undefined : status, page: url.page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({
    queryKey: qk.returnCounts,
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          STATUS_OPTIONS.map(async (o) => [
            o.value,
            (await api.page<ReturnRequest>("/admin/returns", { status: o.value === "ALL" ? undefined : o.value, limit: 1 })).meta.total,
          ]),
        ),
      ) as Record<string, number>,
  });

  const menu = (r: ReturnRequest) => (
    <RowMenu
      label={`إجراءات مرتجع ${r.orderNumber}`}
      items={[
        { label: "عرض التفاصيل", icon: Eye, onSelect: () => setViewing(r) },
        ...(MOVES[r.status] ?? []).map((m, i) => ({
          label: moveLabel(r, m),
          icon: r.status === "REJECTED" ? Undo2 : MOVE[m].icon,
          danger: MOVE[m].danger,
          separated: i === 0,
          onSelect: () => move.ask(r, m),
        })),
      ]}
    />
  );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("orderNumber", {
          header: "الطلب",
          cell: (info) => (
            <Link href={`/orders/${info.row.original.orderId}`} onClick={(e) => e.stopPropagation()} className="num font-semibold text-ink underline-offset-4 hover:text-accent hover:underline">
              {info.getValue()}
            </Link>
          ),
        }),
        helper.accessor("customerName", { header: "العميل" }),
        helper.accessor("reason", {
          header: "السبب",
          cell: (info) => (
            <span className="flex flex-col">
              <span>{RETURN_REASON[info.getValue()] ?? info.getValue()}</span>
              <span className="text-meta text-ink-3">
                <span className="num">{info.row.original.items.reduce((n, i) => n + i.quantity, 0)}</span> قطعة
                {info.row.original.images.length ? " — فيه صور" : ""}
              </span>
            </span>
          ),
        }),
        helper.accessor("refundAmount", {
          header: "المبلغ",
          cell: (info) => <span className="num font-semibold">{formatMoney(info.getValue())}</span>,
        }),
        helper.accessor("status", {
          header: "الحالة",
          cell: (info) => <Badge tone={RETURN_STATUS[info.getValue()].tone}>{RETURN_STATUS[info.getValue()].label}</Badge>,
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
          cell: (info) => (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewing(info.row.original);
                }}
              >
                عرض
              </Button>
              {menu(info.row.original)}
            </div>
          ),
        }),
      ]),
    // menu only closes over stable setters and helpers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sections: FilterSection[] = [{ key: "status", label: "الحالة", options: STATUS_OPTIONS, defaultValue: "ALL", counts: counts.data }];
  const values = { status };

  return (
    <PageShell>
      <PageHeader
        title="المرتجعات"
        description="طلبات الإرجاع بين العملاء والمتاجر. المتجر بيرد عليها، والإدارة بتتدخل لو العميل معاه حق أو المرتجع واقف."
        actions={
          <FilterDialog title="تصفية المرتجعات" sections={sections} values={values} onApply={(v) => url.set({ status: v.status === "ALL" ? null : v.status })} />
        }
      />
      <FilterChips sections={sections} values={values} onClear={() => url.set({ status: null })} />
      <div className="mt-4">
        <DataTable
          label="جدول المرتجعات"
          columns={columns}
          data={list.data?.items ?? NO_ROWS}
          getRowId={(r) => r.id}
          onRowClick={setViewing}
          isPending={list.isPending}
          isFetching={list.isFetching && list.isPlaceholderData}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={
            status === "ALL"
              ? { title: "لسه مفيش مرتجعات", description: "لما عميل يطلب يرجّع منتجات من طلب اتسلّم، هيظهر هنا." }
              : { title: "مفيش مرتجعات بالحالة دي", description: "جرّب حالة تانية أو امسح التصفية." }
          }
          paging={{ page: url.page, pageSize: PAGE_SIZE, total: list.data?.meta.total ?? 0, onPage: (p) => url.set({ page: p }, { resetPage: false }) }}
          mobileItem={(r) => (
            <div className="flex items-start">
              <button type="button" onClick={() => setViewing(r)} className="min-w-0 flex-1 text-start">
                <MobileRow
                  title={<span className="num">{r.orderNumber}</span>}
                  trailing={<span className="num">{formatMoney(r.refundAmount)}</span>}
                  meta={`${r.customerName} — ${RETURN_REASON[r.reason] ?? r.reason}`}
                  badge={<Badge tone={RETURN_STATUS[r.status].tone}>{RETURN_STATUS[r.status].label}</Badge>}
                />
              </button>
              <div className="pe-2 pt-3">{menu(r)}</div>
            </div>
          )}
        />
      </div>

      {viewing && <ReturnDetail key={viewing.id} r={viewing} onClose={() => setViewing(null)} onMove={(m) => move.ask(viewing, m)} />}
      {move.dialog}
    </PageShell>
  );
}
