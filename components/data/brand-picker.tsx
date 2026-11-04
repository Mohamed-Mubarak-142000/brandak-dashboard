"use client";

import * as Popover from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Store, X } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminBrand } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { SearchInput } from "./search-input";

/** Store filter: a button showing the chosen store, opening a search over all stores. */
export function BrandPicker({
  value,
  onChange,
  allLabel = "كل المتاجر",
}: {
  value: string | undefined;
  onChange: (brandId: string | null) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  // Same key as the brand page, so its name is usually already cached.
  const selected = useQuery({
    queryKey: ["brand", value],
    queryFn: () => api.get<AdminBrand>(`/admin/brands/${value}`),
    enabled: !!value,
  });
  const results = useQuery({
    queryKey: ["brands", "picker", q],
    queryFn: () => api.page<AdminBrand>("/admin/brands", { q: q || undefined, limit: 8 }),
    enabled: open,
  });

  const name = value ? (selected.data?.name ?? "متجر") : allLabel;

  return (
    <div className="flex items-center gap-1">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className="flex h-11 min-w-44 max-w-64 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-ui text-ink hover:border-ink-3 focus:border-accent focus:outline-none">
          <Store aria-hidden className="size-4 shrink-0 text-ink-3" />
          <span className="flex-1 truncate text-start">{name}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-3" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            dir="rtl"
            align="start"
            sideOffset={6}
            className="z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-md border border-line bg-surface p-3 shadow-pop"
          >
            <SearchInput value={q} onChange={setQ} placeholder="ابحث باسم المتجر" label="بحث عن متجر" />
            <ul className="flex max-h-72 flex-col overflow-y-auto">
              <PickerOption
                label={allLabel}
                selected={!value}
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              />
              {results.isPending ? (
                <li className="px-3 py-2.5 text-ui text-ink-3">جارٍ التحميل…</li>
              ) : results.isError ? (
                <li className="px-3 py-2.5 text-ui text-danger">تعذّر تحميل المتاجر</li>
              ) : !results.data?.items.length ? (
                <li className="px-3 py-2.5 text-ui text-ink-3">مفيش متاجر بالاسم ده</li>
              ) : (
                results.data.items.map((b) => (
                  <PickerOption
                    key={b._id}
                    label={b.name}
                    hint={b.slug}
                    selected={value === b._id}
                    onSelect={() => {
                      onChange(b._id);
                      setOpen(false);
                    }}
                  />
                ))
              )}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="إلغاء اختيار المتجر"
          className="grid size-11 place-items-center rounded-sm text-ink-3 hover:bg-sunken hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}

function PickerOption({ label, hint, selected, onSelect }: { label: string; hint?: string; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-sm px-3 py-2 text-start text-ui hover:bg-sunken",
          selected ? "font-semibold text-accent" : "text-ink",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{label}</span>
          {hint && <span className="num truncate text-meta font-normal text-ink-3">{hint}</span>}
        </span>
        {selected && <Check aria-hidden className="size-4 shrink-0" />}
      </button>
    </li>
  );
}
