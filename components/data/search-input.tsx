"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Search box that reports its value after the admin pauses typing (server-side search). */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow the URL when it changes from elsewhere (e.g. "clear all"): adjust state during render.
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <label className="relative min-w-0 flex-1 sm:max-w-sm">
      <span className="sr-only">{label}</span>
      <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => onChange(next.trim()), 350);
        }}
        placeholder={placeholder}
        className="h-11 w-full rounded-sm border border-line-strong bg-surface ps-9 pe-3 text-ui text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-accent focus:outline-none"
      />
    </label>
  );
}
