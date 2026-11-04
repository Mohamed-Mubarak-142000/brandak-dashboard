"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, CircleHelp, Package, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import type { AssistantConversation, AssistantMessage, AssistantProductRef } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { DetailList, DetailRow, Muted, Panel } from "@/components/data/detail-list";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { Badge } from "@/components/ui/badge";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { customerName } from "./conversations-page";

const linkButton =
  "inline-flex h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-4 text-ui text-ink transition-colors hover:bg-sunken";

/** One chat between a customer and a store's assistant, read-only (opening it doesn't mark it seen). */
export function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const convo = useQuery({
    queryKey: qk.assistantConversation(id),
    queryFn: () => api.get<AssistantConversation>(`/admin/assistant/conversations/${id}`),
  });

  if (convo.isPending) return <DetailSkeleton />;
  if (convo.isError || !convo.data) {
    return (
      <PageShell>
        <ErrorState error={convo.error} onRetry={() => convo.refetch()} />
      </PageShell>
    );
  }

  const c = convo.data;
  const unanswered = c.messages.filter((m) => m.unanswered).length;

  return (
    <PageShell>
      <PageHeader
        back={{ href: "/assistant", label: "كل المحادثات" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {customerName(c)} مع مساعد {c.brand.name || "متجر محذوف"}
            {unanswered > 0 && <Badge tone="warning">مجاوبش على {unanswered}</Badge>}
          </span>
        }
        description={<>بدأت {formatDateTime(c.createdAt)} — آخر رسالة {formatDateTime(c.lastAt)}</>}
        actions={
          c.brand.id ? (
            <>
              <Link className={linkButton} href={`/brands/${c.brand.id}`}>
                <Store aria-hidden className="size-4" />
                صفحة المتجر
              </Link>
              <Link className={linkButton} href={`/assistant?brandId=${c.brand.id}`}>
                محادثات المتجر
              </Link>
            </>
          ) : null
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel className="p-4 sm:p-6">
          <h2 className="sr-only">الرسائل</h2>
          {c.messages.length === 0 ? (
            <p className="text-ui text-ink-3">مفيش رسائل في المحادثة دي.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {c.messages.map((m, i) => (
                <Bubble key={i} message={m} />
              ))}
            </ol>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel>
            <DetailList title="عن المحادثة">
              <DetailRow label="المتجر">
                {c.brand.id ? (
                  <Link href={`/brands/${c.brand.id}`} className="text-accent underline-offset-4 hover:underline">
                    {c.brand.name || "متجر محذوف"}
                  </Link>
                ) : (
                  <Muted>متجر محذوف</Muted>
                )}
              </DetailRow>
              <DetailRow label="العميل">
                {customerName(c)} <Muted>— {c.signedIn ? "مسجّل دخول" : "زائر مش مسجّل"}</Muted>
              </DetailRow>
              <DetailRow label="عدد الرسائل">
                <span className="num">{c.count}</span>
              </DetailRow>
              <DetailRow label="اتفتحت من">
                {c.product ? <ProductChip product={c.product} /> : <Muted>صفحة المتجر</Muted>}
              </DetailRow>
            </DetailList>
          </Panel>
          {unanswered > 0 && (
            <div className="rounded-sm border border-warning/25 bg-warning-soft px-4 py-3 text-ui text-ink">
              <p className="font-semibold text-warning">المساعد ماكانش عنده المعلومة</p>
              <p className="mt-1">
                الرسائل المعلَّمة ماتجاوبتش. ممكن تضيف المعلومة الناقصة في «معلومات إضافية» في{" "}
                {c.brand.id ? (
                  <Link href={`/brands/${c.brand.id}#assistant`} className="text-accent underline-offset-4 hover:underline">
                    إعدادات مساعد المتجر
                  </Link>
                ) : (
                  "إعدادات مساعد المتجر"
                )}
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Bubble({ message: m }: { message: AssistantMessage }) {
  const mine = m.role === "assistant";
  return (
    // RTL: the customer sits on the start (right) side, the assistant on the end (left).
    <li className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      <span className="flex items-center gap-1.5 text-meta text-ink-3">
        {mine ? <Bot aria-hidden className="size-3.5" /> : null}
        {mine ? "المساعد" : "العميل"} — <time dateTime={m.at}>{formatDateTime(m.at)}</time>
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-md border px-3.5 py-2.5 text-body leading-relaxed whitespace-pre-line",
          mine ? "border-line bg-sunken text-ink" : "border-accent/20 bg-accent-soft text-ink",
          m.unanswered && "border-warning/40 bg-warning-soft",
        )}
      >
        {m.text}
        {m.products.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-2" aria-label="منتجات اقترحها المساعد">
            {m.products.map((p) => (
              <li key={p.id}>
                <ProductChip product={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {m.unanswered && (
        <Badge tone="warning">
          <CircleHelp aria-hidden className="size-3.5" />
          مجاوبش — المعلومة مش عنده
        </Badge>
      )}
    </li>
  );
}

/** The dashboard has no product page, so this shows the product and its id (for support lookups). */
function ProductChip({ product: p }: { product: AssistantProductRef }) {
  return (
    <span title={p.id} className="inline-flex max-w-60 items-center gap-2 rounded-sm border border-line bg-surface px-2 py-1 text-ui text-ink">
      {p.imageUrl ? (
        <Image src={p.imageUrl} alt="" width={28} height={28} unoptimized className="size-7 shrink-0 rounded-sm object-cover" />
      ) : (
        <Package aria-hidden className="size-4 shrink-0 text-ink-3" />
      )}
      <span className="truncate">{p.title || p.id}</span>
    </span>
  );
}

function DetailSkeleton() {
  return (
    <PageShell>
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-4 h-9 w-72" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </PageShell>
  );
}
