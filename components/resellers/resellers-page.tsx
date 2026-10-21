"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Ban, CheckCircle2, Copy, UserCheck, XCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { ResellerPayout } from "@/lib/api/types";
import {
  formatDateTime,
  formatMoney,
  formatPhone,
  formatRelative,
} from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import {
  DataTable,
  MobileRow,
  type TableFeatures,
} from "@/components/data/data-table";
import {
  FilterChips,
  FilterDialog,
  type FilterSection,
} from "@/components/data/filter-dialog";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { RowMenu } from "@/components/data/row-menu";
import { Badge, PAYOUT_STATUS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { useToast } from "@/components/ui/toast";

const PAGE_SIZE = 20;
const helper = createColumnHelper<TableFeatures, ResellerPayout>();
const NO_ROWS: ResellerPayout[] = [];

const DEFAULT_STATUS = "REQUESTED";
const STATUS_OPTIONS = [
  {
    value: "REQUESTED",
    label: "مستني التحويل",
    hint: "طلبات سحب مستنية تحويل InstaPay",
  },
  { value: "PAID", label: "اتحوّل", hint: "معاها الرقم المرجعي للتحويل" },
  { value: "REJECTED", label: "اترفض", hint: "الأرباح رجعت متاحة للمسوّق" },
  { value: "ALL", label: "الكل" },
];

const EMPTY: Record<string, { title: string; description: string }> = {
  REQUESTED: {
    title: "مفيش طلبات سحب مستنية",
    description: "لما مسوّق يطلب سحب أرباح طلبات اتسلّمت، الطلب هيظهر هنا.",
  },
  PAID: {
    title: "لسه مفيش تحويلات",
    description: "الطلبات اللي بتأكد تحويلها بتظهر هنا مع الرقم المرجعي.",
  },
  REJECTED: {
    title: "مفيش طلبات مرفوضة",
    description: "الطلبات اللي بترفضها بتظهر هنا مع السبب.",
  },
  ALL: {
    title: "لسه مفيش طلبات سحب",
    description: "المسوّقين بيطلبوا سحب أرباحهم من التطبيق.",
  },
};

const REJECT_REASONS = [
  "عنوان InstaPay غلط",
  "الاسم مش مطابق لصاحب الحساب",
  "فيه طلب مرتجع على الأرباح دي",
];

const resellerName = (p: ResellerPayout) => p.reseller?.name || "مسوّق محذوف";

/** «تم التحويل»: the admin types the InstaPay transaction reference (4–64 characters). */
function PaidDialog({
  payout,
  loading,
  onClose,
  onConfirm,
}: {
  payout: ResellerPayout;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reference: string) => void;
}) {
  const [reference, setReference] = useState("");
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const value = reference.trim();
  const invalid = value.length < 4 || value.length > 64;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !loading && onClose()}
      title={`تأكيد تحويل ${formatMoney(payout.amount)}`}
      description={`حوّل المبلغ على InstaPay لـ${payout.payoutName} (${payout.payoutAddress})، وبعدين اكتب الرقم المرجعي للتحويل. المسوّق بيشوفه في التطبيق.`}
      initialFocus={input}
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={() => {
              setTouched(true);
              if (!invalid) onConfirm(value);
            }}
          >
            تم التحويل
          </Button>
        </>
      }
    >
      <Field
        label="الرقم المرجعي لتحويل InstaPay"
        error={
          touched && invalid ? "اكتب الرقم المرجعي (من 4 لـ 64 حرف)" : undefined
        }
      >
        {(a11y) => (
          <Input
            {...a11y}
            ref={input}
            dir="ltr"
            value={reference}
            maxLength={64}
            onChange={(e) => setReference(e.target.value)}
            className="num"
          />
        )}
      </Field>
    </Dialog>
  );
}

export function ResellersPage() {
  const url = useUrlState();
  const toast = useToast();
  const status = STATUS_OPTIONS.some((o) => o.value === url.get("status"))
    ? url.get("status")!
    : DEFAULT_STATUS;
  const [paying, setPaying] = useState<ResellerPayout | null>(null);
  const [rejecting, setRejecting] = useState<ResellerPayout | null>(null);
  const [toggling, setToggling] = useState<{
    payout: ResellerPayout;
    to: "ACTIVE" | "SUSPENDED";
  } | null>(null);

  const list = useQuery({
    queryKey: qk.payouts(status, url.page),
    queryFn: () =>
      api.page<ResellerPayout>("/admin/resellers/payouts", {
        status: status === "ALL" ? undefined : status,
        page: url.page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: status === "REQUESTED" ? 30_000 : false,
  });
  const counts = useQuery({
    queryKey: qk.payoutCounts,
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          STATUS_OPTIONS.map(async (o) => [
            o.value,
            (
              await api.page<ResellerPayout>("/admin/resellers/payouts", {
                status: o.value === "ALL" ? undefined : o.value,
                limit: 1,
              })
            ).meta.total,
          ]),
        ),
      ) as Record<string, number>,
    refetchInterval: 60_000,
  });

  const paid = useAction({
    run: ({ id, reference }: { id: string; reference: string }) =>
      api.post(`/admin/resellers/payouts/${id}/paid`, { reference }),
    success: "تم تسجيل التحويل",
    failure: "لم يتم تسجيل التحويل",
    invalidate: [["resellers"]],
    onDone: () => setPaying(null),
  });
  const reject = useAction({
    run: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/admin/resellers/payouts/${id}/reject`, { reason }),
    success: "تم رفض طلب السحب",
    failure: "لم يتم رفض طلب السحب",
    invalidate: [["resellers"]],
    onDone: () => setRejecting(null),
  });
  const setStatus = useAction({
    run: ({ userId, to }: { userId: string; to: "ACTIVE" | "SUSPENDED" }) =>
      api.post(`/admin/resellers/${userId}/status`, { status: to }),
    success: (v) => ({
      title: v.to === "SUSPENDED" ? "تم إيقاف المسوّق" : "تم تفعيل المسوّق",
    }),
    failure: "لم يتم تحديث حالة المسوّق",
    invalidate: [["resellers"]],
    onDone: () => setToggling(null),
  });

  const copyAddress = async (p: ResellerPayout) => {
    await navigator.clipboard
      ?.writeText(p.payoutAddress)
      .catch(() => undefined);
    toast({
      tone: "success",
      title: "تم نسخ عنوان InstaPay",
      description: p.payoutAddress,
    });
  };

  const menu = (p: ResellerPayout) => (
    <RowMenu
      label={`إجراءات طلب سحب ${resellerName(p)}`}
      items={[
        {
          label: "تم التحويل",
          icon: CheckCircle2,
          hidden: p.status !== "REQUESTED",
          onSelect: () => setPaying(p),
        },
        {
          label: "نسخ عنوان InstaPay",
          icon: Copy,
          onSelect: () => copyAddress(p),
        },
        {
          label: "رفض الطلب",
          icon: XCircle,
          danger: true,
          separated: true,
          hidden: p.status !== "REQUESTED",
          onSelect: () => setRejecting(p),
        },
        // The list doesn't say whether the reseller is suspended, so both moves are offered.
        {
          label: "إيقاف المسوّق",
          icon: Ban,
          danger: true,
          separated: true,
          onSelect: () => setToggling({ payout: p, to: "SUSPENDED" }),
        },
        {
          label: "تفعيل المسوّق",
          icon: UserCheck,
          onSelect: () => setToggling({ payout: p, to: "ACTIVE" }),
        },
      ]}
    />
  );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("reseller", {
          header: "المسوّق",
          cell: (info) => (
            <span className="flex flex-col">
              <span className="font-medium text-ink">
                {resellerName(info.row.original)}
              </span>
              {info.getValue()?.phone && (
                <span className="num text-meta text-ink-3">
                  {formatPhone(info.getValue()!.phone)}
                </span>
              )}
            </span>
          ),
        }),
        helper.accessor("amount", {
          header: "المبلغ",
          cell: (info) => (
            <span className="num font-semibold">
              {formatMoney(info.getValue())}
            </span>
          ),
        }),
        helper.accessor("payoutAddress", {
          header: "InstaPay",
          cell: (info) => {
            const p = info.row.original;
            return (
              <span className="flex items-center gap-1">
                <span className="flex min-w-0 flex-col">
                  <span dir="ltr" className="num truncate text-start text-ink">
                    {p.payoutAddress}
                  </span>
                  <span className="text-meta text-ink-3">{p.payoutName}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="نسخ عنوان InstaPay"
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyAddress(p);
                  }}
                >
                  <Copy aria-hidden className="size-4" />
                </Button>
              </span>
            );
          },
        }),
        helper.accessor("status", {
          header: "الحالة",
          cell: (info) => {
            const p = info.row.original;
            return (
              <span className="flex flex-col items-start gap-1">
                <Badge tone={PAYOUT_STATUS[p.status].tone}>
                  {PAYOUT_STATUS[p.status].label}
                </Badge>
                {p.status === "PAID" && p.reference && (
                  <span dir="ltr" className="num text-meta text-ink-3">
                    {p.reference}
                  </span>
                )}
                {p.status === "REJECTED" && p.rejectReason && (
                  <span className="max-w-56 truncate text-meta text-ink-3">
                    {p.rejectReason}
                  </span>
                )}
              </span>
            );
          },
        }),
        helper.accessor("createdAt", {
          header: "التاريخ",
          cell: (info) => (
            <time
              dateTime={info.getValue()}
              title={formatDateTime(info.getValue())}
              className="text-ink-2"
            >
              {formatRelative(info.getValue())}
            </time>
          ),
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">إجراءات</span>,
          cell: (info) => (
            <div className="flex items-center justify-end gap-1">
              {info.row.original.status === "REQUESTED" && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPaying(info.row.original);
                  }}
                >
                  تم التحويل
                </Button>
              )}
              {menu(info.row.original)}
            </div>
          ),
        }),
      ]),
    // menu and copyAddress only close over stable setters and helpers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sections: FilterSection[] = [
    {
      key: "status",
      label: "الحالة",
      options: STATUS_OPTIONS,
      defaultValue: DEFAULT_STATUS,
      counts: counts.data,
    },
  ];
  const values = { status };

  return (
    <PageShell>
      <PageHeader
        title="أرباح المسوّقين"
        description="المسوّقين بيبيعوا منتجات المتاجر بسعرهم. المتجر بيحصّل الفلوس كاش، والفرق (ربح المسوّق) بيتضاف على رصيد عمولة المتجر، وفاترينة بتحوّله للمسوّق على InstaPay بعد التسليم."
      />

      <div className="mt-6 flex items-center justify-between gap-2">
        <p className="text-ui text-ink-2">
          حوّل المبلغ على InstaPay للعنوان والاسم المكتوبين، وبعدين سجّل الرقم
          المرجعي للتحويل.
        </p>
        <FilterDialog
          title="تصفية طلبات السحب"
          sections={sections}
          values={values}
          onApply={(v) =>
            url.set({ status: v.status === DEFAULT_STATUS ? null : v.status })
          }
        />
      </div>
      <FilterChips
        sections={sections}
        values={values}
        onClear={() => url.set({ status: null })}
      />
      <div className="mt-4">
        <DataTable
          label="جدول طلبات سحب أرباح المسوّقين"
          columns={columns}
          data={list.data?.items ?? NO_ROWS}
          getRowId={(p) => p.id}
          isPending={list.isPending}
          isFetching={list.isFetching && list.isPlaceholderData}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={EMPTY[status]}
          paging={{
            page: url.page,
            pageSize: PAGE_SIZE,
            total: list.data?.meta.total ?? 0,
            onPage: (p) => url.set({ page: p }, { resetPage: false }),
          }}
          mobileItem={(p) => (
            <div className="flex items-start">
              <div className="min-w-0 flex-1">
                <MobileRow
                  title={resellerName(p)}
                  trailing={
                    <span className="num">{formatMoney(p.amount)}</span>
                  }
                  meta={`InstaPay: ${p.payoutAddress} — ${p.payoutName}`}
                  badge={
                    <Badge tone={PAYOUT_STATUS[p.status].tone}>
                      {PAYOUT_STATUS[p.status].label}
                    </Badge>
                  }
                />
              </div>
              <div className="pe-2 pt-3">{menu(p)}</div>
            </div>
          )}
        />
      </div>

      {paying && (
        <PaidDialog
          key={paying.id}
          payout={paying}
          loading={paid.isPending}
          onClose={() => setPaying(null)}
          onConfirm={(reference) => paid.mutate({ id: paying.id, reference })}
        />
      )}

      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="رفض طلب السحب"
        description={`السبب بيوصل لـ${rejecting ? resellerName(rejecting) : "المسوّق"}، والأرباح بترجع متاحة يطلبها تاني.`}
        confirmLabel="رفض الطلب"
        quickReasons={REJECT_REASONS}
        loading={reject.isPending}
        onConfirm={(reason) =>
          rejecting && reject.mutate({ id: rejecting.id, reason })
        }
      />

      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={
          toggling?.to === "SUSPENDED"
            ? `إيقاف ${toggling ? resellerName(toggling.payout) : ""}`
            : `تفعيل ${toggling ? resellerName(toggling.payout) : ""}`
        }
        description={
          toggling?.to === "SUSPENDED"
            ? "المسوّق مش هيقدر يعمل طلبات جديدة ولا يطلب سحب أرباح لحد ما تفعّله تاني."
            : "المسوّق يقدر يرجع يعمل طلبات ويطلب سحب أرباحه."
        }
        confirmLabel={
          toggling?.to === "SUSPENDED" ? "إيقاف المسوّق" : "تفعيل المسوّق"
        }
        tone={toggling?.to === "SUSPENDED" ? "danger" : "primary"}
        loading={setStatus.isPending}
        onConfirm={() =>
          toggling &&
          setStatus.mutate({
            userId: toggling.payout.resellerId,
            to: toggling.to,
          })
        }
      />
    </PageShell>
  );
}
