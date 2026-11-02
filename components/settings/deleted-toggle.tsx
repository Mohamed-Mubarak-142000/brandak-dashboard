"use client";

import { cn } from "@/lib/cn";

/** "الحالية / المحذوفة" switch for the unpaginated settings tables. */
export function DeletedToggle({ value, onChange, deletedCount }: { value: boolean; onChange: (v: boolean) => void; deletedCount: number }) {
  return (
    <div role="tablist" aria-label="عرض" className="inline-flex rounded-sm border border-line bg-sunken p-1 text-ui">
      {[
        { v: false, label: "الحالية" },
        { v: true, label: `المحذوفة (${deletedCount})` },
      ].map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="tab"
          aria-selected={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn("h-8 rounded-sm px-3", value === o.v ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-3")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
