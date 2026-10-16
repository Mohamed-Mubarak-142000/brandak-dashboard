"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FileImage,
  Inbox,
  MoreHorizontal,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import type { PaymentListItem } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney, formatRelative, normalizeSearch } from "@/lib/format";
import { Badge, PAYMENT_STATUS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ActiveFilterChips, DEFAULT_STATUS, defaultSort, FILTERS, PaymentFilters, type Filter, type Sort } from "./payment-filters";
import { RejectDialog } from "./reject-dialog";

const PAGE_SIZE = 20;

const EMPTY: Record<Filter, { title: string; description: string }> = {
  PENDING_REVIEW: { title: "لا توجد إيصالات بانتظارك", description: "أي إيصال جديد يرفعه صاحب براند سيظهر هنا، الأقدم أولًا." },
  AWAITING_PROOF: { title: "لا توجد طلبات معلّقة", description: "طلبات الاشتراك التي لم يُرفع لها إيصال بعد تظهر هنا." },
  REJECTED: { title: "لا توجد إيصالات مرفوضة", description: "الإيصالات المرفوضة تبقى هنا حتى يرفع صاحبها إيصالًا جديدًا." },
  APPROVED: { title: "لم تُعتمد أي دفعة بعد", description: "كل دفعة تعتمدها تظهر هنا مع تاريخ الاعتماد." },
  CANCELLED: { title: "لا توجد طلبات ملغاة", description: "يُلغى الطلب تلقائيًا عندما يختار صاحب البراند باقة أخرى قبل الدفع." },
  ALL: { title: "لا توجد مدفوعات بعد", description: "عندما يطلب صاحب براند اشتراكًا سيظهر طلبه هنا." },
};

// Module scope: stable inputs for the table (see TanStack Table v9 guidance).
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, PaymentListItem>();
const emptyRows: PaymentListItem[] = [];

interface RowActions {
  open: (p: PaymentListItem) => void;
  reject: (p: PaymentListItem) => void;
  openReceipt: (p: PaymentListItem) => void;
  copyReference: (p: PaymentListItem) => void;
}

function ActionsMenu({ payment, actions }: { payment: PaymentListItem; actions: RowActions }) {
  const pending = payment.status === "PENDING_REVIEW";
  const hasProof = !!payment.transactionReference;
  const item =
    "flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-sm px-3 text-ui text-ink outline-none data-[highlighted]:bg-sunken data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-3";
  return (
    <Menu.Root dir="rtl">
      <Menu.Trigger
        aria-label={`إجراءات دفعة ${payment.brandId?.name ?? ""}`}
        onClick={(e) => e.stopPropagation()}
        className="grid size-9 place-items-center rounded-sm text-ink-2 hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken"
      >
        <MoreHorizontal className="size-5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
          className="z-50 min-w-52 rounded-md border border-line bg-surface p-1 shadow-pop"
        >
          <Menu.Item className={item} onSelect={() => actions.open(payment)}>
            {pending ? <ShieldCheck aria-hidden className="size-4 text-accent" /> : <Eye aria-hidden className="size-4" />}
            {pending ? "مراجعة واعتماد" : "عرض التفاصيل"}
          </Menu.Item>
          <Menu.Item className={item} disabled={!hasProof} onSelect={() => actions.openReceipt(payment)}>
            <FileImage aria-hidden className="size-4" />
            فتح الإيصال في نافذة جديدة
          </Menu.Item>
          <Menu.Item className={item} disabled={!payment.transactionReference} onSelect={() => actions.copyReference(payment)}>
            <Copy aria-hidden className="size-4" />
            نسخ الرقم المرجعي
          </Menu.Item>
          {pending && (
            <>
              <Menu.Separator className="my-1 h-px bg-line" />
              <Menu.Item
                className={cn(item, "text-danger data-[highlighted]:bg-danger-soft")}
                onSelect={() => actions.reject(payment)}
              >
                <XCircle aria-hidden className="size-4" />
                رفض الإيصال
              </Menu.Item>
            </>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function buildColumns(actions: RowActions) {
  return helper.columns([
    helper.accessor((p) => p.brandId?.name ?? "براند محذوف", {
      id: "brand",
      header: "البراند",
      cell: (info) => (
        <Link
          href={`/payments/${info.row.original._id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-ink underline-offset-4 hover:text-accent hover:underline"
        >
          {info.getValue()}
        </Link>
      ),
    }),
    helper.accessor("amount", {
      header: "المبلغ",
      cell: (info) => <span className="num font-semibold">{formatMoney(info.getValue())}</span>,
    }),
    helper.accessor("transactionReference", {
      header: "الرقم المرجعي",
      cell: (info) =>
        info.getValue() ? (
          <span className="num rounded-sm bg-sunken px-1.5 py-0.5 text-ui tracking-wider">{info.getValue()}</span>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    }),
    helper.accessor("status", {
      header: "الحالة",
      cell: (info) => {
        const p = info.row.original;
        const s = PAYMENT_STATUS[info.getValue()];
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={s.tone}>{s.label}</Badge>
            {p.status === "PENDING_REVIEW" && p.previousAttempts.length > 0 && (
              <Badge tone="danger">
                {p.previousAttempts.length === 1 ? "رُفض مرة سابقة" : <>رُفض <span className="num">{p.previousAttempts.length}</span> مرات</>}
              </Badge>
            )}
          </span>
        );
      },
    }),
    helper.accessor((p) => p.submittedAt ?? p.createdAt, {
      id: "submitted",
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
      cell: (info) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant={info.row.original.status === "PENDING_REVIEW" ? "primary" : "ghost"}
            onClick={(e) => {
              e.stopPropagation();
              actions.open(info.row.original);
            }}
          >
            {info.row.original.status === "PENDING_REVIEW" ? "مراجعة" : "عرض"}
          </Button>
          <ActionsMenu payment={info.row.original} actions={actions} />
        </div>
      ),
    }),
  ]);
}

export function PaymentsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const status = (FILTERS.find((f) => f.value === params.get("status"))?.value ?? DEFAULT_STATUS) as Filter;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const sortParam = params.get("sort");
  const sort: Sort = sortParam === "oldest" || sortParam === "newest" ? sortParam : defaultSort(status);
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<PaymentListItem | null>(null);

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params);
      for (const [k, v] of Object.entries(next)) {
        if (v === null) sp.delete(k);
        else sp.set(k, v);
      }
      router.replace(`${pathname}?${sp}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const list = useQuery({
    queryKey: qk.paymentsPage(status, page, sort),
    queryFn: () =>
      api.page<PaymentListItem>("/admin/payments", {
        status: status === "ALL" ? undefined : status,
        sort,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: status === "PENDING_REVIEW" ? 30_000 : false,
  });

  const counts = useQuery({
    queryKey: qk.paymentCounts,
    queryFn: async () => {
      const entries = await Promise.all(
        FILTERS.map(async (f) => {
          const res = await api.page("/admin/payments", { status: f.value === "ALL" ? undefined : f.value, limit: 1 });
          return [f.value, res.meta.total] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<Filter, number>;
    },
    refetchInterval: 60_000,
  });

  // Quick find within the loaded page (brand name or transfer reference).
  const rows = useMemo(() => {
    const items = list.data?.items ?? emptyRows;
    const q = normalizeSearch(search);
    if (!q) return items;
    return items.filter(
      (p) =>
        normalizeSearch(p.brandId?.name ?? "").includes(q) ||
        normalizeSearch(p.transactionReference ?? "").includes(q),
    );
  }, [list.data, search]);

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/admin/payments/${id}/reject`, { reason }),
    onSuccess: () => {
      setRejecting(null);
      toast({ tone: "success", title: "تم رفض الإيصال", description: "وصل السبب إلى صاحب البراند." });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: qk.counts });
    },
    onError: (e) =>
      toast({
        tone: "error",
        title: e instanceof ApiError && e.code === "ALREADY_REVIEWED" ? "تمت مراجعة هذا الإيصال بالفعل" : "لم يتم رفض الإيصال",
        description: e instanceof ApiError ? e.message : undefined,
      }),
  });

  const actions = useMemo<RowActions>(
    () => ({
      open: (p) => router.push(`/payments/${p._id}`),
      reject: (p) => setRejecting(p),
      copyReference: async (p) => {
        if (!p.transactionReference) return;
        await navigator.clipboard?.writeText(p.transactionReference).catch(() => undefined);
        toast({ tone: "success", title: "تم نسخ الرقم المرجعي", description: p.transactionReference });
      },
      openReceipt: async (p) => {
        // Open the tab synchronously so the browser doesn't block it, then point it at the signed link.
        const tab = window.open("", "_blank");
        try {
          const { url } = await api.get<{ url: string }>(`/admin/payments/${p._id}/proof-url`);
          if (tab) tab.location.href = url;
          else window.location.assign(url);
        } catch (e) {
          tab?.close();
          toast({ tone: "error", title: "تعذّر فتح الإيصال", description: e instanceof ApiError ? e.message : undefined });
        }
      },
    }),
    [router, toast, setRejecting],
  );

  const columns = useMemo(() => buildColumns(actions), [actions]);
  const table = useTable({ features, columns, data: rows, getRowId: (row) => row._id });

  const total = list.data?.meta.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-page text-ink">المدفوعات</h1>
        <p className="text-ui text-ink-2">طابق كل إيصال مع حساب InstaPay قبل تفعيل الاشتراك.</p>
      </header>

      <div className="mt-6 flex items-center gap-2">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">بحث باسم البراند أو الرقم المرجعي</span>
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم البراند أو الرقم المرجعي"
            className="h-11 w-full rounded-sm border border-line-strong bg-surface ps-9 pe-3 text-ui text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-accent focus:outline-none"
          />
        </label>
        <PaymentFilters
          status={status}
          sort={sort}
          counts={counts.data}
          onApply={(next) =>
            setParams({
              status: next.status === DEFAULT_STATUS ? null : next.status,
              sort: next.sort === defaultSort(next.status) ? null : next.sort,
              page: null,
            })
          }
        />
      </div>
      <ActiveFilterChips
        status={status}
        sort={sort}
        onClear={(what) =>
          setParams(what === "sort" ? { sort: null, page: null } : { status: null, sort: null, page: null })
        }
      />

      <section aria-label="جدول المدفوعات" className="mt-4 overflow-hidden rounded-md border border-line bg-surface" aria-busy={list.isFetching}>
        {list.isPending ? (
          <TableSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          search ? (
            <EmptyState title="لا توجد نتائج" description="جرّب اسمًا آخر أو امسح البحث. البحث يشمل الصفحة الحالية فقط." />
          ) : (
            <EmptyState icon={<Inbox className="size-8" />} {...EMPTY[status]} />
          )
        ) : (
          <>
            {/* Desktop: a real table. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-ui">
                <thead>
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id} className="border-b border-line bg-sunken">
                      {group.headers.map((header) => (
                        <th key={header.id} scope="col" className="h-11 px-4 text-start text-meta font-semibold whitespace-nowrap text-ink-2">
                          {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className={cn(list.isPlaceholderData && "opacity-60")}>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => actions.open(row.original)}
                      className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-sunken/70"
                    >
                      {row.getAllCells().map((cell) => (
                        <td key={cell.id} className="h-14 px-4 align-middle whitespace-nowrap">
                          <table.FlexRender cell={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: the same rows as a list, since seven columns don't fit 390px. */}
            <ul className="divide-y divide-line md:hidden">
              {table.getRowModel().rows.map(({ original: p }) => {
                const s = PAYMENT_STATUS[p.status];
                return (
                  <li key={p._id} className="flex items-start gap-3 px-4 py-3.5">
                    <Link href={`/payments/${p._id}`} className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-body font-medium text-ink">{p.brandId?.name ?? "براند محذوف"}</span>
                        <span className="num shrink-0 font-semibold text-ink">{formatMoney(p.amount)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2 text-meta text-ink-3">
                        <span>{formatRelative(p.submittedAt ?? p.createdAt)}</span>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </span>
                    </Link>
                    <ActionsMenu payment={p} actions={actions} />
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {total > 0 && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-ui text-ink-2">
            <span>
              عرض <span className="num">{from}</span>–<span className="num">{to}</span> من <span className="num">{total}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>
                <ChevronRight aria-hidden className="size-4" />
                السابق
              </Button>
              <span className="text-meta">
                صفحة <span className="num">{page}</span> من <span className="num">{pageCount}</span>
              </span>
              <Button size="sm" disabled={page >= pageCount} onClick={() => setParams({ page: String(page + 1) })}>
                التالي
                <ChevronLeft aria-hidden className="size-4" />
              </Button>
            </div>
          </footer>
        )}
      </section>

      <RejectDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        onConfirm={(reason) => rejecting && reject.mutate({ id: rejecting._id, reason })}
        loading={reject.isPending}
        brandName={rejecting?.brandId?.name ?? ""}
      />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div aria-label="جارٍ تحميل المدفوعات">
      <div className="h-11 border-b border-line bg-sunken" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-6 border-b border-line px-4 last:border-b-0">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="hidden h-4 w-28 md:block" />
          <Skeleton className="hidden h-6 w-24 rounded-full md:block" />
          <Skeleton className="ms-auto h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
