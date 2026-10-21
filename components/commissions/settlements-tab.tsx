"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Check, Copy, Eye, FileImage, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { Settlement } from "@/lib/api/types";
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { DetailList, DetailRow, Muted } from "@/components/data/detail-list";
import { FilterChips, FilterDialog, type FilterSection } from "@/components/data/filter-dialog";
import { RowMenu } from "@/components/data/row-menu";
import { ReceiptViewer } from "@/components/payments/receipt-viewer";
import { RejectDialog } from "@/components/payments/reject-dialog";
import { Badge, SETTLEMENT_STATUS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { BalanceBadge, useBrandCommission } from "./commission-status";

const PAGE_SIZE = 20;
const helper = createColumnHelper<TableFeatures, Settlement>();
const NO_ROWS: Settlement[] = [];

const DEFAULT_STATUS = "PENDING_REVIEW";
const STATUS_OPTIONS = [
  { value: "PENDING_REVIEW", label: "قيد المراجعة", hint: "إيصالات تنتظر قرارك" },
  { value: "APPROVED", label: "معتمدة", hint: "اتخصمت من المستحق على المتجر" },
  { value: "REJECTED", label: "مرفوضة", hint: "المتجر يقدر يرفع إيصال جديد" },
  { value: "ALL", label: "الكل", hint: "كل الإيصالات بكل حالاتها" },
];

const EMPTY: Record<string, { title: string; description: string }> = {
  PENDING_REVIEW: { title: "لا توجد إيصالات بانتظارك", description: "أي إيصال سداد يرفعه متجر هيظهر هنا." },
  APPROVED: { title: "لم يُعتمد أي سداد بعد", description: "كل سداد تعتمده بيظهر هنا مع تاريخ الاعتماد." },
  REJECTED: { title: "لا توجد إيصالات مرفوضة", description: "الإيصالات اللي بترفضها بتظهر هنا مع السبب." },
  ALL: { title: "لا توجد إيصالات سداد بعد", description: "لما متجر يسدد اللي عليه بإيصال InstaPay هيظهر هنا." },
};

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`نسخ ${label}`}
      onClick={async () => {
        await navigator.clipboard?.writeText(value).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-sunken hover:text-ink"
    >
      {copied ? <Check aria-hidden className="size-4 text-success" /> : <Copy aria-hidden className="size-4" />}
    </button>
  );
}

/** Refresh balances, lists and the rail counter after a decision. */
function useRefreshCommissions() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["commissions"] });
    queryClient.invalidateQueries({ queryKey: qk.counts });
  };
}

function decisionError(e: unknown) {
  return e instanceof ApiError && e.code === "INVALID_STATE"
    ? { title: "تمت مراجعة هذا الإيصال بالفعل", description: "حدّثنا البيانات لتعرض القرار الحالي." }
    : { title: "لم يتم حفظ القرار", description: e instanceof ApiError ? e.message : "أعد المحاولة بعد قليل." };
}

/** Review one receipt: the facts to match on one side, the receipt beside them (same flow as payments). */
function SettlementReview({ settlement, onClose }: { settlement: Settlement; onClose: () => void }) {
  const toast = useToast();
  const refresh = useRefreshCommissions();
  const [amountChecked, setAmountChecked] = useState(false);
  const [referenceChecked, setReferenceChecked] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [stampAt, setStampAt] = useState<string | null>(null);
  const brand = useBrandCommission(settlement.brandId);

  const pending = settlement.status === "PENDING_REVIEW" && !stampAt;
  const status = SETTLEMENT_STATUS[stampAt ? "APPROVED" : settlement.status];
  const approvedAt = stampAt ?? (settlement.status === "APPROVED" ? settlement.reviewedAt : undefined);
  const owes = brand.data?.balance;

  const decide = async (kind: "approve" | "reject", reason?: string) => {
    setBusy(kind);
    try {
      if (kind === "approve") {
        await api.post(`/admin/settlements/${settlement.id}/approve`);
        setStampAt(new Date().toISOString());
        toast({ tone: "success", title: "تم اعتماد السداد", description: `اتخصم ${formatMoney(settlement.amount)} من المستحق على ${settlement.brandName}.` });
        refresh();
        // Let the stamp land before closing.
        setTimeout(onClose, 1100);
      } else {
        await api.post(`/admin/settlements/${settlement.id}/reject`, { reason });
        setRejecting(false);
        toast({ tone: "success", title: "تم رفض الإيصال", description: "وصل السبب للمتجر." });
        refresh();
        onClose();
      }
    } catch (e) {
      toast({ tone: "error", ...decisionError(e) });
      if (e instanceof ApiError && e.code === "INVALID_STATE") {
        refresh();
        onClose();
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Dialog
        open
        size="lg"
        onOpenChange={(o) => !o && !busy && onClose()}
        title={`إيصال سداد — ${settlement.brandName || "متجر"}`}
        description={
          settlement.reviewedAt && !pending
            ? `${settlement.status === "APPROVED" ? "اعتُمد" : "رُفض"} في ${formatDateTime(settlement.reviewedAt)}`
            : `أُرسل للمراجعة ${formatRelative(settlement.createdAt)}`
        }
        footer={
          pending ? (
            <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <fieldset className="min-w-0">
                <legend className="mb-1 text-meta font-medium text-ink-3">قبل الاعتماد، تأكد بنفسك:</legend>
                <Checkbox checked={amountChecked} onCheckedChange={setAmountChecked}>
                  وصل مبلغ <span className="num font-semibold">{formatMoney(settlement.amount)}</span> فعلًا إلى حساب InstaPay
                </Checkbox>
                <Checkbox checked={referenceChecked} onCheckedChange={setReferenceChecked}>
                  الرقم المرجعي في تطبيق InstaPay مطابق للمكتوب هنا
                </Checkbox>
              </fieldset>
              <div className="flex shrink-0 gap-2">
                <Button variant="danger" onClick={() => setRejecting(true)} disabled={!!busy}>
                  رفض
                </Button>
                <Button
                  variant="primary"
                  onClick={() => decide("approve")}
                  disabled={!amountChecked || !referenceChecked || busy === "reject"}
                  loading={busy === "approve"}
                  className="min-w-40"
                >
                  اعتماد السداد
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <section aria-label="بيانات التحويل المطلوب مطابقتها" className="min-w-0">
            <div className="mb-2">
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <DetailList title="قارن مع الإيصال">
              <DetailRow label="المبلغ" strong>
                <span className="num">{formatMoney(settlement.amount)}</span>
              </DetailRow>
              <DetailRow label="الرقم المرجعي">
                <span className="num truncate rounded-sm bg-sunken px-2 py-0.5 tracking-wider">{settlement.transactionReference}</span>
                <CopyValue value={settlement.transactionReference} label="الرقم المرجعي" />
              </DetailRow>
              <DetailRow label="أُرسل">{formatDateTime(settlement.createdAt)}</DetailRow>
            </DetailList>

            <DetailList title="المتجر" className="mt-6">
              <DetailRow label="الاسم">
                <Link href={`/commissions/${settlement.brandId}`} className="text-accent underline-offset-4 hover:underline">
                  {settlement.brandName || "متجر"}
                </Link>
              </DetailRow>
              <DetailRow label="المستحق عليه الآن">
                {brand.isPending ? (
                  <Skeleton className="h-5 w-24" />
                ) : owes === undefined ? (
                  <Muted>غير متاح</Muted>
                ) : (
                  <>
                    <span className="num font-semibold">{formatMoney(owes)}</span>
                    <BalanceBadge balance={owes} blocked={!!brand.data?.blocked} />
                  </>
                )}
              </DetailRow>
            </DetailList>

            {pending && owes !== undefined && settlement.amount > owes && (
              <div className="mt-6 rounded-sm border border-warning/30 bg-warning-soft px-4 py-3 text-ui">
                <p className="font-semibold text-warning">المبلغ أكبر من المستحق الحالي</p>
                <p className="mt-1 text-ink">لو اعتمدته، الفرق هيتسجل رصيد للمتجر يتخصم من عمولاته الجاية.</p>
              </div>
            )}

            {settlement.status === "REJECTED" && settlement.rejectionReason && (
              <div className="mt-6 rounded-sm border border-danger/30 bg-danger-soft px-4 py-3 text-ui">
                <p className="font-semibold text-danger">سبب الرفض</p>
                <p className="mt-1 text-ink">{settlement.rejectionReason}</p>
              </div>
            )}
          </section>

          <ReceiptViewer kind="settlement" paymentId={settlement.id} hasProof approvedAt={approvedAt ?? undefined} stampAnimating={!!stampAt} />
        </div>
      </Dialog>

      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        onConfirm={(reason) => decide("reject", reason)}
        loading={busy === "reject"}
        brandName={settlement.brandName}
      />
    </>
  );
}

export function SettlementsTab() {
  const url = useUrlState();
  const toast = useToast();
  const status = STATUS_OPTIONS.some((o) => o.value === url.get("status")) ? url.get("status")! : DEFAULT_STATUS;
  const [reviewing, setReviewing] = useState<Settlement | null>(null);
  const [rejecting, setRejecting] = useState<Settlement | null>(null);

  const list = useQuery({
    queryKey: qk.settlements(status, url.page),
    queryFn: () =>
      api.page<Settlement>("/admin/settlements", {
        status: status === "ALL" ? undefined : status,
        page: url.page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: status === "PENDING_REVIEW" ? 30_000 : false,
  });

  const counts = useQuery({
    queryKey: qk.settlementCounts,
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          STATUS_OPTIONS.map(async (o) => [
            o.value,
            (await api.page<Settlement>("/admin/settlements", { status: o.value === "ALL" ? undefined : o.value, limit: 1 })).meta.total,
          ]),
        ),
      ) as Record<string, number>,
    refetchInterval: 60_000,
  });

  const reject = useAction({
    run: ({ id, reason }: { id: string; reason: string }) => api.post(`/admin/settlements/${id}/reject`, { reason }),
    success: "تم رفض الإيصال",
    failure: "لم يتم رفض الإيصال",
    invalidate: [["commissions"]],
    onDone: () => setRejecting(null),
  });

  const openReceipt = async (s: Settlement) => {
    // Open the tab synchronously so the browser doesn't block it, then point it at the signed link.
    const tab = window.open("", "_blank");
    try {
      const { url: signed } = await api.get<{ url: string }>(`/admin/settlements/${s.id}/proof-url`);
      if (tab) tab.location.href = signed;
      else window.location.assign(signed);
    } catch (e) {
      tab?.close();
      toast({ tone: "error", title: "تعذّر فتح الإيصال", description: e instanceof ApiError ? e.message : undefined });
    }
  };

  const copyReference = async (s: Settlement) => {
    await navigator.clipboard?.writeText(s.transactionReference).catch(() => undefined);
    toast({ tone: "success", title: "تم نسخ الرقم المرجعي", description: s.transactionReference });
  };

  const menu = (s: Settlement) => (
    <RowMenu
      label={`إجراءات إيصال ${s.brandName}`}
      items={[
        { label: s.status === "PENDING_REVIEW" ? "مراجعة واعتماد" : "عرض التفاصيل", icon: s.status === "PENDING_REVIEW" ? ShieldCheck : Eye, onSelect: () => setReviewing(s) },
        { label: "فتح الإيصال في نافذة جديدة", icon: FileImage, onSelect: () => openReceipt(s) },
        { label: "نسخ الرقم المرجعي", icon: Copy, onSelect: () => copyReference(s) },
        { label: "رفض الإيصال", icon: XCircle, danger: true, separated: true, hidden: s.status !== "PENDING_REVIEW", onSelect: () => setRejecting(s) },
      ]}
    />
  );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("brandName", {
          header: "المتجر",
          cell: (info) => <span className="font-medium text-ink">{info.getValue() || "متجر محذوف"}</span>,
        }),
        helper.accessor("amount", {
          header: "المبلغ",
          cell: (info) => <span className="num font-semibold">{formatMoney(info.getValue())}</span>,
        }),
        helper.accessor("transactionReference", {
          header: "الرقم المرجعي",
          cell: (info) => <span className="num rounded-sm bg-sunken px-1.5 py-0.5 text-ui tracking-wider">{info.getValue()}</span>,
        }),
        helper.accessor("status", {
          header: "الحالة",
          cell: (info) => <Badge tone={SETTLEMENT_STATUS[info.getValue()].tone}>{SETTLEMENT_STATUS[info.getValue()].label}</Badge>,
        }),
        helper.accessor("createdAt", {
          header: "أُرسل",
          cell: (info) => (
            <time dateTime={info.getValue()} title={formatDateTime(info.getValue())} className="text-ink-2">
              {formatRelative(info.getValue())}
            </time>
          ),
        }),
        helper.accessor("reviewedAt", {
          header: "القرار",
          cell: (info) => <span className="text-ink-2">{info.getValue() ? formatDateTime(info.getValue()) : "—"}</span>,
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">إجراءات</span>,
          cell: (info) => {
            const s = info.row.original;
            const isPending = s.status === "PENDING_REVIEW";
            return (
              <div className="flex items-center justify-end gap-1">
                <Button
                  size="sm"
                  variant={isPending ? "primary" : "ghost"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setReviewing(s);
                  }}
                >
                  {isPending ? "مراجعة" : "عرض"}
                </Button>
                {menu(s)}
              </div>
            );
          },
        }),
      ]),
    // menu only closes over stable setters and helpers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sections: FilterSection[] = [{ key: "status", label: "الحالة", options: STATUS_OPTIONS, defaultValue: DEFAULT_STATUS, counts: counts.data }];
  const values = { status };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-ui text-ink-2">طابق كل إيصال مع حساب InstaPay قبل ما تعتمده؛ الاعتماد بيخصم المبلغ من المستحق على المتجر.</p>
        <FilterDialog
          title="تصفية إيصالات السداد"
          sections={sections}
          values={values}
          onApply={(v) => url.set({ status: v.status === DEFAULT_STATUS ? null : v.status })}
        />
      </div>
      <FilterChips sections={sections} values={values} onClear={() => url.set({ status: null })} />
      <div className="mt-4">
        <DataTable
          label="جدول إيصالات السداد"
          columns={columns}
          data={list.data?.items ?? NO_ROWS}
          getRowId={(s) => s.id}
          onRowClick={setReviewing}
          isPending={list.isPending}
          isFetching={list.isFetching && list.isPlaceholderData}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={EMPTY[status]}
          paging={{ page: url.page, pageSize: PAGE_SIZE, total: list.data?.meta.total ?? 0, onPage: (p) => url.set({ page: p }, { resetPage: false }) }}
          mobileItem={(s) => (
            <div className="flex items-start">
              <button type="button" onClick={() => setReviewing(s)} className="min-w-0 flex-1 text-start">
                <MobileRow
                  title={s.brandName || "متجر محذوف"}
                  trailing={<span className="num">{formatMoney(s.amount)}</span>}
                  meta={formatRelative(s.createdAt)}
                  badge={<Badge tone={SETTLEMENT_STATUS[s.status].tone}>{SETTLEMENT_STATUS[s.status].label}</Badge>}
                />
              </button>
              <div className="pe-2 pt-3">{menu(s)}</div>
            </div>
          )}
        />
      </div>

      {reviewing && <SettlementReview key={reviewing.id} settlement={reviewing} onClose={() => setReviewing(null)} />}

      <RejectDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        onConfirm={(reason) => rejecting && reject.mutate({ id: rejecting.id, reason })}
        loading={reject.isPending}
        brandName={rejecting?.brandName ?? ""}
      />
    </>
  );
}
