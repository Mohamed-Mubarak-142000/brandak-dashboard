"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A list of short values typed one by one: Enter (or a comma) adds, × removes, Backspace on an
 * empty box removes the last. Duplicates are ignored.
 */
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  invalid,
  describedBy,
}: {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** Per value. */
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const next = raw
      .split(/[,،]/)
      .map((v) => v.trim())
      .filter((v) => v && !value.includes(v));
    if (next.length) onChange([...value, ...new Set(next)]);
    setText("");
  };

  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-2 py-1.5 focus-within:border-accent",
        invalid && "border-danger",
      )}
    >
      {value.map((v) => (
        <span key={v} className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-sunken ps-2.5 pe-1 text-meta text-ink">
          {v}
          <button type="button" aria-label={`شيل ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="grid size-5 place-items-center rounded-full text-ink-3 hover:bg-line hover:text-ink">
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => (/[,،]/.test(e.target.value) ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => text.trim() && add(text)}
        placeholder={value.length ? undefined : placeholder}
        className="h-8 min-w-24 flex-1 bg-transparent px-1 text-ui text-ink placeholder:text-ink-3 focus:outline-none"
      />
    </div>
  );
}
