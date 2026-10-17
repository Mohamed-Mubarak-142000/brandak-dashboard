"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Copy, Eye, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/api/use-action";
import type { OrderSummary } from "@/lib/api/types";
import { formatDateTime, formatMoney, formatPhone, formatRelative } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { FilterChips, FilterDialog, type FilterSection } from "@/components/data/filter-dialog";
import { DELETED_FILTER, useSoftDelete } from "@/components/data/use-soft-delete";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { RowMenu } from "@/components/data/row-menu";
import { SearchInput } from "@/components/data/search-input";
import { Badge, ORDER_STATUS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { useToast } from "@/components/ui/toast";

const PAGE_SIZE = 20;
const helper = createColumnHelper<TableFeatures, OrderSummary>();
const EMPTY: OrderSummary[] = [];

const STATUS_OPTIONS = [
  { value: "ALL", label: "الكل" },
  { value: "PENDING", label: "قيد المراجعة", hint: "لم يؤكدها البراند بعد" },
  { value: "CONFIRMED", label: "تم التأكيد" },
  { value: "PROCESSING", label: "قيد التجهيز" },
  { value: "SHIPPED", label: "تم الشحن" },
  { value: "DELIVERED", label: "تم التسليم" },
  { value: "CANCELLED", label: "ملغاة" },
];
const RANGE_OPTIONS = [
  { value: "ALL", label: "كل الأوقات" },
  { value: "1", label: "آخر 24 ساعة" },
  { value: "7", label: "آخر 7 أيام" },
  { value: "30", label: "آخر 30 يومًا" },
];

/** Admins may only cancel open orders (after a complaint); fulfilment belongs to the brand. */
export const adminCanCancel = (status: string) => ["PENDING", "CONFIRMED", "PROCESSING"].includes(status);

export const CANCEL_REASONS = ["شكوى من العميل", "البراند لا يرد", "طلب مكرر أو وهمي", "منتج مخالف"];

export function useCancelOrder(onDone?: () => void) {
  const [target, setTarget] = useState<{ id: string; orderNumber: string } | null>(null);
  const cancel = useAction({
    run: ({ id, reason }: { id: string; reason: string }) => api.post(`/admin/orders/${id}/cancel`, { reason }),
    success: "تم إلغاء الطلب",
    failure: "لم يتم إلغاء الطلب",
    invalidate: [["orders"], ["order"]],
    onDone: () => {
      setTarget(null);
      onDone?.();
    },
  });
  const dialog = target ? (
    <ReasonDialog
      open
      onOpenChange={(o) => !o && setTarget(null)}
      title={`إلغاء الطلب ${target.orderNumber}`}
      description="سيصل الإشعار للعميل وللبراند، وتعود الكميات للمخزون."
      confirmLabel="إلغاء الطلب"
      quickReasons={CANCEL_REASONS}
      loading={cancel.isPending}
      onConfirm={(reason) => cancel.mutate({ id: target.id, reason })}
    />
  ) : null;
  return { ask: setTarget, dialog };
}

export function OrdersPage() {
  const router = useRouter();
  const url = useUrlState();
  const toast = useToast();
  const status = url.get("status") ?? "ALL";
  const range = url.get("range") ?? "ALL";
  const deleted = url.get("deleted") ?? "no";
  const showingDeleted = deleted === "yes";
  const q = url.get("q") ?? "";
  const cancel = useCancelOrder();

  // A day boundary is enough precision for "last N days"; keeps the query key stable while browsing.
  const from = useMemo(() => {
    if (range === "ALL") return undefined;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - Number(range) + 1);
    return d.toISOString();
  }, [range]);

  const list = useQuery({
    queryKey: ["orders", status, range, deleted, q, url.page],
    queryFn: () =>
      api.page<OrderSummary>("/admin/orders", {
        status: status === "ALL" ? undefined : status,
        deleted: showingDeleted ? true : undefined,
        from,
        q,
        page: url.page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const sections: FilterSection[] = [
    { key: "status", label: "الحالة", options: STATUS_OPTIONS, defaultValue: "ALL" },
    { key: "range", label: "الفترة", options: RANGE_OPTIONS, defaultValue: "ALL" },
    DELETED_FILTER,
  ];
  const values = { status, range, deleted };
  const del = useSoftDelete({
    base: "/admin/orders",
    noun: "الطلب",
    invalidate: [["orders"], ["order"]],
    warning: "هيختفي من طلبات العميل ولوحة المتجر والإحصائيات.",
  });

  const copy = async (o: OrderSummary) => {
    await navigator.clipboard?.writeText(o.orderNumber).catch(() => undefined);
    toast({ tone: "success", title: "تم نسخ رقم الطلب", description: o.orderNumber });
  };

  const menu = (o: OrderSummary) => (
    <RowMenu
      label={`إجراءات الطلب ${o.orderNumber}`}
      items={[
        { label: "عرض التفاصيل", icon: Eye, onSelect: () => router.push(`/orders/${o.id}`) },
        { label: "نسخ رقم الطلب", icon: Copy, onSelect: () => copy(o) },
        { label: "إلغاء الطلب", icon: XCircle, danger: true, separated: true, hidden: showingDeleted || !adminCanCancel(o.status), onSelect: () => cancel.ask(o) },
        // Only finished orders can be deleted (the API refuses the rest).
        ...(showingDeleted || o.status === "DELIVERED" || o.status === "CANCELLED" ? del.menuItems({ id: o.id, name: o.orderNumber }, showingDeleted) : []),
      ]}
    />
  );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("orderNumber", {
          header: "رقم الطلب",
          cell: (info) => (
            <Link href={`/orders/${info.row.original.id}`} onClick={(e) => e.stopPropagation()} className="num font-semibold text-ink hover:text-accent hover:underline underline-offset-4">
              {info.getValue()}
            </Link>
          ),
        }),
        helper.accessor((o) => o.brand.name, { id: "brand", header: "المتجر" }),
        helper.accessor((o) => o.customer?.name ?? "—", {
          id: "customer",
          header: "العميل",
          cell: (info) => (
            <span className="flex flex-col">
              <span>{info.getValue()}</span>
              <span className="num text-meta text-ink-3">{formatPhone(info.row.original.customer?.phone)}</span>
            </span>
          ),
        }),
        helper.accessor("grandTotal", {
          header: "الإجمالي",
          cell: (info) => (
            <span className="flex flex-col">
              <span className="num font-semibold">{formatMoney(info.getValue())}</span>
              <span className="text-meta text-ink-3">{info.row.original.paymentStatus === "PAID" ? "تم التحصيل" : "دفع عند الاستلام"}</span>
            </span>
          ),
        }),
        helper.accessor("status", {
          header: "الحالة",
          cell: (info) => <Badge tone={ORDER_STATUS[info.getValue()].tone}>{ORDER_STATUS[info.getValue()].label}</Badge>,
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
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); router.push(`/orders/${info.row.original.id}`); }}>
                عرض
              </Button>
              {menu(info.row.original)}
            </div>
          ),
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, showingDeleted],
  );

  return (
    <PageShell>
      <PageHeader title="الطلبات" description="كل الطلبات بين العملاء والمتاجر. التنفيذ مسؤولية المتجر، والإدارة بتتدخل عند الشكاوى." />
      <div className="mt-6 flex items-center gap-2">
        <SearchInput value={q} onChange={(v) => url.set({ q: v })} placeholder="رقم الطلب أو هاتف العميل" label="بحث برقم الطلب أو هاتف العميل" />
        <FilterDialog
          title="تصفية الطلبات"
          sections={sections}
          values={values}
          onApply={(v) => url.set({ status: v.status === "ALL" ? null : v.status, range: v.range === "ALL" ? null : v.range, deleted: v.deleted === "yes" ? "yes" : null })}
        />
      </div>
      <FilterChips sections={sections} values={values} onClear={(key) => url.set(key === "all" ? { status: null, range: null, deleted: null } : { [key]: null })} />
      <div className="mt-4">
        <DataTable
          label="جدول الطلبات"
          columns={columns}
          data={list.data?.items ?? EMPTY}
          getRowId={(o) => o.id}
          onRowClick={(o) => router.push(`/orders/${o.id}`)}
          isPending={list.isPending}
          isFetching={list.isFetching && list.isPlaceholderData}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={
            q
              ? { title: "لا توجد نتائج", description: "تأكد من رقم الطلب (مثل BR-000123) أو رقم الهاتف." }
              : { title: "لا توجد طلبات هنا", description: "الطلبات الجديدة تظهر هنا فور تأكيد العميل لها." }
          }
          paging={{ page: url.page, pageSize: PAGE_SIZE, total: list.data?.meta.total ?? 0, onPage: (p) => url.set({ page: p }, { resetPage: false }) }}
          mobileItem={(o) => (
            <MobileRow
              href={`/orders/${o.id}`}
              title={<span className="num">{o.orderNumber}</span>}
              trailing={<span className="num">{formatMoney(o.grandTotal)}</span>}
              meta={`${o.brand.name} — ${formatRelative(o.createdAt)}`}
              badge={<Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>}
              actions={menu(o)}
            />
          )}
        />
      </div>
      {cancel.dialog}
      {del.dialog}
    </PageShell>
  );
}
