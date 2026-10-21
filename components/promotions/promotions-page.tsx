"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { HandCoins, Package, Pause, Pencil, Play, Plus } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { AdminCoupon, Campaign, ProductCard } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { RowMenu } from "@/components/data/row-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { CampaignFormDialog } from "./campaign-form";
import { CouponFormDialog } from "./coupon-form";
import { PeriodBadge, PeriodText } from "./promo-status";

const couponHelper = createColumnHelper<TableFeatures, AdminCoupon>();
const campaignHelper = createColumnHelper<TableFeatures, Campaign>();
const NO_COUPONS: AdminCoupon[] = [];
const NO_CAMPAIGNS: Campaign[] = [];
/** Most products the public list returns in one page; enough for a look at who joined. */
const PRODUCTS_LIMIT = 50;

// ---------- Coupons ----------

/** «10%» (+ «حتى 100 ج.م») or «50 ج.م». */
function CouponDiscount({ c }: { c: AdminCoupon }) {
  return (
    <span className="flex flex-col">
      <span className="num font-semibold text-ink">{c.type === "PERCENT" ? `${formatNumber(c.value)}%` : formatMoney(c.value)}</span>
      {c.type === "PERCENT" && c.maxDiscount != null && <span className="text-meta text-ink-3">حتى <span className="num">{formatMoney(c.maxDiscount)}</span></span>}
    </span>
  );
}

const usesLeft = (c: AdminCoupon) => (c.maxUses == null ? Infinity : c.maxUses - c.usedCount);

/** «12 / 100», «12 / ∞»; used up in the warning colour. */
function CouponUsage({ c }: { c: AdminCoupon }) {
  const usedUp = usesLeft(c) <= 0;
  return (
    <span className={cn("num", usedUp ? "font-semibold text-warning" : "text-ink-2")} title={usedUp ? "خلص عدد مرات الاستخدام" : undefined}>
      {formatNumber(c.usedCount)} / {c.maxUses == null ? "∞" : formatNumber(c.maxUses)}
    </span>
  );
}

function CouponsTab() {
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const coupons = useQuery({ queryKey: qk.coupons, queryFn: () => api.get<AdminCoupon[]>("/admin/coupons") });
  const toggle = useAction({
    run: (c: AdminCoupon) => api.patch<AdminCoupon>(`/admin/coupons/${c._id}`, { isActive: !c.isActive }),
    success: (c) => ({ title: c.isActive ? "تم إيقاف الكوبون" : "تم تفعيل الكوبون", description: c.isActive ? `${c.code} مبقاش يشتغل في السلة.` : c.code }),
    failure: "لم يتم تحديث الكوبون",
    invalidate: [qk.coupons],
  });
  const open = (c: AdminCoupon | null) => {
    setEditing(c);
    setFormOpen(true);
  };
  const menu = (c: AdminCoupon) => (
    <RowMenu
      label={`إجراءات كوبون ${c.code}`}
      items={[
        { label: "تعديل", icon: Pencil, onSelect: () => open(c) },
        { label: c.isActive ? "إيقاف الكوبون" : "تفعيل الكوبون", icon: c.isActive ? Pause : Play, danger: c.isActive, separated: true, onSelect: () => toggle.mutate(c) },
      ]}
    />
  );

  const columns = useMemo(
    () =>
      couponHelper.columns([
        couponHelper.accessor("code", { header: "الكود", cell: (i) => <span dir="ltr" className="num font-semibold tracking-wide text-ink">{i.getValue()}</span> }),
        couponHelper.display({ id: "discount", header: "الخصم", cell: (i) => <CouponDiscount c={i.row.original} /> }),
        couponHelper.accessor("minSubtotal", {
          header: "حد أدنى",
          cell: (i) => (i.getValue() ? <span className="num text-ink-2">{formatMoney(i.getValue())}</span> : <span className="text-ink-3">أي طلب</span>),
        }),
        couponHelper.accessor("usedCount", { header: "الاستخدام", cell: (i) => <CouponUsage c={i.row.original} /> }),
        couponHelper.accessor("perUserLimit", { header: "لكل عميل", cell: (i) => <span className="num text-ink-2">{formatNumber(i.getValue())}×</span> }),
        couponHelper.display({
          id: "period",
          header: "الصلاحية",
          cell: (i) => (
            <span className="flex flex-col items-start gap-1">
              <PeriodText period={i.row.original} />
              <PeriodBadge period={i.row.original} />
            </span>
          ),
        }),
        couponHelper.display({ id: "actions", header: () => <span className="sr-only">إجراءات</span>, cell: (i) => <div className="flex justify-end">{menu(i.row.original)}</div> }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-sm border border-line bg-sunken px-4 py-3 text-ui">
        <HandCoins aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        <div>
          <p className="font-semibold text-ink">فاترينة هي اللي بتدفع خصم الكوبونات دي</p>
          <p className="mt-0.5 text-ink-2">
            الكوبون بيشتغل في كل المتاجر. المتجر بياخد تمن الطلب كامل: أول ما الطلب يتسلّم، قيمة الخصم بتتسجل في سجل عمولته كتسوية لصالحه («خصم كوبون فاترينة»).
          </p>
        </div>
      </div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-ui text-ink-2">
          {coupons.data ? (
            <>
              <span className="num">{formatNumber(coupons.data.length)}</span> كوبون
            </>
          ) : null}
        </p>
        <Button variant="primary" onClick={() => open(null)}>
          <Plus aria-hidden className="size-4" />
          كوبون جديد
        </Button>
      </div>
      <DataTable
        label="جدول كوبونات فاترينة"
        columns={columns}
        data={coupons.data ?? NO_COUPONS}
        getRowId={(c) => c._id}
        onRowClick={(c) => open(c)}
        isPending={coupons.isPending}
        isFetching={coupons.isFetching}
        error={coupons.error}
        onRetry={() => coupons.refetch()}
        empty={{ title: "لسه مفيش كوبونات", description: "اعمل كوبون يشتغل في كل المتاجر، والخصم على حساب فاترينة." }}
        mobileItem={(c) => (
          <MobileRow
            title={<span dir="ltr" className="num">{c.code}</span>}
            trailing={<span className="num">{c.type === "PERCENT" ? `${formatNumber(c.value)}%` : formatMoney(c.value)}</span>}
            meta={
              <>
                <span className="num">
                  {formatNumber(c.usedCount)} / {c.maxUses == null ? "∞" : formatNumber(c.maxUses)}
                </span>{" "}
                · لحد {formatDate(c.endsAt)}
              </>
            }
            badge={<PeriodBadge period={c} />}
            actions={menu(c)}
          />
        )}
      />
      <CouponFormDialog coupon={editing} open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}

// ---------- Campaigns ----------

/** Products currently on sale inside the season (public list, `meta.total`). */
function useCampaignProducts(campaignId: string, limit: number, enabled = true) {
  return useQuery({
    queryKey: qk.campaignProducts(campaignId, limit),
    queryFn: () => api.page<ProductCard>("/products", { campaignId, limit }),
    enabled,
    staleTime: 60_000,
  });
}

function JoinedCount({ campaign, onOpen }: { campaign: Campaign; onOpen: () => void }) {
  const products = useCampaignProducts(campaign._id, 1);
  if (products.isPending) return <Skeleton className="h-4 w-12" />;
  if (products.isError) return <span className="text-ink-3" title="تعذّر التحميل">—</span>;
  const total = products.data.meta?.total ?? products.data.items.length;
  return total ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="num rounded-sm text-accent underline-offset-4 hover:underline"
    >
      {formatNumber(total)} منتج
    </button>
  ) : (
    <span className="text-ink-3">لسه مفيش</span>
  );
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="size-5 shrink-0 rounded-full border border-line" style={{ backgroundColor: color }} />
      <span dir="ltr" className="num text-meta text-ink-3">{color.toUpperCase()}</span>
    </span>
  );
}

function CampaignProductsDialog({ campaign, onOpenChange }: { campaign: Campaign | null; onOpenChange: (o: boolean) => void }) {
  const products = useCampaignProducts(campaign?._id ?? "", PRODUCTS_LIMIT, !!campaign);
  const total = products.data?.meta?.total ?? products.data?.items.length ?? 0;
  return (
    <Dialog
      open={!!campaign}
      onOpenChange={onOpenChange}
      size="lg"
      title={campaign ? `المنتجات المشتركة في ${campaign.nameAr}` : ""}
      description={
        campaign ? `منتجات عليها خصم ${formatNumber(campaign.minPercent)}% أو أكتر جوه فترة الموسم.${total > PRODUCTS_LIMIT ? ` معروض أول ${PRODUCTS_LIMIT} من ${formatNumber(total)}.` : ""}` : undefined
      }
    >
      {products.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} className="py-8" />
      ) : !products.data.items.length ? (
        <EmptyState icon={<Package className="size-8" />} title="لسه مفيش منتجات" description="أول ما متجر يعمل خصم على منتج جوه فترة الموسم، هيظهر هنا." className="py-10" />
      ) : (
        <ul className="divide-y divide-line">
          {products.data.items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              {p.imageUrl ? (
                <Image src={p.imageUrl} alt="" width={48} height={48} unoptimized className="size-12 shrink-0 rounded-sm border border-line object-cover" />
              ) : (
                <span aria-hidden className="size-12 shrink-0 rounded-sm bg-sunken" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui font-medium text-ink">{p.title}</span>
                <span className="block truncate text-meta text-ink-3">{p.brand?.name}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5 text-ui">
                <span className="flex items-center gap-2">
                  {p.sale && <Badge tone="accent">−{formatNumber(p.sale.percent)}%</Badge>}
                  <span className="num font-semibold text-ink">{formatMoney(p.price)}</span>
                </span>
                {p.compareAtPrice != null && p.compareAtPrice > p.price && <span className="num text-meta text-ink-3 line-through">{formatMoney(p.compareAtPrice)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function CampaignsTab() {
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<Campaign | null>(null);
  const campaigns = useQuery({ queryKey: qk.campaigns, queryFn: () => api.get<Campaign[]>("/admin/campaigns") });
  const toggle = useAction({
    run: (c: Campaign) => api.patch<Campaign>(`/admin/campaigns/${c._id}`, { isActive: !c.isActive }),
    success: (c) => ({ title: c.isActive ? "تم إيقاف الموسم" : "تم تفعيل الموسم", description: c.nameAr }),
    failure: "لم يتم تحديث الموسم",
    invalidate: [qk.campaigns],
  });
  const open = (c: Campaign | null) => {
    setEditing(c);
    setFormOpen(true);
  };
  const menu = (c: Campaign) => (
    <RowMenu
      label={`إجراءات موسم ${c.nameAr}`}
      items={[
        { label: "تعديل", icon: Pencil, onSelect: () => open(c) },
        { label: "المنتجات المشتركة", icon: Package, onSelect: () => setViewing(c) },
        { label: c.isActive ? "إيقاف الموسم" : "تفعيل الموسم", icon: c.isActive ? Pause : Play, danger: c.isActive, separated: true, onSelect: () => toggle.mutate(c) },
      ]}
    />
  );

  const columns = useMemo(
    () =>
      campaignHelper.columns([
        campaignHelper.accessor("nameAr", {
          header: "الموسم",
          cell: (i) => (
            <span className="flex items-center gap-2.5">
              <span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: i.row.original.color }} />
              <span className="flex flex-col">
                <span className="font-medium text-ink">{i.getValue()}</span>
                <span dir="ltr" className="num text-start text-meta text-ink-3">{i.row.original.slug}</span>
              </span>
            </span>
          ),
        }),
        campaignHelper.display({ id: "period", header: "الفترة", cell: (i) => <PeriodText period={i.row.original} /> }),
        campaignHelper.accessor("minPercent", { header: "أقل خصم", cell: (i) => <span className="num text-ink-2">{formatNumber(i.getValue())}%</span> }),
        campaignHelper.accessor("color", { header: "اللون", cell: (i) => <ColorSwatch color={i.getValue()} /> }),
        campaignHelper.display({ id: "status", header: "الحالة", cell: (i) => <PeriodBadge period={i.row.original} /> }),
        campaignHelper.display({ id: "products", header: "المنتجات المشتركة", cell: (i) => <JoinedCount campaign={i.row.original} onOpen={() => setViewing(i.row.original)} /> }),
        campaignHelper.display({ id: "actions", header: () => <span className="sr-only">إجراءات</span>, cell: (i) => <div className="flex justify-end">{menu(i.row.original)}</div> }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-ui text-ink-2">مواسم زي «الجمعة البيضاء» و«عروض رمضان». المتاجر بتشترك لما تعمل خصم على منتجاتها جوه فترة الموسم.</p>
        <Button variant="primary" onClick={() => open(null)}>
          <Plus aria-hidden className="size-4" />
          موسم جديد
        </Button>
      </div>
      <DataTable
        label="جدول مواسم العروض"
        columns={columns}
        data={campaigns.data ?? NO_CAMPAIGNS}
        getRowId={(c) => c._id}
        onRowClick={(c) => open(c)}
        isPending={campaigns.isPending}
        isFetching={campaigns.isFetching}
        error={campaigns.error}
        onRetry={() => campaigns.refetch()}
        empty={{ title: "لسه مفيش مواسم", description: "ضيف موسم عروض والمتاجر تقدر تشترك فيه بخصومات على منتجاتها." }}
        mobileItem={(c) => (
          <MobileRow
            title={
              <span className="flex items-center gap-2">
                <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                {c.nameAr}
              </span>
            }
            trailing={<JoinedCount campaign={c} onOpen={() => setViewing(c)} />}
            meta={`${formatDate(c.startsAt)} ← ${formatDate(c.endsAt)} · خصم ${formatNumber(c.minPercent)}%+`}
            badge={<PeriodBadge period={c} />}
            actions={menu(c)}
          />
        )}
      />
      <CampaignFormDialog campaign={editing} open={formOpen} onOpenChange={setFormOpen} />
      <CampaignProductsDialog campaign={viewing} onOpenChange={(o) => !o && setViewing(null)} />
    </>
  );
}

export function PromotionsPage() {
  const url = useUrlState();
  const tab = url.get("tab") === "campaigns" ? "campaigns" : "coupons";
  const trigger =
    "relative h-11 px-1 text-ui text-ink-2 transition-colors hover:text-ink data-[state=active]:font-semibold data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-brand";
  return (
    <PageShell>
      <PageHeader title="العروض" description="كوبونات فاترينة اللي بتشتغل في كل المتاجر، ومواسم العروض اللي المتاجر بتشترك فيها." />
      <Tabs.Root value={tab} onValueChange={(v) => url.set({ tab: v === "coupons" ? null : v })} dir="rtl" className="mt-6">
        <Tabs.List aria-label="العروض" className="mb-6 flex gap-6 border-b border-line">
          <Tabs.Trigger value="coupons" className={trigger}>
            كوبونات فاترينة
          </Tabs.Trigger>
          <Tabs.Trigger value="campaigns" className={trigger}>
            المواسم
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="coupons">
          <CouponsTab />
        </Tabs.Content>
        <Tabs.Content value="campaigns">
          <CampaignsTab />
        </Tabs.Content>
      </Tabs.Root>
    </PageShell>
  );
}
