"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Copy, Eye, FileImage, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { Ad } from "@/lib/api/types";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatRelative } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { DetailList, DetailRow, Muted } from "@/components/data/detail-list";
import { FilterChips, FilterDialog, type FilterSection } from "@/components/data/filter-dialog";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { RowMenu } from "@/components/data/row-menu";
import { ReceiptViewer } from "@/components/payments/receipt-viewer";
import { AD_STATUS, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { useToast } from "@/components/ui/toast";
import { AdPrices } from "./ad-prices";

const PAGE_SIZE = 20;
const helper = createColumnHelper<TableFeatures, Ad>();
const NO_ROWS: Ad[] = [];

const DEFAULT_STATUS = "PENDING_REVIEW";
// The API filters on stored statuses; ended ads come back under ACTIVE, shown as «انتهى».
const STATUS_OPTIONS = [
  { value: "PENDING_REVIEW", label: "قيد المراجعة", hint: "إيصالات مستنية قرارك" },
  { value: "ACTIVE", label: "اتوافق عليها", hint: "الشغالة دلوقتي واللي مدتها خلصت" },
  { value: "REJECTED", label: "مرفوضة", hint: "المتجر شاف سبب الرفض" },
  { value: "ALL", label: "الكل" },
];

const EMPTY: Record<string, { title: string; description: string }> = {
  PENDING_REVIEW: { title: "مفيش إعلانات مستنية مراجعة", description: "لما متجر يدفع إعلان بتحويل InstaPay، الإيصال هيظهر هنا." },
  ACTIVE: { title: "مفيش إعلانات اتوافق عليها", description: "الإعلانات اللي بتوافق عليها بتشتغل فورًا وبتظهر هنا." },
  REJECTED: { title: "مفيش إعلانات مرفوضة", description: "الإعلانات اللي بترفضها بتظهر هنا مع السبب." },
  ALL: { title: "لسه مفيش إعلانات", description: "المتاجر بتشتري الإعلانات من لوحة المتجر." },
};

const REJECT_REASONS = ["المبلغ موصلش لحساب InstaPay", "المبلغ المحوّل أقل من المطلوب", "الرقم المرجعي مش مطابق", "المنتج مخالف لسياسة الإعلانات"];

/** Clicks ÷ impressions, as «2.4%». */
export function ctr(ad: Pick<Ad, "clicks" | "impressions">) {
  if (!ad.impressions) return "—";
  return `${formatNumber(Math.round((ad.clicks / ad.impressions) * 1000) / 10)}%`;
}

function Performance({ ad }: { ad: Ad }) {
  if (ad.status !== "ACTIVE" && ad.status !== "EXPIRED") return <span className="text-ink-3">—</span>;
  return (
    <span className="flex flex-col">
      <span className="num font-semibold text-ink" title="نسبة الضغطات من الظهور">
        {ctr(ad)}
      </span>
      <span className="text-meta text-ink-3">
        <span className="num">{formatNumber(ad.clicks)}</span> ضغطة من <span className="num">{formatNumber(ad.impressions)}</span> ظهور
      </span>
    </span>
  );
}

function useRefreshAds() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["ads", "list"] });
    queryClient.invalidateQueries({ queryKey: qk.adCounts });
    queryClient.invalidateQueries({ queryKey: qk.counts });
  };
}

/** Review one placement receipt: the facts beside the receipt (same flow as commission settlements). */
function AdReview({ ad, onClose, onReject }: { ad: Ad; onClose: () => void; onReject: () => void }) {
  const toast = useToast();
  const refresh = useRefreshAds();
  const [amountChecked, setAmountChecked] = useState(false);
  const [referenceChecked, setReferenceChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stampAt, setStampAt] = useState<string | null>(null);
  const pending = ad.status === "PENDING_REVIEW" && !stampAt;
  const s = AD_STATUS[stampAt ? "ACTIVE" : ad.status];

  const approve = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/ads/${ad.id}/approve`);
      setStampAt(new Date().toISOString());
      toast({ tone: "success", title: "الإعلان اشتغل", description: `${ad.placementName} لمدة ${ad.weeks * 7} يوم من دلوقتي.` });
      refresh();
      // Let the stamp land before closing.
      setTimeout(onClose, 1100);
    } catch (e) {
      const stale = e instanceof ApiError && e.code === "AD_NOT_PENDING";
      toast({
        tone: "error",
        title: stale ? "الإعلان ده اتراجع خلاص" : "لم يتم حفظ القرار",
        description: stale ? "حدّثنا البيانات لتعرض القرار الحالي." : e instanceof ApiError ? e.message : "أعد المحاولة بعد قليل.",
      });
      if (stale) {
        refresh();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(o) => !o && !busy && onClose()}
      title={`إعلان — ${ad.brandName || "متجر"}`}
      description={`${ad.placementName} · أُرسل ${formatRelative(ad.createdAt)}`}
      footer={
        pending ? (
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <fieldset className="min-w-0">
              <legend className="mb-1 text-meta font-medium text-ink-3">قبل الموافقة، تأكد بنفسك:</legend>
              <Checkbox checked={amountChecked} onCheckedChange={setAmountChecked}>
                وصل مبلغ <span className="num font-semibold">{formatMoney(ad.price)}</span> فعلًا إلى حساب InstaPay
              </Checkbox>
              <Checkbox checked={referenceChecked} onCheckedChange={setReferenceChecked}>
                الرقم المرجعي في تطبيق InstaPay مطابق للمكتوب هنا
              </Checkbox>
            </fieldset>
            <div className="flex shrink-0 gap-2">
              <Button variant="danger" onClick={onReject} disabled={busy}>
                رفض
              </Button>
              <Button variant="primary" onClick={approve} disabled={!amountChecked || !referenceChecked} loading={busy} className="min-w-40">
                موافقة وتشغيل
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <section aria-label="بيانات الإعلان" className="min-w-0">
          <div className="mb-2">
            <Badge tone={s.tone}>{s.label}</Badge>
          </div>
          <DetailList title="قارن مع الإيصال">
            <DetailRow label="المبلغ" strong>
              <span className="num">{formatMoney(ad.price)}</span>
            </DetailRow>
            <DetailRow label="الرقم المرجعي">
              <span className="num truncate rounded-sm bg-sunken px-2 py-0.5 tracking-wider">{ad.transactionReference}</span>
            </DetailRow>
            <DetailRow label="أُرسل">{formatDateTime(ad.createdAt)}</DetailRow>
          </DetailList>
          <DetailList title="الإعلان" className="mt-6">
            <DetailRow label="المكان">{ad.placementName}</DetailRow>
            <DetailRow label="المدة">
              <span className="num">{ad.weeks}</span> {ad.weeks === 1 ? "أسبوع" : "أسابيع"}
            </DetailRow>
            <DetailRow label="المنتج">{ad.productTitle || <Muted>منتج محذوف</Muted>}</DetailRow>
            <DetailRow label="المتجر">
              <Link href={`/brands/${ad.brandId}`} className="text-accent underline-offset-4 hover:underline">
                {ad.brandName || "متجر"}
              </Link>
            </DetailRow>
            {ad.startsAt && (
              <DetailRow label="الفترة">
                {formatDate(ad.startsAt)} <span className="text-ink-3">←</span> {formatDate(ad.endsAt)}
              </DetailRow>
            )}
            {(ad.status === "ACTIVE" || ad.status === "EXPIRED") && (
              <DetailRow label="الأداء">
                <Performance ad={ad} />
              </DetailRow>
            )}
          </DetailList>
          {ad.status === "REJECTED" && ad.rejectReason && (
            <div className="mt-6 rounded-sm border border-danger/30 bg-danger-soft px-4 py-3 text-ui">
              <p className="font-semibold text-danger">سبب الرفض</p>
              <p className="mt-1 text-ink">{ad.rejectReason}</p>
            </div>
          )}
        </section>

        <ReceiptViewer kind="ad" paymentId={ad.id} hasProof approvedAt={stampAt ?? (ad.status !== "PENDING_REVIEW" && ad.status !== "REJECTED" ? ad.startsAt ?? undefined : undefined)} stampAnimating={!!stampAt} />
      </div>
    </Dialog>
  );
}

export function AdsPage() {
  const url = useUrlState();
  const toast = useToast();
  const status = STATUS_OPTIONS.some((o) => o.value === url.get("status")) ? url.get("status")! : DEFAULT_STATUS;
  const [reviewing, setReviewing] = useState<Ad | null>(null);
  const [rejecting, setRejecting] = useState<Ad | null>(null);

  const list = useQuery({
    queryKey: qk.ads(status, url.page),
    queryFn: () => api.page<Ad>("/admin/ads", { status: status === "ALL" ? undefined : status, page: url.page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    refetchInterval: status === "PENDING_REVIEW" ? 30_000 : false,
  });
  const counts = useQuery({
    queryKey: qk.adCounts,
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          STATUS_OPTIONS.map(async (o) => [o.value, (await api.page<Ad>("/admin/ads", { status: o.value === "ALL" ? undefined : o.value, limit: 1 })).meta.total]),
        ),
      ) as Record<string, number>,
    refetchInterval: 60_000,
  });

  const reject = useAction({
    run: ({ id, reason }: { id: string; reason: string }) => api.post(`/admin/ads/${id}/reject`, { reason }),
    success: "تم رفض الإعلان",
    failure: "لم يتم رفض الإعلان",
    invalidate: [["ads"]],
    onDone: () => {
      setRejecting(null);
      setReviewing(null);
    },
  });

  const openReceipt = async (ad: Ad) => {
    // Open the tab synchronously so the browser doesn't block it, then point it at the signed link.
    const tab = window.open("", "_blank");
    try {
      const { url: signed } = await api.get<{ url: string }>(`/admin/ads/${ad.id}/proof`);
      if (tab) tab.location.href = signed;
      else window.location.assign(signed);
    } catch (e) {
      tab?.close();
      toast({ tone: "error", title: "تعذّر فتح الإيصال", description: e instanceof ApiError ? e.message : undefined });
    }
  };

  const copyReference = async (ad: Ad) => {
    await navigator.clipboard?.writeText(ad.transactionReference).catch(() => undefined);
    toast({ tone: "success", title: "تم نسخ الرقم المرجعي", description: ad.transactionReference });
  };

  const menu = (ad: Ad) => (
    <RowMenu
      label={`إجراءات إعلان ${ad.brandName}`}
      items={[
        { label: ad.status === "PENDING_REVIEW" ? "مراجعة وموافقة" : "عرض التفاصيل", icon: ad.status === "PENDING_REVIEW" ? ShieldCheck : Eye, onSelect: () => setReviewing(ad) },
        { label: "فتح الإيصال في نافذة جديدة", icon: FileImage, onSelect: () => openReceipt(ad) },
        { label: "نسخ الرقم المرجعي", icon: Copy, onSelect: () => copyReference(ad) },
        { label: "رفض الإعلان", icon: XCircle, danger: true, separated: true, hidden: ad.status !== "PENDING_REVIEW", onSelect: () => setRejecting(ad) },
      ]}
    />
  );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("productTitle", {
          header: "المنتج والمتجر",
          cell: (info) => (
            <span className="flex max-w-72 flex-col">
              <span className="truncate font-medium text-ink">{info.getValue() || "منتج محذوف"}</span>
              <span className="text-meta text-ink-3">{info.row.original.brandName || "متجر محذوف"}</span>
            </span>
          ),
        }),
        helper.accessor("placementName", {
          header: "المكان والمدة",
          cell: (info) => (
            <span className="flex flex-col">
              <span>{info.getValue()}</span>
              <span className="text-meta text-ink-3">
                <span className="num">{info.row.original.weeks}</span> {info.row.original.weeks === 1 ? "أسبوع" : "أسابيع"}
              </span>
            </span>
          ),
        }),
        helper.accessor("price", {
          header: "المبلغ",
          cell: (info) => <span className="num font-semibold">{formatMoney(info.getValue())}</span>,
        }),
        helper.accessor("status", {
          header: "الحالة",
          cell: (info) => {
            const ad = info.row.original;
            return (
              <span className="flex flex-col items-start gap-1">
                <Badge tone={AD_STATUS[ad.status].tone}>{AD_STATUS[ad.status].label}</Badge>
                {ad.status === "ACTIVE" && ad.endsAt && <span className="text-meta text-ink-3">لحد {formatDate(ad.endsAt)}</span>}
              </span>
            );
          },
        }),
        helper.display({ id: "ctr", header: "الأداء", cell: (info) => <Performance ad={info.row.original} /> }),
        helper.accessor("createdAt", {
          header: "أُرسل",
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
            const ad = info.row.original;
            const isPending = ad.status === "PENDING_REVIEW";
            return (
              <div className="flex items-center justify-end gap-1">
                <Button
                  size="sm"
                  variant={isPending ? "primary" : "ghost"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setReviewing(ad);
                  }}
                >
                  {isPending ? "مراجعة" : "عرض"}
                </Button>
                {menu(ad)}
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
    <PageShell>
      <PageHeader title="الإعلانات" description="المتاجر بتدفع عشان منتجاتها تظهر في أول البحث أو القسم أو الرئيسية. طابق الإيصال ووافق، والإعلان بيشتغل فورًا." />

      <div className="mt-6 flex items-center justify-between gap-2">
        <p className="text-ui text-ink-2">طابق كل إيصال مع حساب InstaPay قبل الموافقة؛ مدة الإعلان بتبدأ من لحظة الموافقة.</p>
        <FilterDialog
          title="تصفية الإعلانات"
          sections={sections}
          values={values}
          onApply={(v) => url.set({ status: v.status === DEFAULT_STATUS ? null : v.status })}
        />
      </div>
      <FilterChips sections={sections} values={values} onClear={() => url.set({ status: null })} />
      <div className="mt-4">
        <DataTable
          label="جدول الإعلانات"
          columns={columns}
          data={list.data?.items ?? NO_ROWS}
          getRowId={(ad) => ad.id}
          onRowClick={setReviewing}
          isPending={list.isPending}
          isFetching={list.isFetching && list.isPlaceholderData}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={EMPTY[status]}
          paging={{ page: url.page, pageSize: PAGE_SIZE, total: list.data?.meta.total ?? 0, onPage: (p) => url.set({ page: p }, { resetPage: false }) }}
          mobileItem={(ad) => (
            <div className="flex items-start">
              <button type="button" onClick={() => setReviewing(ad)} className="min-w-0 flex-1 text-start">
                <MobileRow
                  title={ad.productTitle || "منتج محذوف"}
                  trailing={<span className="num">{formatMoney(ad.price)}</span>}
                  meta={`${ad.brandName} — ${ad.placementName}${ad.status === "ACTIVE" || ad.status === "EXPIRED" ? ` — ${ctr(ad)}` : ""}`}
                  badge={<Badge tone={AD_STATUS[ad.status].tone}>{AD_STATUS[ad.status].label}</Badge>}
                />
              </button>
              <div className="pe-2 pt-3">{menu(ad)}</div>
            </div>
          )}
        />
      </div>

      <div className="mt-10">
        <AdPrices />
      </div>

      {reviewing && <AdReview key={reviewing.id} ad={reviewing} onClose={() => setReviewing(null)} onReject={() => setRejecting(reviewing)} />}

      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="رفض الإعلان"
        description={`السبب بيوصل لـ${rejecting?.brandName || "المتجر"}، ويقدر يطلب إعلان جديد بإيصال صحيح.`}
        confirmLabel="رفض الإعلان"
        quickReasons={REJECT_REASONS}
        loading={reject.isPending}
        onConfirm={(reason) => rejecting && reject.mutate({ id: rejecting.id, reason })}
      />
    </PageShell>
  );
}
