"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import type { OrderDetail as Order } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { DetailList, DetailRow, Muted, Panel } from "@/components/data/detail-list";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { Badge, ORDER_STATUS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { adminCanCancel, useCancelOrder } from "./orders-page";

const ACTOR: Record<string, string> = { CUSTOMER: "العميل", BRAND: "البراند", ADMIN: "الإدارة", SYSTEM: "النظام" };
const FLOW = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

/** The order's path: done steps filled with brand orange, the current one ringed. */
function StatusTimeline({ order }: { order: Order }) {
  const at = (s: string) => order.history.find((h) => h.status === s);
  const cancelled = order.status === "CANCELLED";
  const reached = cancelled ? order.history.filter((h) => h.status !== "CANCELLED").length - 1 : FLOW.indexOf(order.status as (typeof FLOW)[number]);

  return (
    <ol className="flex flex-col gap-0">
      {FLOW.map((s, i) => {
        const entry = at(s);
        const done = i <= reached;
        const current = i === reached && !cancelled;
        return (
          <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
            {i < FLOW.length - 1 && (
              <span aria-hidden className={cn("absolute start-[9px] top-5 h-[calc(100%-12px)] w-0.5", i < reached ? "bg-brand" : "bg-line")} />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 size-5 shrink-0 rounded-full border-2",
                done ? "border-brand bg-brand" : "border-line-strong bg-surface",
                current && "ring-4 ring-accent-soft",
              )}
            />
            <div className="min-w-0">
              <p className={cn("text-ui", done ? "font-semibold text-ink" : "text-ink-3")}>{ORDER_STATUS[s].label}</p>
              {entry && (
                <p className="text-meta text-ink-3">
                  {formatDateTime(entry.at)} — {ACTOR[entry.actor]}
                  {entry.note && `: ${entry.note}`}
                </p>
              )}
            </div>
          </li>
        );
      })}
      {cancelled && (
        <li className="mt-4 rounded-sm border border-danger/30 bg-danger-soft px-3 py-2.5 text-ui">
          <p className="font-semibold text-danger">أُلغي الطلب</p>
          {order.cancelReason && <p className="mt-0.5 text-ink">{order.cancelReason}</p>}
          {at("CANCELLED") && (
            <p className="mt-0.5 text-meta text-ink-2">
              {formatDateTime(at("CANCELLED")!.at)} — {ACTOR[at("CANCELLED")!.actor]}
            </p>
          )}
        </li>
      )}
    </ol>
  );
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const order = useQuery({ queryKey: ["order", id], queryFn: () => api.get<Order>(`/admin/orders/${id}`) });
  const cancel = useCancelOrder();

  if (order.isPending) {
    return (
      <PageShell>
        <Skeleton className="h-9 w-64" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </PageShell>
    );
  }
  if (order.isError || !order.data) {
    return (
      <PageShell>
        <ErrorState error={order.error} onRetry={() => order.refetch()} />
      </PageShell>
    );
  }

  const o = order.data;
  const a = o.address;
  const s = ORDER_STATUS[o.status];
  const addressLine = [a.street, a.building && `عمارة ${a.building}`, a.floor && `دور ${a.floor}`, a.apartment && `شقة ${a.apartment}`, a.area, a.city, a.governorateName]
    .filter(Boolean)
    .join("، ");

  return (
    <PageShell>
      <PageHeader
        back={{ href: "/orders", label: "كل الطلبات" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{o.orderNumber}</span>
            <Badge tone={s.tone}>{s.label}</Badge>
          </span>
        }
        description={<>من {o.brand.name}، بتاريخ {formatDateTime(o.createdAt)}</>}
        actions={
          adminCanCancel(o.status) && (
            <Button variant="danger" onClick={() => cancel.ask(o)}>
              إلغاء الطلب
            </Button>
          )
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel>
            <h2 className="mb-3 text-ui font-semibold text-ink">
              المنتجات <span className="num text-ink-3">({o.itemsCount})</span>
            </h2>
            <ul className="divide-y divide-line">
              {o.items.map((item) => (
                <li key={item.variantId} className="flex items-center gap-3 py-3">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt="" width={56} height={56} unoptimized className="size-14 shrink-0 rounded-sm border border-line object-cover" />
                  ) : (
                    <span aria-hidden className="size-14 shrink-0 rounded-sm bg-sunken" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui font-medium text-ink">{item.title}</span>
                    <span className="block text-meta text-ink-3">
                      {[item.size && `المقاس ${item.size}`, item.color && `اللون ${item.color}`].filter(Boolean).join("، ") || "—"}
                    </span>
                  </span>
                  <span className="text-end text-ui">
                    <span className="num block text-ink-2">
                      {item.quantity} × {formatMoney(item.unitPrice)}
                    </span>
                    <span className="num block font-semibold text-ink">{formatMoney(item.lineTotal)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 border-t border-line pt-3 text-ui">
              <div className="flex justify-between py-1">
                <dt className="text-ink-2">المنتجات</dt>
                <dd className="num">{formatMoney(o.subtotal)}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-ink-2">الشحن</dt>
                <dd className="num">{o.shippingFee ? formatMoney(o.shippingFee) : "مجاني"}</dd>
              </div>
              <div className="mt-1 flex justify-between border-t border-line pt-2 text-body font-semibold">
                <dt>الإجمالي</dt>
                <dd className="num">{formatMoney(o.grandTotal)}</dd>
              </div>
              <p className="mt-1 text-meta text-ink-3">{o.paymentStatus === "PAID" ? "تم التحصيل عند الاستلام" : "الدفع عند الاستلام"}</p>
            </dl>
          </Panel>

          {o.notes && (
            <Panel>
              <h2 className="mb-1 text-ui font-semibold text-ink">ملاحظات العميل</h2>
              <p className="text-ui text-ink-2">{o.notes}</p>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Panel>
            <h2 className="mb-4 text-ui font-semibold text-ink">مسار الطلب</h2>
            <StatusTimeline order={o} />
          </Panel>

          <Panel>
            <DetailList title="العميل والتوصيل">
              <DetailRow label="المستلم">{a.recipientName}</DetailRow>
              <DetailRow label="الهاتف">
                <span className="num">{formatPhone(a.phone)}</span>
              </DetailRow>
              <DetailRow label="العنوان">{addressLine}</DetailRow>
              {a.landmark && <DetailRow label="علامة مميزة">{a.landmark}</DetailRow>}
              <DetailRow label="الموقع">
                {a.location ? (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${a.location.lat}&mlon=${a.location.lng}#map=17/${a.location.lat}/${a.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-ui text-accent underline-offset-4 hover:underline"
                  >
                    <MapPin aria-hidden className="size-4" />
                    فتح على الخريطة
                  </a>
                ) : (
                  <Muted>لم يحدد العميل موقعًا</Muted>
                )}
              </DetailRow>
            </DetailList>
          </Panel>

          <Panel>
            <DetailList title="البراند">
              <DetailRow label="الاسم">
                <Link href={`/brands/${o.brand.id}`} className="text-accent underline-offset-4 hover:underline">
                  {o.brand.name}
                </Link>
              </DetailRow>
              <DetailRow label="هاتف البراند">
                <span className="num">{formatPhone(o.brand.phone)}</span>
              </DetailRow>
            </DetailList>
          </Panel>
        </div>
      </div>
      {cancel.dialog}
    </PageShell>
  );
}
