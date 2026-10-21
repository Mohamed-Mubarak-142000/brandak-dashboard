"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import type { AuditEntry } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import {
  DataTable,
  MobileRow,
  type TableFeatures,
} from "@/components/data/data-table";
import {
  FilterChips,
  FilterDialog,
  type FilterSection,
} from "@/components/data/filter-dialog";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  actorName,
  AUDIT_ACTIONS,
  auditNote,
  ENTITY_LABEL,
} from "./activity-list";

const PAGE_SIZE = 30;
const helper = createColumnHelper<TableFeatures, AuditEntry>();
const EMPTY: AuditEntry[] = [];

const ENTITY_OPTIONS = [
  { value: "ALL", label: "كل العناصر" },
  ...[
    "Brand",
    "Settlement",
    "Payment",
    "Order",
    "Report",
    "Review",
    "Product",
    "User",
    "PlatformSettings",
    "Coupon",
    "Campaign",
    "SupportTicket",
    "ReturnRequest",
    "Ad",
    "ResellerPayout",
    "Reseller",
    "SubscriptionPlan",
  ].map((v) => ({ value: v, label: ENTITY_LABEL[v] })),
];

/** Pages that exist for an entity, so the log can link straight to it. */
const ENTITY_HREF: Record<string, (id: string) => string> = {
  Brand: (id) => `/brands/${id}`,
  Payment: (id) => `/payments/${id}`,
  Order: (id) => `/orders/${id}`,
  Coupon: () => "/promotions",
  Campaign: () => "/promotions?tab=campaigns",
  SupportTicket: (id) => `/support/${id}`,
  ReturnRequest: () => "/returns",
  Ad: () => "/ads",
  ResellerPayout: () => "/resellers",
};

export function AuditPage() {
  const url = useUrlState();
  const entity = url.get("entity") ?? "ALL";
  const entityId = url.get("id");

  const list = useQuery({
    queryKey: ["audit", entity, entityId, url.page],
    queryFn: () =>
      api.page<AuditEntry>("/admin/audit-logs", {
        entityType: entity === "ALL" ? undefined : entity,
        entityId,
        page: url.page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const sections: FilterSection[] = [
    {
      key: "entity",
      label: "نوع العنصر",
      options: ENTITY_OPTIONS,
      defaultValue: "ALL",
    },
  ];

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("createdAt", {
          header: "الوقت",
          cell: (info) => (
            <time dateTime={info.getValue()} className="text-ink-2">
              {formatDateTime(info.getValue())}
            </time>
          ),
        }),
        helper.display({
          id: "actor",
          header: "المنفّذ",
          cell: (info) => (
            <span className="flex items-center gap-2">
              {actorName(info.row.original)}
              {info.row.original.actorType === "ADMIN" && (
                <Badge tone="accent">إدارة</Badge>
              )}
            </span>
          ),
        }),
        helper.accessor("action", {
          header: "الإجراء",
          cell: (info) => AUDIT_ACTIONS[info.getValue()] ?? info.getValue(),
        }),
        helper.display({
          id: "entity",
          header: "العنصر",
          cell: (info) => {
            const e = info.row.original;
            const href = ENTITY_HREF[e.entityType]?.(e.entityId);
            // Arabic label and the Latin id are kept in separate runs so they don't reorder each other.
            const body = (
              <>
                {ENTITY_LABEL[e.entityType] ?? e.entityType}{" "}
                <span className="num text-meta">#{e.entityId.slice(-6)}</span>
              </>
            );
            return href ? (
              <Link
                href={href}
                className="text-accent underline-offset-4 hover:underline"
              >
                {body}
              </Link>
            ) : (
              <span className="text-ink-2">{body}</span>
            );
          },
        }),
        helper.display({
          id: "note",
          header: "التفاصيل",
          cell: (info) => (
            <span className="line-clamp-1 max-w-[20rem] whitespace-normal text-ink-2">
              {auditNote(info.row.original) ?? "—"}
            </span>
          ),
        }),
      ]),
    [],
  );

  return (
    <PageShell>
      <PageHeader
        title="سجل العمليات"
        description="كل قرار إداري وكل عملية حساسة مسجّلة هنا ولا يمكن تعديلها."
        actions={
          entityId && (
            <Button size="sm" onClick={() => url.set({ id: null })}>
              عرض كل السجل
            </Button>
          )
        }
      />
      <div className="mt-6 flex items-center gap-2">
        <FilterDialog
          title="تصفية السجل"
          sections={sections}
          values={{ entity }}
          onApply={(v) =>
            url.set({ entity: v.entity === "ALL" ? null : v.entity, id: null })
          }
        />
        {entityId && (
          <span className="text-ui text-ink-2">معروض: عنصر واحد فقط</span>
        )}
      </div>
      <FilterChips
        sections={sections}
        values={{ entity }}
        onClear={() => url.set({ entity: null, id: null })}
      />
      <div className="mt-4">
        <DataTable
          label="سجل العمليات"
          columns={columns}
          data={list.data?.items ?? EMPTY}
          getRowId={(e) => e._id}
          isPending={list.isPending}
          isFetching={list.isFetching && list.isPlaceholderData}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={{
            title: "لا توجد عمليات مسجّلة",
            description: "ستظهر هنا القرارات والعمليات الحساسة فور حدوثها.",
          }}
          paging={{
            page: url.page,
            pageSize: PAGE_SIZE,
            total: list.data?.meta.total ?? 0,
            onPage: (p) => url.set({ page: p }, { resetPage: false }),
          }}
          mobileItem={(e) => (
            <MobileRow
              href={ENTITY_HREF[e.entityType]?.(e.entityId)}
              title={`${actorName(e)} ${AUDIT_ACTIONS[e.action] ?? e.action}`}
              meta={formatDateTime(e.createdAt)}
            />
          )}
        />
      </div>
    </PageShell>
  );
}
