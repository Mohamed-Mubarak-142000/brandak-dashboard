import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header>
      {back && (
        <Link
          href={back.href}
          className="-ms-2 mb-3 inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-ui text-ink-2 hover:bg-sunken hover:text-ink"
        >
          <ArrowRight aria-hidden className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-page text-ink">{title}</h1>
          {description && <p className="mt-1 text-ui text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** The page frame every desk page shares: same max width and gutters. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">{children}</div>;
}
