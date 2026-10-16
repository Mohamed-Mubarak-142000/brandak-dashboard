"use client";

import * as RCheckbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3 py-2", disabled && "opacity-60")}>
      <RCheckbox.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className={cn(
          "mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded-[3px] border-[1.5px] border-line-strong bg-surface",
          "transition-colors hover:border-accent data-[state=checked]:border-accent data-[state=checked]:bg-accent",
          "disabled:cursor-not-allowed",
        )}
      >
        <RCheckbox.Indicator>
          <Check aria-hidden strokeWidth={3} className="size-3.5 text-on-accent" />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <label htmlFor={id} className="cursor-pointer text-ui leading-relaxed text-ink">
        {children}
      </label>
    </div>
  );
}
