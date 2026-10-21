"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { AdminBrand, BrandCommissionStatus, LedgerEntry } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney } from "@/lib/format";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { DetailList, DetailRow, Panel } from "@/components/data/detail-list";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { CommissionFacts, formatRate, LEDGER_TYPE, SignedMoney, useBrandCommission } from "./commission-status";

const PAGE_SIZE = 20;
const helper = createColumnHelper<TableFeatures, LedgerEntry>();
const NO_ROWS: LedgerEntry[] = [];

/** What the line is about: the order (with rate × base), or the note. */
function EntryDetails({ e }: { e: LedgerEntry }) {
  return (
    <span className="flex flex-col">
      {e.orderNumber && (
        <span>
          طلب{" "}
          {e.orderId ? (
            <Link href={`/orders/${e.orderId}`} onClick={(ev) => ev.stopPropagation()} className="num font-medium text-accent underline-offset-4 hover:underline">
              {e.orderNumber}
            </Link>
          ) : (
            <span className="num font-medium">{e.orderNumber}</span>
          )}
        </span>
      )}
      {e.rate != null && e.base != null && (
        <span className="text-meta text-ink-3">
          <span className="num">{formatRate(e.rate)}</span> من <span className="num">{formatMoney(e.base)}</span>
        </span>
      )}
      {e.note && <span className={cn("whitespace-normal", e.orderNumber ? "text-meta text-ink-3" : "text-ink-2")}>{e.note}</span>}
      {!e.orderNumber && !e.note && <span className="text-ink-3">—</span>}
    </span>
  );
}

function Ledger({ brandId }: { brandId: string }) {
  const [page, setPage] = useState(1);
  const ledger = useQuery({
    queryKey: qk.commissionLedger(brandId, page),
    queryFn: () => api.page<LedgerEntry>(`/admin/commissions/brands/${brandId}/ledger`, { page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("createdAt", {
          header: "التاريخ",
          cell: (info) => <span className="text-ink-2">{formatDateTime(info.getValue())}</span>,
        }),
        helper.accessor("type", {
          header: "النوع",
          cell: (info) => <Badge tone={LEDGER_TYPE[info.getValue()]?.tone ?? "neutral"}>{LEDGER_TYPE[info.getValue()]?.label ?? info.getValue()}</Badge>,
        }),
        helper.display({ id: "details", header: "التفاصيل", cell: (info) => <EntryDetails e={info.row.original} /> }),
        helper.accessor("amount", {
          header: "المبلغ",
          cell: (info) => <SignedMoney amount={info.getValue()} />,
        }),
      ]),
    [],
  );

  return (
    <section aria-labelledby="ledger-title">
      <h2 id="ledger-title" className="text-ui font-semibold text-ink">
        سجل العمولة
      </h2>
      <p className="mb-3 mt-0.5 text-meta text-ink-3">الموجب بيزوّد المستحق على المتجر، والسالب سداد أو خصم لصالحه.</p>
      <DataTable
        label="سجل العمولة"
        columns={columns}
        data={ledger.data?.items ?? NO_ROWS}
        getRowId={(e) => e._id}
        isPending={ledger.isPending}
        isFetching={ledger.isFetching && ledger.isPlaceholderData}
        error={ledger.error}
        onRetry={() => ledger.refetch()}
        empty={{ title: "السجل فاضي", description: "العمولات والسداد والتسويات بتظهر هنا أول بأول." }}
        paging={{ page, pageSize: PAGE_SIZE, total: ledger.data?.meta.total ?? 0, onPage: setPage }}
        mobileItem={(e) => (
          <MobileRow
            title={LEDGER_TYPE[e.type]?.label ?? e.type}
            trailing={<SignedMoney amount={e.amount} />}
            meta={[e.orderNumber, e.note, formatDateTime(e.createdAt)].filter(Boolean).join(" · ")}
          />
        )}
      />
    </section>
  );
}

type Direction = "charge" | "credit";

/** Manual correction: adds to what the store owes, or credits it. Recorded in the ledger and the audit log. */
function AdjustForm({ brandId, brandName }: { brandId: string; brandName: string }) {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<Direction>("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const value = Number(amount);
  const amountError =
    !amount.trim() || !Number.isFinite(value) || value <= 0
      ? "اكتب مبلغ أكبر من صفر"
      : value > 1_000_000
        ? "أقصى مبلغ 1,000,000 ج.م"
        : Math.round(value * 100) !== value * 100
          ? "مسموح برقمين عشريين بس"
          : undefined;
  const noteError = note.trim().length < 3 ? "اكتب سبب التسوية (3 أحرف على الأقل)" : undefined;
  const signed = direction === "charge" ? value : -value;

  const adjust = useAction({
    run: () => api.post<BrandCommissionStatus>(`/admin/commissions/brands/${brandId}/adjust`, { amount: signed, note: note.trim() }),
    success: () => ({ title: "تم تسجيل التسوية", description: `${direction === "charge" ? "اتضاف" : "اتخصم"} ${formatMoney(value)} ${direction === "charge" ? "على" : "من مستحقات"} ${brandName}.` }),
    failure: "لم يتم تسجيل التسوية",
    invalidate: [["commissions"]],
    onDone: (status) => {
      queryClient.setQueryData(qk.commissionBrand(brandId), status);
      setConfirming(false);
      setAmount("");
      setNote("");
      setTouched(false);
    },
  });

  const option = (v: Direction, label: string, hint: string) => (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer flex-col justify-center rounded-sm border px-3 py-2 transition-colors",
        direction === v ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong hover:bg-sunken",
      )}
    >
      <input type="radio" name="adjust-direction" checked={direction === v} onChange={() => setDirection(v)} className="sr-only" />
      <span className={cn("text-ui text-ink", direction === v && "font-semibold")}>{label}</span>
      <span className="text-meta text-ink-3">{hint}</span>
    </label>
  );

  return (
    <Panel>
      <h2 className="text-ui font-semibold text-ink">تسوية يدوية</h2>
      <p className="mb-4 mt-0.5 text-meta text-ink-3">لتصحيح خطأ أو خصم متفق عليه. بتتسجل في سجل العمولة وسجل العمليات باسمك.</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!amountError && !noteError) setConfirming(true);
        }}
        className="flex flex-col gap-4"
      >
        <fieldset>
          <legend className="mb-2 text-ui font-medium text-ink">نوع التسوية</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {option("credit", "خصم لصالح المتجر", "يقلّل المستحق عليه")}
            {option("charge", "إضافة على المتجر", "يزوّد المستحق عليه")}
          </div>
        </fieldset>
        <Field label="المبلغ (ج.م)" error={touched ? amountError : undefined}>
          {(a11y) => (
            <Input {...a11y} type="number" inputMode="decimal" min={0} step="0.01" dir="ltr" className="num text-end" value={amount} onChange={(e) => setAmount(e.target.value)} />
          )}
        </Field>
        <Field label="السبب" hint="بيظهر في سجل العمولة." error={touched ? noteError : undefined}>
          {(a11y) => (
            <Textarea {...a11y} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: طلب BR-000123 اترجع بعد التسليم" className="min-h-20" />
          )}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="primary">
            تسجيل التسوية
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="تأكيد التسوية"
        description={`${direction === "charge" ? "إضافة" : "خصم"} ${formatMoney(Number.isFinite(value) ? value : 0)} ${direction === "charge" ? "على" : "لصالح"} ${brandName}. السبب: ${note.trim()}`}
        confirmLabel="تسجيل التسوية"
        loading={adjust.isPending}
        onConfirm={() => adjust.mutate(undefined)}
      />
    </Panel>
  );
}

export function BrandCommissionDetail() {
  const { brandId } = useParams<{ brandId: string }>();
  const brand = useQuery({ queryKey: ["brand", brandId], queryFn: () => api.get<AdminBrand>(`/admin/brands/${brandId}`) });
  const status = useBrandCommission(brandId);
  const name = brand.data?.name ?? "";

  return (
    <PageShell>
      <PageHeader
        back={{ href: "/commissions", label: "كل العمولات" }}
        title={brand.isPending ? <Skeleton className="h-9 w-56" /> : name || "متجر"}
        description={
          status.data ? (
            <>
              عمولة <span className="num">{formatRate(status.data.commissionRate)}</span> على كل طلب مسلَّم، والسداد خلال{" "}
              <span className="num">{status.data.settlementDays}</span> يوم.{" "}
              <Link href={`/brands/${brandId}`} className="text-accent underline-offset-4 hover:underline">
                صفحة المتجر
              </Link>
            </>
          ) : undefined
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Ledger brandId={brandId} />
        </div>
        <div className="flex flex-col gap-6">
          <Panel>
            {status.isPending ? (
              <Skeleton className="h-48 w-full" />
            ) : status.isError || !status.data ? (
              <ErrorState error={status.error} onRetry={() => status.refetch()} className="py-8" />
            ) : (
              <>
                {status.data.blocked && (
                  <div className="mb-4 rounded-sm border border-danger/30 bg-danger-soft px-4 py-3 text-ui">
                    <p className="font-semibold text-danger">المتجر متوقف عن استقبال الطلبات</p>
                    <p className="mt-1 text-ink">
                      {status.data.balance > status.data.maxUnpaidBalance
                        ? `المستحق عدّى الحد المسموح (${formatMoney(status.data.maxUnpaidBalance)}).`
                        : "فات ميعاد السداد."}{" "}
                      بيرجع يستقبل طلبات أول ما يسدد.
                    </p>
                  </div>
                )}
                <DetailList title="الحالة">
                  <CommissionFacts status={status.data} />
                  <DetailRow label="حد التوقف">
                    <span className="num">{formatMoney(status.data.maxUnpaidBalance)}</span>
                  </DetailRow>
                </DetailList>
              </>
            )}
          </Panel>
          <AdjustForm brandId={brandId} brandName={name || "المتجر"} />
        </div>
      </div>
    </PageShell>
  );
}
