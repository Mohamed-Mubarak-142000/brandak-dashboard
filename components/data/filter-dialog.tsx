"use client";

import { Check, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export interface FilterOption {
  value: string;
  label: string;
  hint?: string;
}

export interface FilterSection {
  key: string;
  label: string;
  options: FilterOption[];
  /** The value used when nothing is chosen (shown as "الكل" or the page's natural default). */
  defaultValue: string;
  counts?: Record<string, number>;
  columns?: 1 | 2;
}

type Values = Record<string, string>;

function Option({ selected, onSelect, option, count, name }: { selected: boolean; onSelect: () => void; option: FilterOption; count?: number; name: string }) {
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
        <span className={cn("text-ui text-ink", selected && "font-semibold")}>{option.label}</span>
        {option.hint && <span className="text-meta text-ink-3">{option.hint}</span>}
      </span>
      {count !== undefined && <span className="num text-ui font-semibold text-ink-2">{count}</span>}
    </label>
  );
}

/** "تصفية" button + dialog. Choices are drafted locally and applied together. */
export function FilterDialog({
  title,
  sections,
  values,
  onApply,
}: {
  title: string;
  sections: FilterSection[];
  values: Values;
  onApply: (values: Values) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Values>(values);
  const active = sections.filter((s) => (values[s.key] ?? s.defaultValue) !== s.defaultValue).length;

  return (
    <>
      <Button
        aria-haspopup="dialog"
        className="shrink-0"
        onClick={() => {
          setDraft(values);
          setOpen(true);
        }}
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        تصفية
        {active > 0 && (
          <span className="num grid size-5 place-items-center rounded-full bg-accent text-meta font-semibold text-on-accent">{active}</span>
        )}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(Object.fromEntries(sections.map((s) => [s.key, s.defaultValue])))}>
              إعادة الضبط
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              عرض النتائج
            </Button>
          </>
        }
      >
        {sections.map((section, i) => (
          <fieldset key={section.key} className={cn(i > 0 && "mt-6")}>
            <legend className="mb-2 text-ui font-semibold text-ink">{section.label}</legend>
            <div className={cn("grid gap-2", section.columns !== 1 && "sm:grid-cols-2")}>
              {section.options.map((o) => (
                <Option
                  key={o.value}
                  name={`filter-${section.key}`}
                  option={o}
                  selected={(draft[section.key] ?? section.defaultValue) === o.value}
                  onSelect={() => setDraft((d) => ({ ...d, [section.key]: o.value }))}
                  count={section.counts?.[o.value]}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </Dialog>
    </>
  );
}

/** Applied filters as chips; each non-default one can be removed in one click. */
export function FilterChips({
  sections,
  values,
  onClear,
}: {
  sections: FilterSection[];
  values: Values;
  onClear: (key: string | "all") => void;
}) {
  const chips = sections
    .map((s) => {
      const value = values[s.key] ?? s.defaultValue;
      const option = s.options.find((o) => o.value === value);
      return { key: s.key, label: `${s.label}: ${option?.label ?? value}`, removable: value !== s.defaultValue };
    })
    .filter((c) => c.removable || sections.find((s) => s.key === c.key)?.key === sections[0]?.key);
  const removable = chips.filter((c) => c.removable).length;
  if (!chips.length) return null;

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
