"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import type { AdminBrand, AdminSubscription, AuditEntry, PaymentListItem } from "@/lib/api/types";
import { GOVERNORATE_NAMES } from "@/lib/governorates";
import { BILLING_LABEL, formatDate, formatDateTime, formatMoney, formatPhone } from "@/lib/format";
import { DetailList, DetailRow, Muted, Panel } from "@/components/data/detail-list";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { Badge, BRAND_STATUS, PAYMENT_STATUS, STORE_TYPE, SUBSCRIPTION_STATUS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { ActivityList } from "@/components/audit/activity-list";
import { ACTION_LABEL, BRAND_ACTIONS, useBrandActions } from "./brand-actions";

const SOCIAL_LABEL: Record<string, string> = { instagram: "إنستجرام", facebook: "فيسبوك", tiktok: "تيك توك", website: "الموقع" };

export function BrandDetail() {
  const { id } = useParams<{ id: string }>();
  const brand = useQuery({ queryKey: ["brand", id], queryFn: () => api.get<AdminBrand>(`/admin/brands/${id}`) });
  const subs = useQuery({
    queryKey: ["brand", id, "subscriptions"],
    queryFn: () => api.page<AdminSubscription>("/admin/subscriptions", { brandId: id, limit: 20 }),
  });
  const payments = useQuery({
    queryKey: ["brand", id, "payments"],
    queryFn: () => api.page<PaymentListItem>("/admin/payments", { brandId: id, limit: 20 }),
  });
  const activity = useQuery({
    queryKey: ["brand", id, "activity"],
    queryFn: () => api.page<AuditEntry>("/admin/audit-logs", { entityType: "Brand", entityId: id, limit: 30 }),
  });
  const actions = useBrandActions();

  if (brand.isPending) return <DetailSkeleton />;
  if (brand.isError || !brand.data) {
    return (
      <PageShell>
        <ErrorState error={brand.error} onRetry={() => brand.refetch()} />
      </PageShell>
    );
  }

  const b = brand.data;
  const owner = typeof b.ownerUserId === "object" ? b.ownerUserId : null;
  const status = BRAND_STATUS[b.status];
  const allowed = BRAND_ACTIONS[b.status];
  const s = b.settings;

  return (
    <PageShell>
      <PageHeader
        back={{ href: "/brands", label: "كل البراندات" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {b.logo?.url && <Image src={b.logo.url} alt="" width={40} height={40} unoptimized className="size-10 rounded-sm border border-line object-cover" />}
            {b.name}
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        }
        description={
          b.isVisible ? (
            <span className="text-success">ظاهر للعملاء ومدفوع حتى {formatDate(b.subscriptionEndsAt)}</span>
          ) : b.status === "ACTIVE" ? (
            <span className="text-warning">مخفي عن العملاء: لا يوجد اشتراك فعّال</span>
          ) : (
            <>مخفي عن العملاء. أُرسل الطلب في {formatDate(b.createdAt)}</>
          )
        }
        actions={allowed.map((kind) => (
          <Button
            key={kind}
            variant={kind === "approve" || kind === "reinstate" ? "primary" : "danger"}
            loading={actions.pendingKind === kind}
            disabled={actions.pending}
            onClick={() => actions.run(kind, b)}
          >
            {ACTION_LABEL[kind]}
          </Button>
        ))}
      />

      {b.statusReason && (b.status === "REJECTED" || b.status === "SUSPENDED") && (
        <div className="mt-6 rounded-sm border border-danger/30 bg-danger-soft px-4 py-3 text-ui">
          <p className="font-semibold text-danger">{b.status === "REJECTED" ? "سبب الرفض" : "سبب الإيقاف"}</p>
          <p className="mt-1 text-ink">{b.statusReason}</p>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel>
            <DetailList title="بيانات المتجر">
              <DetailRow label="نوع المتجر">
                <Badge>{STORE_TYPE[b.storeType ?? "BRAND"]?.label}</Badge>
              </DetailRow>
              <DetailRow label="الرابط">
                <span className="num text-ui">{b.slug}</span>
              </DetailRow>
              <DetailRow label="الوصف">{b.description || <Muted>لا يوجد وصف</Muted>}</DetailRow>
              <DetailRow label="التصنيفات">
                {b.categoryIds.map((c) => (typeof c === "object" ? <Badge key={c._id}>{c.nameAr}</Badge> : null))}
              </DetailRow>
              <DetailRow label="هاتف التواصل">
                <span className="num">{formatPhone(b.contact.phone)}</span>
              </DetailRow>
              {b.contact.whatsapp && (
                <DetailRow label="واتساب">
                  <span className="num">{formatPhone(b.contact.whatsapp)}</span>
                </DetailRow>
              )}
              {b.contact.email && (
                <DetailRow label="البريد">
                  <span className="num">{b.contact.email}</span>
                </DetailRow>
              )}
              {Object.entries(b.socialLinks ?? {}).filter(([, v]) => v).length > 0 && (
                <DetailRow label="السوشيال ميديا">
                  {Object.entries(b.socialLinks)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <a key={k} href={v} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ui text-accent underline-offset-4 hover:underline">
                        {SOCIAL_LABEL[k] ?? k}
                        <ExternalLink aria-hidden className="size-3.5" />
                      </a>
                    ))}
                </DetailRow>
              )}
              <DetailRow label="التقييم">
                {b.ratingCount ? (
                  <>
                    <span className="num font-semibold">{b.ratingAvg.toFixed(1)}</span> <Muted>من {b.ratingCount} تقييم</Muted>
                  </>
                ) : (
                  <Muted>لا توجد تقييمات بعد</Muted>
                )}
              </DetailRow>
            </DetailList>
          </Panel>

          <Panel>
            <DetailList title="الشحن والسياسات">
              <DetailRow label="يستقبل طلبات">{s.acceptsOrders ? "نعم" : <span className="text-warning">متوقف مؤقتًا</span>}</DetailRow>
              <DetailRow label="مدة التجهيز">
                <span className="num">{s.processingDays}</span> أيام
              </DetailRow>
              <DetailRow label="الحد الأدنى للطلب">{s.minOrderAmount ? <span className="num">{formatMoney(s.minOrderAmount)}</span> : <Muted>لا يوجد</Muted>}</DetailRow>
              <DetailRow label="شحن مجاني من">
                {s.freeShippingThreshold != null ? <span className="num">{formatMoney(s.freeShippingThreshold)}</span> : <Muted>غير متاح</Muted>}
              </DetailRow>
              <DetailRow label="باقي المحافظات">
                {s.defaultShippingFee != null ? <span className="num">{formatMoney(s.defaultShippingFee)}</span> : <Muted>لا يوصّل خارج المناطق المحددة</Muted>}
              </DetailRow>
            </DetailList>
            {s.shippingZones.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {s.shippingZones.map((z) => (
                  <li key={z.governorate} className="rounded-sm border border-line bg-sunken px-2.5 py-1 text-ui">
                    {GOVERNORATE_NAMES[z.governorate] ?? z.governorate} <span className="num font-semibold">{formatMoney(z.fee)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel>
            <DetailList title="صاحب البراند">
              <DetailRow label="الاسم">{owner?.name ?? <Muted>غير متاح</Muted>}</DetailRow>
              <DetailRow label="البريد">
                <span className="num">{owner?.email ?? "—"}</span>
              </DetailRow>
              <DetailRow label="الهاتف">
                <span className="num">{formatPhone(owner?.phone)}</span>
              </DetailRow>
            </DetailList>
          </Panel>

          <Panel>
            <h2 className="mb-3 text-ui font-semibold text-ink">الاشتراكات</h2>
            {subs.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : !subs.data?.items.length ? (
              <p className="text-ui text-ink-3">لم يطلب اشتراكًا بعد.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {subs.data.items.map((sub) => (
                  <li key={sub._id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex flex-col">
                      <span className="text-ui font-medium text-ink">
                        {sub.planSnapshot.nameAr}، {BILLING_LABEL[sub.billingPeriod]} — <span className="num">{formatMoney(sub.planSnapshot.price)}</span>
                      </span>
                      <span className="text-meta text-ink-3">
                        {sub.startsAt ? <>من {formatDate(sub.startsAt)} إلى {formatDate(sub.endsAt)}</> : <>طُلب في {formatDate(sub.createdAt)}</>}
                      </span>
                    </span>
                    <Badge tone={SUBSCRIPTION_STATUS[sub.status].tone}>{SUBSCRIPTION_STATUS[sub.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <h2 className="mb-3 text-ui font-semibold text-ink">المدفوعات</h2>
            {payments.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : !payments.data?.items.length ? (
              <p className="text-ui text-ink-3">لا توجد مدفوعات.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {payments.data.items.map((p) => (
                  <li key={p._id}>
                    <Link href={`/payments/${p._id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-accent">
                      <span className="flex flex-col">
                        <span className="num text-ui font-semibold">{formatMoney(p.amount)}</span>
                        <span className="text-meta text-ink-3">{formatDateTime(p.submittedAt ?? p.createdAt)}</span>
                      </span>
                      <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <h2 className="mb-3 text-ui font-semibold text-ink">سجل الإجراءات</h2>
            <ActivityList query={activity} empty="لا توجد إجراءات مسجّلة." />
          </Panel>
        </div>
      </div>
      {actions.dialog}
    </PageShell>
  );
}

function DetailSkeleton() {
  return (
    <PageShell>
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-4 h-9 w-72" />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </PageShell>
  );
}
