"use client";

import * as RDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  initialFocus,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Element to focus on open (defaults to the first focusable, which is the close button). */
  initialFocus?: React.RefObject<HTMLElement | null>;
  /** "lg" fits side-by-side content, e.g. a receipt next to the facts to compare. */
  size?: "md" | "lg";
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <RDialog.Content
          dir="rtl"
          onOpenAutoFocus={(e) => {
            if (initialFocus?.current) {
              e.preventDefault();
              initialFocus.current.focus();
            }
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-md border border-line bg-surface p-6 shadow-pop",
            "sm:inset-x-auto sm:bottom-auto sm:start-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:rounded-md",
            size === "lg" ? "sm:w-[min(960px,calc(100vw-2rem))]" : "sm:w-[min(520px,calc(100vw-2rem))]",
            "sm:translate-x-1/2", // RTL: start is the right edge, so shift back by half toward it
            "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RDialog.Title className="font-display text-section text-ink">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-1 text-ui text-ink-2">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close aria-label="إغلاق" className="-m-1 rounded-sm p-1 text-ink-3 hover:text-ink">
              <X className="size-5" />
            </RDialog.Close>
          </div>
          {children}
          {footer && <div className="mt-6 flex flex-wrap-reverse justify-end gap-2">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
