"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import type { AssistantConversationItem } from "@/lib/api/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { BrandPicker } from "@/components/data/brand-picker";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const PAGE_SIZE = 20;
const helper = createColumnHelper<TableFeatures, AssistantConversationItem>();
const NO_ROWS: AssistantConversationItem[] = [];

export const customerName = (c: { customerFirstName: string | null; signedIn: boolean }) =>
  c.customerFirstName || (c.signedIn ? "عميل" : "زائر");

function preview(c: AssistantConversationItem) {
  if (!c.lastMessage) return "—";
  return `${c.lastMessage.role === "assistant" ? "المساعد: " : ""}${c.lastMessage.text}`;
}

/** Chats customers had with the stores' AI assistants: spot what it couldn't answer. */
export function ConversationsPage() {
  const url = useUrlState();
  const router = useRouter();
  const brandId = url.get("brandId") ?? "";
  const unanswered = url.get("unanswered") === "true";

  const list = useQuery({
    queryKey: qk.assistantConversations(brandId, unanswered, url.page),
    queryFn: () =>
      api.page<AssistantConversationItem>("/admin/assistant/conversations", {
        brandId: brandId || undefined,
        unanswered: unanswered || undefined,
        page: url.page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor((c) => c.brand?.name ?? "", {
          id: "brand",
          header: "المتجر",
          cell: (info) => {
            const b = info.row.original.brand;
            return b?.id ? (
              <Link
                href={`/brands/${b.id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-ink underline-offset-4 hover:text-accent hover:underline"
              >
                {b.name || "متجر محذوف"}
              </Link>
            ) : (
              <span className="text-ink-3">متجر محذوف</span>
            );
          },
        }),
        helper.accessor((c) => customerName(c), {
          id: "customer",
          header: "العميل",
          cell: (info) => (
            <span className="flex flex-col">
              <span className="text-ink">{info.getValue()}</span>
              <span className="text-meta text-ink-3">{info.row.original.signedIn ? "مسجّل دخول" : "مش مسجّل"}</span>
            </span>
          ),
        }),
        helper.accessor("count", {
          header: "الرسائل",
          cell: (info) => <span className="num">{info.getValue()}</span>,
        }),
        helper.display({
          id: "last",
          header: "آخر رسالة",
          cell: (info) => (
            <span className="flex max-w-md items-center gap-2">
              <span className="line-clamp-2 text-ink-2">{preview(info.row.original)}</span>
              {info.row.original.hasUnanswered && (
                <Badge tone="warning" className="shrink-0">
                  مجاوبش
                </Badge>
              )}
            </span>
          ),
        }),
        helper.accessor("lastAt", {
          header: "آخر نشاط",
          cell: (info) => (
            <time dateTime={info.getValue()} title={formatDateTime(info.getValue())} className="text-ink-2">
              {formatRelative(info.getValue())}
            </time>
          ),
        }),
      ]),
    [],
  );

  const filtered = !!brandId || unanswered;

  return (
    <PageShell>
      <PageHeader
        title="مساعد المتاجر"
        description="محادثات العملاء مع مساعد الذكاء الاصطناعي في صفحات المتاجر. المحادثات اللي فيها «مجاوبش» معناها إن المساعد ماكانش عنده المعلومة، فالمتجر محتاج يزوّدها في إعدادات المساعد."
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <BrandPicker value={brandId || undefined} onChange={(id) => url.set({ brandId: id })} />
        <Switch checked={unanswered} onCheckedChange={(v) => url.set({ unanswered: v ? "true" : null })}>
          مجاوبش بس
        </Switch>
      </div>
      <div className="mt-4">
        <DataTable
          label="جدول محادثات المساعد"
          columns={columns}
          data={list.data?.items ?? NO_ROWS}
          getRowId={(r) => r.id}
          onRowClick={(r) => router.push(`/assistant/${r.id}`)}
          isPending={list.isPending}
          isFetching={list.isFetching && list.isPlaceholderData}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={
            filtered
              ? { title: "مفيش محادثات مطابقة", description: "جرّب متجر تاني أو اقفل «مجاوبش بس»." }
              : { title: "لسه مفيش محادثات", description: "لما عميل يكلّم مساعد أي متجر، المحادثة هتظهر هنا." }
          }
          paging={{ page: url.page, pageSize: PAGE_SIZE, total: list.data?.meta.total ?? 0, onPage: (p) => url.set({ page: p }, { resetPage: false }) }}
          mobileItem={(c) => (
            <MobileRow
              href={`/assistant/${c.id}`}
              title={`${c.brand?.name || "متجر محذوف"} — ${customerName(c)}`}
              trailing={<span className="num text-meta text-ink-3">{formatRelative(c.lastAt)}</span>}
              meta={preview(c)}
              badge={c.hasUnanswered ? <Badge tone="warning">مجاوبش</Badge> : undefined}
            />
          )}
        />
      </div>
    </PageShell>
  );
}
