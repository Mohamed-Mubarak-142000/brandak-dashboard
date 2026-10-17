"use client";

import { Check, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import type { PaymentStatus } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** DELETED is a view, not a status: soft-deleted payments of any status. */
export type Filter = PaymentStatus | "ALL" | "DELETED";
export type Sort = "oldest" | "newest";

export const FILTERS: { value: Filter; label: string; hint: string }[] = [
  { value: "PENDING_REVIEW", label: "قيد المراجعة", hint: "إيصالات تنتظر قرارك" },
  { value: "AWAITING_PROOF", label: "بانتظار الإيصال", hint: "طلبات اشتراك لم يُرفع لها إيصال" },
  { value: "REJECTED", label: "مرفوضة", hint: "تنتظر إيصالًا جديدًا من صاحب البراند" },
  { value: "APPROVED", label: "معتمدة", hint: "اشتراكات تم تفعيلها" },
  { value: "CANCELLED", label: "ملغاة", hint: "استُبدلت بطلب باقة أخرى قبل الدفع" },
  { value: "ALL", label: "الكل", hint: "كل المدفوعات بكل حالاتها" },
  { value: "DELETED", label: "المحذوفة", hint: "المحذوف مؤقتًا ويمكن استرجاعه" },
];

export const DEFAULT_STATUS: Filter = "PENDING_REVIEW";
/** The review queue is first come, first served; every other view reads newest first. */
export const defaultSort = (status: Filter): Sort => (status === "PENDING_REVIEW" ? "oldest" : "newest");

const SORTS: { value: Sort; label: string }[] = [
  { value: "oldest", label: "الأقدم أولًا" },
  { value: "newest", label: "الأحدث أولًا" },
];

function Option({
  selected,
  onSelect,
  label,
  hint,
  count,
  name,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  hint?: string;
  count?: number;
  name: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border px-3 py-2.5 transition-colors",
        selected ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong hover:bg-sunken",
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border-[1.5px]",
          selected ? "border-accent bg-accent text-on-accent" : "border-line-strong",
        )}
      >
        {selected && <Check strokeWidth={3} className="size-3" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-ui text-ink", selected && "font-semibold")}>{label}</span>
        {hint && <span className="text-meta text-ink-3">{hint}</span>}
      </span>
      {count !== undefined && <span className="num text-ui font-semibold text-ink-2">{count}</span>}
    </label>
  );
}

export function PaymentFilters({
  status,
  sort,
  counts,
  onApply,
}: {
  status: Filter;
  sort: Sort;
  counts?: Record<Filter, number>;
  onApply: (next: { status: Filter; sort: Sort }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftSort, setDraftSort] = useState(sort);

  const activeCount = Number(status !== DEFAULT_STATUS) + Number(sort !== defaultSort(status));

  const openDialog = () => {
    // Start from what's applied, so cancelling never leaves half-edited choices behind.
    setDraftStatus(status);
    setDraftSort(sort);
    setOpen(true);
  };

  return (
    <>
      <Button onClick={openDialog} aria-haspopup="dialog" className="shrink-0">
        <SlidersHorizontal aria-hidden className="size-4" />
        تصفية
        {activeCount > 0 && (
          <span className="num grid size-5 place-items-center rounded-full bg-accent text-meta font-semibold text-on-accent">
            {activeCount}
          </span>
        )}
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="تصفية المدفوعات"
        description="اختر الحالة وترتيب العرض."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDraftStatus(DEFAULT_STATUS);
                setDraftSort(defaultSort(DEFAULT_STATUS));
              }}
            >
              إعادة الضبط
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onApply({ status: draftStatus, sort: draftSort });
                setOpen(false);
              }}
            >
              عرض النتائج
              {counts && (
                <span className="num rounded-full bg-on-accent/20 px-1.5 text-meta">{counts[draftStatus]}</span>
              )}
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="mb-2 text-ui font-semibold text-ink">الحالة</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FILTERS.map((f) => (
              <Option
                key={f.value}
                name="payment-status"
                selected={draftStatus === f.value}
                onSelect={() => {
                  // Picking a status also picks its natural order, unless the admin changes it after.
                  setDraftStatus(f.value);
                  setDraftSort(defaultSort(f.value));
                }}
                label={f.label}
                hint={f.hint}
                count={counts?.[f.value]}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="mb-2 text-ui font-semibold text-ink">الترتيب</legend>
          <div className="grid grid-cols-2 gap-2">
            {SORTS.map((s) => (
              <Option
                key={s.value}
                name="payment-sort"
                selected={draftSort === s.value}
                onSelect={() => setDraftSort(s.value)}
                label={s.label}
              />
            ))}
          </div>
        </fieldset>
      </Dialog>

    </>
  );
}

export function ActiveFilterChips({
  status,
  sort,
  onClear,
}: {
  status: Filter;
  sort: Sort;
  onClear: (what: "status" | "sort" | "all") => void;
}) {
  // The status chip always shows, so it's clear what the table holds; it's removable only when not the default.
  const chips: { key: "status" | "sort"; label: string; removable: boolean }[] = [
    { key: "status", label: `الحالة: ${FILTERS.find((f) => f.value === status)!.label}`, removable: status !== DEFAULT_STATUS },
  ];
  if (sort !== defaultSort(status)) {
    chips.push({ key: "sort", label: `الترتيب: ${SORTS.find((s) => s.value === sort)!.label}`, removable: true });
  }
  const removable = chips.filter((c) => c.removable).length;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span
          key={c.key}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-sm border border-line-strong bg-surface text-ui text-ink",
            c.removable ? "ps-3 pe-1" : "px-3",
          )}
        >
          {c.label}
          {c.removable && (
            <button
              type="button"
              onClick={() => onClear(c.key)}
              aria-label={`إزالة ${c.label}`}
              className="grid size-6 place-items-center rounded-sm text-ink-3 hover:bg-sunken hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          )}
        </span>
      ))}
      {removable > 1 && (
        <button type="button" onClick={() => onClear("all")} className="h-8 px-2 text-ui text-accent underline-offset-4 hover:underline">
          مسح الكل
        </button>
      )}
    </div>
  );
}
