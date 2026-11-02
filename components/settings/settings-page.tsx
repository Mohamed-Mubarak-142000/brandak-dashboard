"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Archive, EyeOff, Eye, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/api/use-action";
import type { Plan } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { RowMenu } from "@/components/data/row-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSoftDelete } from "@/components/data/use-soft-delete";
import { CategoriesTab } from "./categories-tab";
import { CommissionSettings } from "./commission-settings";
import { DeletedToggle } from "./deleted-toggle";
import { PlanFormDialog } from "./plan-form";

const planHelper = createColumnHelper<TableFeatures, Plan>();
const NO_PLANS: Plan[] = [];

const ActiveBadge = ({ active }: { active: boolean }) => (active ? <Badge tone="success">مفعّل</Badge> : <Badge>مخفي</Badge>);

/** Both prices 0 = free plan that activates without payment. */
const isFreePlan = (p: Plan) => p.priceMonthly === 0 && p.priceYearly === 0;
const FreeBadge = () => <Badge tone="accent">مجانية</Badge>;

/** "30 منتج · 500 طلب/شهر · 6 صور" */
function planLimitsText({ limits }: Plan) {
  const orders = limits.maxOrdersPerMonth == null ? "طلبات بلا حد" : `${formatNumber(limits.maxOrdersPerMonth)} طلب/شهر`;
  return [`${formatNumber(limits.maxActiveProducts)} منتج`, orders, `${formatNumber(limits.maxImagesPerProduct)} ${limits.maxImagesPerProduct === 1 ? "صورة" : "صور"}`].join(" · ");
}

function PlansTab() {
  const [editing, setEditing] = useState<Plan | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api.get<Plan[]>("/admin/plans") });
  const [showDeleted, setShowDeleted] = useState(false);
  const allPlans = plans.data ?? NO_PLANS;
  const visiblePlans = useMemo(() => allPlans.filter((p) => !!p.deletedAt === showDeleted), [allPlans, showDeleted]);
  const del = useSoftDelete({
    base: "/admin/plans",
    noun: "الباقة",
    invalidate: [["plans"]],
    warning: "مش هتظهر للمتاجر الجديدة، والاشتراكات الحالية بتكمّل عادي.",
  });
  const toggle = useAction({
    run: (p: Plan) => api.patch(`/admin/plans/${p._id}`, { isActive: !p.isActive }),
    success: (p) => ({ title: p.isActive ? "تم إخفاء الباقة" : "تم تفعيل الباقة", description: p.isActive ? "لن تظهر للبراندات الجديدة؛ الاشتراكات الحالية لا تتأثر." : p.nameAr }),
    failure: "لم يتم تحديث الباقة",
    invalidate: [["plans"]],
  });
  const open = (p: Plan | null) => {
    setEditing(p);
    setFormOpen(true);
  };
  const menu = (p: Plan) => (
    <RowMenu
      label={`إجراءات باقة ${p.nameAr}`}
      items={[
        { label: "تعديل", icon: Pencil, onSelect: () => open(p), hidden: !!p.deletedAt },
        { label: p.isActive ? "إخفاء الباقة" : "تفعيل الباقة", icon: p.isActive ? EyeOff : Eye, danger: p.isActive, separated: true, onSelect: () => toggle.mutate(p), hidden: !!p.deletedAt },
        ...del.menuItems({ id: p._id, name: p.nameAr }, !!p.deletedAt),
      ]}
    />
  );

  const columns = useMemo(
    () =>
      planHelper.columns([
        planHelper.accessor("nameAr", {
          header: "الباقة",
          cell: (info) => (
            <span className="flex flex-col">
              <span className="font-medium text-ink">{info.getValue()}</span>
              <span className="num text-meta text-ink-3">{info.row.original.code}</span>
            </span>
          ),
        }),
        planHelper.accessor("priceMonthly", {
          header: "شهريًا",
          cell: (i) => (isFreePlan(i.row.original) ? <FreeBadge /> : <span className="num font-semibold">{formatMoney(i.getValue())}</span>),
        }),
        planHelper.accessor("priceYearly", { header: "سنويًا", cell: (i) => (isFreePlan(i.row.original) ? <span className="text-ink-3">—</span> : <span className="num">{formatMoney(i.getValue())}</span>) }),
        planHelper.accessor((p) => p.limits.maxActiveProducts, { id: "limit", header: "الحدود", cell: (i) => <span className="num whitespace-nowrap">{planLimitsText(i.row.original)}</span> }),
        planHelper.accessor("isActive", { header: "الحالة", cell: (i) => <ActiveBadge active={i.getValue()} /> }),
        planHelper.display({ id: "actions", header: () => <span className="sr-only">إجراءات</span>, cell: (i) => <div className="flex justify-end">{menu(i.row.original)}</div> }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-sm border border-line bg-sunken px-4 py-3 text-ui">
        <Archive aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <div>
          <p className="font-semibold text-ink">الباقات اتلغت — القائمة دي للسجل بس</p>
          <p className="mt-0.5 text-ink-2">
            فاترينة دلوقتي بتاخد عمولة على كل طلب بيتسلّم بدل الاشتراكات. الباقات فاضلة هنا عشان مدفوعات واشتراكات المتاجر القديمة تفضل مفهومة؛
            شروط العمولة في تبويب «العمولة».
          </p>
        </div>
      </div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <DeletedToggle value={showDeleted} onChange={setShowDeleted} deletedCount={allPlans.filter((p) => p.deletedAt).length} />
        <Button onClick={() => open(null)}>
          <Plus aria-hidden className="size-4" />
          باقة جديدة
        </Button>
      </div>
      <DataTable
        label="جدول الباقات"
        columns={columns}
        data={visiblePlans}
        getRowId={(p) => p._id}
        onRowClick={(p) => !p.deletedAt && open(p)}
        isPending={plans.isPending}
        error={plans.error}
        onRetry={() => plans.refetch()}
        empty={showDeleted ? { title: "مفيش باقات محذوفة" } : { title: "لا توجد باقات", description: "مفيش باقات قديمة متسجلة." }}
        mobileItem={(p) => <MobileRow title={p.nameAr} trailing={isFreePlan(p) ? <FreeBadge /> : <span className="num">{formatMoney(p.priceMonthly)}</span>} meta={planLimitsText(p)} badge={<ActiveBadge active={p.isActive} />} actions={menu(p)} />}
      />
      <PlanFormDialog plan={editing} open={formOpen} onOpenChange={setFormOpen} />
      {del.dialog}
    </>
  );
}

export function SettingsPage() {
  const url = useUrlState();
  const param = url.get("tab");
  const tab = param === "categories" || param === "plans" ? param : "commission";
  const trigger =
    "relative h-11 px-1 text-ui text-ink-2 transition-colors hover:text-ink data-[state=active]:font-semibold data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-brand";
  return (
    <PageShell>
      <PageHeader title="الإعدادات" description="شروط العمولة وتصنيفات المتاجر." />
      <Tabs.Root value={tab} onValueChange={(v) => url.set({ tab: v === "commission" ? null : v })} dir="rtl" className="mt-6">
        <Tabs.List aria-label="الإعدادات" className="mb-6 flex gap-6 overflow-x-auto border-b border-line">
          <Tabs.Trigger value="commission" className={trigger}>
            العمولة
          </Tabs.Trigger>
          <Tabs.Trigger value="categories" className={trigger}>
            التصنيفات
          </Tabs.Trigger>
          <Tabs.Trigger value="plans" className={cn(trigger, "ms-auto whitespace-nowrap text-ink-3")}>
            الباقات القديمة (للسجل فقط)
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="commission">
          <CommissionSettings />
        </Tabs.Content>
        <Tabs.Content value="plans">
          <PlansTab />
        </Tabs.Content>
        <Tabs.Content value="categories">
          <CategoriesTab />
        </Tabs.Content>
      </Tabs.Root>
    </PageShell>
  );
}
