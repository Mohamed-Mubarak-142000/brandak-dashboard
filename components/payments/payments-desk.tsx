"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import type { PaymentListItem, PaymentStatus } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney, formatRelative } from "@/lib/format";
import { Badge, PAYMENT_STATUS } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PaymentReview } from "./payment-review";
import { isTyping } from "./receipt-viewer";

const FILTERS: { value: PaymentStatus; label: string; sort: "oldest" | "newest" }[] = [
  { value: "PENDING_REVIEW", label: "قيد المراجعة", sort: "oldest" },
  { value: "AWAITING_PROOF", label: "بانتظار الإيصال", sort: "newest" },
  { value: "REJECTED", label: "مرفوضة", sort: "newest" },
  { value: "APPROVED", label: "معتمدة", sort: "newest" },
];

const EMPTY: Record<PaymentStatus, { title: string; description: string }> = {
  PENDING_REVIEW: { title: "لا توجد إيصالات بانتظارك", description: "أي إيصال جديد يرفعه صاحب براند سيظهر هنا، الأقدم أولًا." },
  AWAITING_PROOF: { title: "لا توجد طلبات معلّقة", description: "طلبات الاشتراك التي لم يُرفع لها إيصال بعد تظهر هنا." },
  REJECTED: { title: "لا توجد إيصالات مرفوضة", description: "الإيصالات التي ترفضها تبقى هنا حتى يرفع صاحبها إيصالًا جديدًا." },
  APPROVED: { title: "لم تُعتمد أي دفعة بعد", description: "كل دفعة تعتمدها تظهر هنا مع تاريخ الاعتماد." },
  CANCELLED: { title: "", description: "" },
};

export function PaymentsDesk() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = (FILTERS.find((f) => f.value === params.get("status"))?.value ?? "PENDING_REVIEW") as PaymentStatus;
  const selectedId = params.get("id");
  const filter = FILTERS.find((f) => f.value === status)!;
  const listRef = useRef<HTMLUListElement>(null);

  const setParams = useCallback(
    (next: { status?: string; id?: string | null }) => {
      const sp = new URLSearchParams(params);
      if (next.status) sp.set("status", next.status);
      if (next.id === null) sp.delete("id");
      else if (next.id) sp.set("id", next.id);
      router.replace(`${pathname}?${sp}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const list = useQuery({
    queryKey: qk.payments(status),
    queryFn: () => api.page<PaymentListItem>("/admin/payments", { status, sort: filter.sort, limit: 50 }),
    refetchInterval: status === "PENDING_REVIEW" ? 30_000 : false,
  });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const index = items.findIndex((p) => p._id === selectedId);

  // On wide screens, always have something open: the first receipt in the queue.
  useEffect(() => {
    if (!selectedId && items.length && window.matchMedia("(min-width: 1024px)").matches) {
      setParams({ id: items[0]._id });
    }
  }, [selectedId, items, setParams]);

  const move = useCallback(
    (delta: number) => {
      if (!items.length) return;
      const nextIndex = index === -1 ? 0 : Math.min(Math.max(index + delta, 0), items.length - 1);
      setParams({ id: items[nextIndex]._id });
      listRef.current?.querySelectorAll("a")[nextIndex]?.scrollIntoView({ block: "nearest" });
    },
    [index, items, setParams],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || document.querySelector("[role=dialog]")) return;
      if (e.key.toLowerCase() === "j") move(1);
      if (e.key.toLowerCase() === "k") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  /** After a decision, the decided item leaves the queue; open the one that takes its place. */
  const afterDecision = () => {
    const remaining = items.filter((p) => p._id !== selectedId);
    const next = remaining[Math.min(Math.max(index, 0), remaining.length - 1)];
    setParams({ id: next?._id ?? null });
  };

  const total = list.data?.meta.total;

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] lg:h-dvh">
      {/* Queue */}
      <section
        aria-label="قائمة الإيصالات"
        className={cn(
          "flex w-full shrink-0 flex-col border-e border-line bg-ground lg:w-[22rem]",
          selectedId && "hidden lg:flex",
        )}
      >
        <div className="px-5 pb-3 pt-6">
          <h1 className="font-display text-page text-ink">مراجعة المدفوعات</h1>
          <p className="mt-1 text-ui text-ink-2">
            طابق كل إيصال مع حساب InstaPay قبل تفعيل الاشتراك.
          </p>
        </div>

        <Tabs.Root value={status} onValueChange={(v) => setParams({ status: v, id: null })} dir="rtl">
          <Tabs.List aria-label="حالة الدفع" className="flex gap-1 overflow-x-auto border-b border-line px-3">
            {FILTERS.map((f) => (
              <Tabs.Trigger
                key={f.value}
                value={f.value}
                className={cn(
                  "relative h-11 shrink-0 px-2.5 text-ui text-ink-2 transition-colors hover:text-ink",
                  "data-[state=active]:font-semibold data-[state=active]:text-ink",
                  "data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-stamp",
                )}
              >
                {f.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>

        <div className="flex items-center justify-between px-5 py-2.5 text-meta text-ink-3">
          <span aria-live="polite">
            {total === undefined ? " " : total === 0 ? "القائمة فارغة" : <>عدد الإيصالات: <span className="num">{total}</span></>}
          </span>
          <span className="hidden items-center gap-1 md:flex">
            التنقل <Kbd>J</Kbd> <Kbd>K</Kbd>
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.isPending ? (
            <ul aria-busy className="flex flex-col">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="border-b border-line px-5 py-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-24" />
                </li>
              ))}
            </ul>
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState icon={<Inbox className="size-8" />} {...EMPTY[status]} />
          ) : (
            <ul ref={listRef} className="flex flex-col">
              {items.map((p) => {
                const active = p._id === selectedId;
                const s = PAYMENT_STATUS[p.status];
                return (
                  <li key={p._id}>
                    <a
                      href={`?status=${status}&id=${p._id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setParams({ id: p._id });
                      }}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex flex-col gap-1 border-b border-line px-5 py-3.5 transition-colors",
                        active ? "bg-surface shadow-[inset_-3px_0_0_var(--stamp)]" : "hover:bg-surface/60",
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-body font-medium text-ink">{p.brandId?.name ?? "براند محذوف"}</span>
                        <span className="num shrink-0 text-body font-semibold text-ink">{formatMoney(p.amount)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-3 text-meta text-ink-3">
                        <span>{formatRelative(p.submittedAt ?? p.createdAt)}</span>
                        {status === "PENDING_REVIEW" && p.previousAttempts.length > 0 ? (
                          <Badge tone="danger">
                            {p.previousAttempts.length === 1 ? "رُفض مرة سابقة" : <>رُفض <span className="num">{p.previousAttempts.length}</span> مرات</>}
                          </Badge>
                        ) : status !== "PENDING_REVIEW" ? (
                          <Badge tone={s.tone}>{s.label}</Badge>
                        ) : null}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Review pane */}
      <section aria-label="تفاصيل الإيصال" className={cn("min-w-0 flex-1 overflow-y-auto bg-surface", !selectedId && "hidden lg:block")}>
        {selectedId ? (
          <PaymentReview key={selectedId} paymentId={selectedId} onDecided={afterDecision} onBack={() => setParams({ id: null })} />
        ) : (
          <EmptyState
            className="h-full"
            title={items.length ? "اختر إيصالًا من القائمة" : "لا يوجد ما تراجعه الآن"}
            description={items.length ? "أو استخدم J و K للتنقل بين الإيصالات." : "عندما يرفع صاحب براند إيصالًا جديدًا سيظهر في القائمة تلقائيًا."}
          />
        )}
      </section>
    </div>
  );
}
