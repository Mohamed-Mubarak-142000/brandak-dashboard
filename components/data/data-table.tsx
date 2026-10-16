"use client";

import { tableFeatures, useTable, type ColumnDef, type RowData } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";

export const tableFeatureSet = tableFeatures({});
export type TableFeatures = typeof tableFeatureSet;

export interface Paging {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

/**
 * Shared list frame for every desk page: TanStack Table (v9) on desktop, a compact list on
 * phones, and the same loading / empty / error / paging states everywhere.
 */
export function DataTable<T extends RowData>({
  label,
  columns,
  data,
  getRowId,
  onRowClick,
  mobileItem,
  isPending,
  isFetching,
  error,
  onRetry,
  empty,
  paging,
}: {
  label: string;
  // Each column has its own value type, so the list is heterogeneous by design.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TableFeatures, T, any>[];
  data: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  mobileItem: (row: T) => React.ReactNode;
  isPending: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty: { title: string; description?: string; action?: React.ReactNode };
  paging?: Paging;
}) {
  const table = useTable({ features: tableFeatureSet, columns, data, getRowId });
  const pageCount = paging ? Math.max(1, Math.ceil(paging.total / paging.pageSize)) : 1;
  const from = paging && paging.total ? (paging.page - 1) * paging.pageSize + 1 : 0;
  const to = paging ? Math.min(paging.page * paging.pageSize, paging.total) : 0;

  return (
    <section aria-label={label} aria-busy={isFetching} className="overflow-hidden rounded-md border border-line bg-surface">
      {isPending ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : data.length === 0 ? (
        <EmptyState icon={<Inbox className="size-8" />} {...empty} />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-ui">
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id} className="border-b border-line bg-sunken">
                    {group.headers.map((header) => (
                      <th key={header.id} scope="col" className="h-11 px-4 text-start text-meta font-semibold whitespace-nowrap text-ink-2">
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className={cn(isFetching && "opacity-70 transition-opacity")}>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn(
                      "border-b border-line transition-colors last:border-b-0",
                      onRowClick && "cursor-pointer hover:bg-sunken/70",
                    )}
                  >
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id} className="h-14 px-4 align-middle whitespace-nowrap">
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-line md:hidden">
            {table.getRowModel().rows.map((row) => (
              <li key={row.id}>{mobileItem(row.original)}</li>
            ))}
          </ul>
        </>
      )}

      {paging && paging.total > 0 && !error && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-ui text-ink-2">
          <span>
            عرض <span className="num">{from}</span>–<span className="num">{to}</span> من <span className="num">{paging.total}</span>
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={paging.page <= 1} onClick={() => paging.onPage(paging.page - 1)}>
                <ChevronRight aria-hidden className="size-4" />
                السابق
              </Button>
              <span className="text-meta">
                صفحة <span className="num">{paging.page}</span> من <span className="num">{pageCount}</span>
              </span>
              <Button size="sm" disabled={paging.page >= pageCount} onClick={() => paging.onPage(paging.page + 1)}>
                التالي
                <ChevronLeft aria-hidden className="size-4" />
              </Button>
            </div>
          )}
        </footer>
      )}
    </section>
  );
}

function TableSkeleton() {
  return (
    <div aria-label="جارٍ التحميل">
      <div className="h-11 border-b border-line bg-sunken" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-6 border-b border-line px-4 last:border-b-0">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="hidden h-4 w-28 md:block" />
          <Skeleton className="hidden h-6 w-24 rounded-full md:block" />
          <Skeleton className="ms-auto h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Standard mobile row: title + trailing value, meta line + badge, optional trailing actions. */
export function MobileRow({
  href,
  title,
  trailing,
  meta,
  badge,
  actions,
}: {
  href?: string;
  title: React.ReactNode;
  trailing?: React.ReactNode;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const body = (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate text-body font-medium text-ink">{title}</span>
        {trailing && <span className="shrink-0 font-semibold text-ink">{trailing}</span>}
      </span>
      {(meta || badge) && (
        <span className="flex items-center justify-between gap-2 text-meta text-ink-3">
          <span className="truncate">{meta}</span>
          {badge}
        </span>
      )}
    </span>
  );
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1">
          {body}
        </Link>
      ) : (
        body
      )}
      {actions}
    </div>
  );
}
