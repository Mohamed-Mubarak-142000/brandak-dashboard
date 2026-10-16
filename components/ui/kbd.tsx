import { cn } from "@/lib/cn";

/** Keyboard shortcut hint. Hidden on touch-sized screens where it means nothing. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "hidden md:inline-flex h-5 min-w-5 items-center justify-center rounded-[3px] border border-current/25 px-1",
        "font-sans text-[11px] leading-none opacity-75",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
