import { cn } from "@/lib/cn";

/** Label/value ledger used on detail pages. */
export function DetailList({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title && <h2 className="mb-1 text-ui font-semibold text-ink">{title}</h2>}
      <dl>{children}</dl>
    </section>
  );
}

export function DetailRow({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] items-center gap-3 border-b border-line py-3 last:border-b-0">
      <dt className="text-ui text-ink-2">{label}</dt>
      <dd className={cn("flex min-w-0 flex-wrap items-center gap-1 text-ink", strong ? "text-section font-semibold" : "text-body")}>
        {children}
      </dd>
    </div>
  );
}

/** Bordered panel for grouping a detail page's sections. */
export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-md border border-line bg-surface p-5 sm:p-6", className)}>{children}</div>;
}

export const Muted = ({ children }: { children: React.ReactNode }) => <span className="text-ink-3">{children}</span>;
