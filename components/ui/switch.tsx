"use client";

import { cn } from "@/lib/cn";

/** On/off toggle. Pass `children` for a visible label, or `label` when the context already says it. */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  children,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name when there is no visible label. */
  label?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2.5 text-ui text-ink", disabled && "cursor-not-allowed opacity-60", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={children ? undefined : label}
        disabled={disabled}
        onClick={(e) => {
          // Rows open the edit dialog on click; the switch is its own action.
          e.stopPropagation();
          onCheckedChange(!checked);
        }}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          checked ? "border-accent bg-accent" : "border-line-strong bg-sunken",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-surface shadow-sm transition-[inset-inline-start]",
            checked ? "start-[calc(100%-1.125rem)]" : "start-0.5",
          )}
        />
      </button>
      {children}
    </label>
  );
}
