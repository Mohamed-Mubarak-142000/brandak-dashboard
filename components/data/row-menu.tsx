"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

export interface RowMenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Draw a divider above this item. */
  separated?: boolean;
  hidden?: boolean;
}

/** The "⋯" actions menu used on every table row. */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const visible = items.filter((i) => !i.hidden);
  const base =
    "flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-sm px-3 text-ui outline-none data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-3";
  return (
    <Menu.Root dir="rtl">
      <Menu.Trigger
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="grid size-9 shrink-0 place-items-center rounded-sm text-ink-2 hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken"
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
          {visible.map((item) => (
            <div key={item.label}>
              {item.separated && <Menu.Separator className="my-1 h-px bg-line" />}
              <Menu.Item
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  base,
                  item.danger ? "text-danger data-[highlighted]:bg-danger-soft" : "text-ink data-[highlighted]:bg-sunken",
                )}
              >
                {item.icon && <item.icon aria-hidden className="size-4" />}
                {item.label}
              </Menu.Item>
            </div>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
