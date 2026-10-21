"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import type { OrderDetail as Order } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import {
  DetailList,
  DetailRow,
  Muted,
  Panel,
} from "@/components/data/detail-list";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { Badge, ORDER_STATUS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { formatRate } from "@/components/commissions/commission-status";
import { adminCanCancel, useCancelOrder } from "./orders-page";

const ACTOR: Record<string, string> = {
  CUSTOMER: "العميل",
  BRAND: "البراند",
  ADMIN: "الإدارة",
  SYSTEM: "النظام",
};
const FLOW = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
] as const;

/** The order's path: done steps filled with brand orange, the current one ringed. */
function StatusTimeline({ order }: { order: Order }) {
  const at = (s: string) => order.history.find((h) => h.status === s);
  const cancelled = order.status === "CANCELLED";
  const refused = order.status === "REFUSED";
  const ended = cancelled || refused;
  const awaiting = order.status === "AWAITING_CONFIRMATION";
  // For an order that ended early, the furthest step it reached in its history.
  const reached = ended
    ? Math.max(
        -1,
        ...order.history.map((h) =>
          FLOW.indexOf(h.status as (typeof FLOW)[number]),
        ),
      )
    : FLOW.indexOf(order.status as (typeof FLOW)[number]);
  const endEntry = at(order.status);

  return (
    <ol className="flex flex-col gap-0">
      {awaiting && (
        <li className="mb-4 rounded-sm border border-line bg-sunken px-3 py-2.5 text-ui">
          <p className="font-semibold text-ink">
            {ORDER_STATUS.AWAITING_CONFIRMATION.label}
          </p>
          <p className="mt-0.5 text-ink-2">
            العميل لازم يأكد الطلب بالكود اللي وصله على الإيميل. المتجر مش شايف
            الطلب لحد ما يتأكد، وبيتلغي تلقائيًا لو متأكدش خلال 24 ساعة.
          </p>
        </li>
      )}
      {FLOW.map((s, i) => {
        const entry = at(s);
        const done = i <= reached;
        const current = i === reached && !ended;
        return (
          <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
            {i < FLOW.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute start-[9px] top-5 h-[calc(100%-12px)] w-0.5",
                  i < reached ? "bg-brand" : "bg-line",
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 size-5 shrink-0 rounded-full border-2",
                done
                  ? "border-brand bg-brand"
                  : "border-line-strong bg-surface",
                current && "ring-4 ring-accent-soft",
              )}
            />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-ui",
                  done ? "font-semibold text-ink" : "text-ink-3",
                )}
              >
                {ORDER_STATUS[s].label}
              </p>
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
      {ended && (
        <li className="mt-4 rounded-sm border border-danger/30 bg-danger-soft px-3 py-2.5 text-ui">
          <p className="font-semibold text-danger">
            {refused ? "العميل رفض الاستلام" : "أُلغي الطلب"}
          </p>
          {refused && (
            <p className="mt-0.5 text-ink">
              الشحنة رجعت للمتجر، والكميات رجعت للمخزون. مفيش عمولة على الطلب
              ده.
            </p>
          )}
          {cancelled && order.cancelReason && (
            <p className="mt-0.5 text-ink">{order.cancelReason}</p>
          )}
          {endEntry && (
            <p className="mt-0.5 text-meta text-ink-2">
              {formatDateTime(endEntry.at)} — {ACTOR[endEntry.actor]}
              {refused && endEntry.note && `: ${endEntry.note}`}
            </p>
          )}
        </li>
      )}
    </ol>
  );
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const order = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.get<Order>(`/admin/orders/${id}`),
  });
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
  const addressLine = a
    ? [
        a.street,
        a.building && `عمارة ${a.building}`,
        a.floor && `دور ${a.floor}`,
        a.apartment && `شقة ${a.apartment}`,
        a.area,
        a.city,
        a.governorateName,
      ]
        .filter(Boolean)
        .join("، ")
    : "";

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
        description={
          <>
            من {o.brand.name}، بتاريخ {formatDateTime(o.createdAt)}
          </>
        }
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
                <li
                  key={item.variantId}
                  className="flex items-center gap-3 py-3"
                >
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={56}
                      height={56}
                      unoptimized
                      className="size-14 shrink-0 rounded-sm border border-line object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="size-14 shrink-0 rounded-sm bg-sunken"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui font-medium text-ink">
                      {item.title}
                    </span>
                    <span className="block text-meta text-ink-3">
                      {[
                        item.size && `المقاس ${item.size}`,
                        item.color && `اللون ${item.color}`,
                      ]
                        .filter(Boolean)
                        .join("، ") || "—"}
                    </span>
                  </span>
                  <span className="text-end text-ui">
                    <span className="num block text-ink-2">
                      {item.quantity} × {formatMoney(item.unitPrice)}
                    </span>
                    <span className="num block font-semibold text-ink">
                      {formatMoney(item.lineTotal)}
                    </span>
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
                <dd className="num">
                  {o.shippingFee ? formatMoney(o.shippingFee) : "مجاني"}
                </dd>
              </div>
              {o.coupon ? (
                <div className="flex items-start justify-between gap-3 py-1">
                  <dt className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-2">
                    <span>
                      كوبون{" "}
                      <span dir="ltr" className="num font-semibold text-ink">
                        {o.coupon.code}
                      </span>
                    </span>
                    {o.coupon.fundedBy === "PLATFORM" ? (
                      <Badge tone="accent">على حساب فاترينة</Badge>
                    ) : (
                      <Badge>على حساب المتجر</Badge>
                    )}
                  </dt>
                  <dd dir="ltr" className="num text-success">
                    −{formatMoney(o.coupon.discount)}
                  </dd>
                </div>
              ) : null}
              {o.discountTotal > (o.coupon?.discount ?? 0) && (
                <div className="flex justify-between py-1">
                  <dt className="text-ink-2">
                    {o.coupon ? "خصم تاني" : "الخصم"}
                  </dt>
                  <dd dir="ltr" className="num text-success">
                    −{formatMoney(o.discountTotal - (o.coupon?.discount ?? 0))}
                  </dd>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-line pt-2 text-body font-semibold">
                <dt>الإجمالي</dt>
                <dd className="num">{formatMoney(o.grandTotal)}</dd>
              </div>
              <p className="mt-1 text-meta text-ink-3">
                {o.paymentStatus === "PAID"
                  ? "تم التحصيل عند الاستلام"
                  : "الدفع عند الاستلام"}
              </p>
              {o.coupon?.fundedBy === "PLATFORM" && (
                <p className="mt-1 text-meta text-ink-3">
                  خصم الكوبون بتدفعه فاترينة: بيتسجل للمتجر كتسوية لصالحه في{" "}
                  <Link
                    href={`/commissions/${o.brand.id}`}
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    سجل العمولة
                  </Link>{" "}
                  أول ما الطلب يتسلّم.
                </p>
              )}
              {o.commission && (
                <div className="mt-3 flex justify-between border-t border-dashed border-line pt-2">
                  <dt className="text-ink-2">
                    عمولة فاترينة{" "}
                    <span className="text-meta text-ink-3">
                      (
                      <span className="num">
                        {formatRate(o.commission.rate)}
                      </span>{" "}
                      من{" "}
                      <span className="num">
                        {formatMoney(o.commission.base)}
                      </span>
                      )
                    </span>
                  </dt>
                  <dd>
                    <Link
                      href={`/commissions/${o.brand.id}`}
                      className="num font-semibold text-accent underline-offset-4 hover:underline"
                    >
                      {formatMoney(o.commission.amount)}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </Panel>

          {o.notes && (
            <Panel>
              <h2 className="mb-1 text-ui font-semibold text-ink">
                ملاحظات العميل
              </h2>
              <p className="text-ui text-ink-2">{o.notes}</p>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Panel>
            <h2 className="mb-4 text-ui font-semibold text-ink">مسار الطلب</h2>
            <StatusTimeline order={o} />
          </Panel>

          {o.shipment && (
            <Panel>
              <DetailList title="الشحنة">
                <DetailRow label="شركة الشحن">
                  {o.shipment.carrier || <Muted>—</Muted>}
                </DetailRow>
                <DetailRow label="رقم التتبع">
                  {o.shipment.trackingNumber ? (
                    <span dir="ltr" className="num select-all">
                      {o.shipment.trackingNumber}
                    </span>
                  ) : (
                    <Muted>—</Muted>
                  )}
                </DetailRow>
                <DetailRow label="تاريخ الشحن">
                  {formatDateTime(o.shipment.shippedAt)}
                </DetailRow>
                {o.shipment.trackingUrl &&
                  /^https?:\/\//i.test(o.shipment.trackingUrl) && (
                    <DetailRow label="التتبع">
                      <a
                        href={o.shipment.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-ui text-accent underline-offset-4 hover:underline"
                      >
                        <Truck aria-hidden className="size-4" />
                        تتبّع الشحنة على موقع الشركة
                      </a>
                    </DetailRow>
                  )}
              </DetailList>
            </Panel>
          )}

          {!a ? (
            <Panel>
              <DetailList title="العميل والاستلام">
                <DetailRow label="طريقة الاستلام">
                  من المتجر (من غير شحن)
                </DetailRow>
                {o.customer && (
                  <DetailRow label="العميل">{o.customer.name}</DetailRow>
                )}
                {o.customer && (
                  <DetailRow label="الهاتف">
                    <span className="num">{formatPhone(o.customer.phone)}</span>
                  </DetailRow>
                )}
                <DetailRow label="عنوان الاستلام">
                  {o.pickup?.address || <Muted>—</Muted>}
                </DetailRow>
                {o.pickup?.hours && (
                  <DetailRow label="المواعيد">{o.pickup.hours}</DetailRow>
                )}
              </DetailList>
            </Panel>
          ) : (
            <Panel>
              <DetailList title="العميل والتوصيل">
                <DetailRow label="المستلم">{a.recipientName}</DetailRow>
                <DetailRow label="الهاتف">
                  <span className="num">{formatPhone(a.phone)}</span>
                </DetailRow>
                <DetailRow label="العنوان">{addressLine}</DetailRow>
                {a.landmark && (
                  <DetailRow label="علامة مميزة">{a.landmark}</DetailRow>
                )}
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
          )}

          <Panel>
            <DetailList title="البراند">
              <DetailRow label="الاسم">
                <Link
                  href={`/brands/${o.brand.id}`}
                  className="text-accent underline-offset-4 hover:underline"
                >
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
