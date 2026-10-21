"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { CheckCircle2, Eye, PauseCircle, PlayCircle, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import type { AdminBrand } from "@/lib/api/types";
import { formatDate, formatPhone } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { FilterChips, FilterDialog, type FilterSection } from "@/components/data/filter-dialog";
import { DELETED_FILTER, useSoftDelete } from "@/components/data/use-soft-delete";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { RowMenu, type RowMenuItem } from "@/components/data/row-menu";
import { SearchInput } from "@/components/data/search-input";
import { Badge, BRAND_STATUS, STORE_TYPE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACTION_LABEL, BRAND_ACTIONS, useBrandActions, type BrandActionKind } from "./brand-actions";

const PAGE_SIZE = 20;
const helper = createColumnHelper<TableFeatures, AdminBrand>();
const STATUS_OPTIONS = [
  { value: "ALL", label: "الكل", hint: "كل المتاجر" },
  { value: "PENDING_REVIEW", label: "قيد المراجعة", hint: "طلبات جديدة تنتظر قرارك" },
  { value: "ACTIVE", label: "مفعّلة", hint: "تمت الموافقة عليها" },
  { value: "SUSPENDED", label: "موقوفة", hint: "مخفية عن العملاء بقرار إداري" },
  { value: "REJECTED", label: "مرفوضة", hint: "يمكن لأصحابها التعديل وإعادة الإرسال" },
];
const TYPE_OPTIONS = [
  { value: "ALL", label: "كل الأنواع" },
  ...Object.entries(STORE_TYPE).map(([value, t]) => ({ value, label: t.plural })),
];

const ownerOf = (b: AdminBrand) => (typeof b.ownerUserId === "object" ? b.ownerUserId : null);

/** Visible to customers = approved (a store that owes overdue commission still shows, but pauses orders). */
function Visibility({ brand }: { brand: AdminBrand }) {
  if (brand.isVisible) return <span className="text-success">ظاهر</span>;
  return <span className="text-ink-3">مخفي</span>;
}

function BrandLogo({ brand, size = 32 }: { brand: AdminBrand; size?: number }) {
  return brand.logo?.url ? (
    <Image src={brand.logo.url} alt="" width={size} height={size} unoptimized className="shrink-0 rounded-sm border border-line object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-sm bg-accent-soft font-display text-accent" style={{ width: size, height: size }}>
      {brand.name.trim().charAt(0)}
    </span>
  );
}

export function BrandsPage() {
  const router = useRouter();
  const url = useUrlState();
  const status = url.get("status") ?? "ALL";
  const storeType = url.get("storeType") ?? "ALL";
  const deleted = url.get("deleted") ?? "no";
  const q = url.get("q") ?? "";
  const actions = useBrandActions();
  const runAction = actions.run;

  const list = useQuery({
    queryKey: ["brands", status, storeType, deleted, q, url.page],
    queryFn: () =>
      api.page<AdminBrand>("/admin/brands", {
        status: status === "ALL" ? undefined : status,
        storeType: storeType === "ALL" ? undefined : storeType,
        deleted: deleted === "yes" ? true : undefined,
        q,
        page: url.page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const counts = useQuery({
    queryKey: ["brands", "counts"],
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          STATUS_OPTIONS.map(async (o) => [
            o.value,
            (await api.page("/admin/brands", { status: o.value === "ALL" ? undefined : o.value, limit: 1 })).meta.total,
          ]),
        ),
      ) as Record<string, number>,
  });

  const sections: FilterSection[] = [
    { key: "status", label: "الحالة", options: STATUS_OPTIONS, defaultValue: "ALL", counts: counts.data },
    { key: "storeType", label: "نوع المتجر", options: TYPE_OPTIONS, defaultValue: "ALL", columns: 2 },
    DELETED_FILTER,
  ];
  const filterValues = { status, storeType, deleted };
  const del = useSoftDelete({
    base: "/admin/brands",
    noun: "المتجر",
    invalidate: [["brands"], ["brand"]],
    warning: "هيختفي من التطبيق فورًا وصاحبه مش هيقدر يدخل لوحة المتجر. الطلبات القديمة مش بتتأثر.",
  });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "المتجر",
          cell: (info) => (
            <span className="flex items-center gap-3">
              <BrandLogo brand={info.row.original} />
              <span className="flex flex-col">
                <Link href={`/brands/${info.row.original._id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:text-accent hover:underline underline-offset-4">
                  {info.getValue()}
                </Link>
                <span className="num text-meta text-ink-3">{info.row.original.slug}</span>
              </span>
            </span>
          ),
        }),
        helper.accessor((b) => ownerOf(b)?.name ?? "—", {
          id: "owner",
          header: "المالك",
          cell: (info) => {
            const owner = ownerOf(info.row.original);
            return (
              <span className="flex flex-col">
                <span className="text-ink">{info.getValue()}</span>
                {owner && <span className="num text-meta text-ink-3">{formatPhone(owner.phone)}</span>}
              </span>
            );
          },
        }),
        helper.accessor((b) => b.storeType ?? "BRAND", {
          id: "storeType",
          header: "النوع",
          cell: (info) => <Badge>{STORE_TYPE[info.getValue()]?.label ?? info.getValue()}</Badge>,
        }),
        helper.accessor("status", {
          header: "الحالة",
          cell: (info) => <Badge tone={BRAND_STATUS[info.getValue()].tone}>{BRAND_STATUS[info.getValue()].label}</Badge>,
        }),
        helper.display({ id: "visibility", header: "الظهور للعملاء", cell: (info) => <Visibility brand={info.row.original} /> }),
        helper.accessor("createdAt", { header: "تاريخ الطلب", cell: (info) => <span className="text-ink-2">{formatDate(info.getValue())}</span> }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">إجراءات</span>,
          cell: (info) => {
            const b = info.row.original;
            const pending = b.status === "PENDING_REVIEW";
            return (
              <div className="flex items-center justify-end gap-1">
                <Button size="sm" variant={pending ? "primary" : "ghost"} onClick={(e) => { e.stopPropagation(); router.push(`/brands/${b._id}`); }}>
                  {pending ? "مراجعة" : "عرض"}
                </Button>
                <BrandMenu brand={b} onAction={(kind) => runAction(kind, b)} onOpen={() => router.push(`/brands/${b._id}`)} extra={del.menuItems({ id: b._id, name: b.name }, !!b.deletedAt)} />
              </div>
            );
          },
        }),
      ]),
    // del.menuItems only calls stable setters/mutate, so the first render's closure stays valid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, runAction],
  );

  const total = list.data?.meta.total ?? 0;

  return (
    <PageShell>
      <PageHeader title="المتاجر" description="راجع طلبات المتاجر الجديدة (براندات ومعارض ومخازن ومحلات) وتابع حالة كل متجر." />
      <div className="mt-6 flex items-center gap-2">
        <SearchInput value={q} onChange={(v) => url.set({ q: v })} placeholder="ابحث باسم البراند" label="بحث باسم البراند" />
        <FilterDialog
          title="تصفية المتاجر"
          sections={sections}
          values={filterValues}
          onApply={(v) =>
            url.set({
              status: v.status === "ALL" ? null : v.status,
              storeType: v.storeType === "ALL" ? null : v.storeType,
              deleted: v.deleted === "yes" ? "yes" : null,
            })
          }
        />
      </div>
      <FilterChips sections={sections} values={filterValues} onClear={(key) => url.set(key === "all" ? { status: null, storeType: null, deleted: null } : { [key]: null })} />
      <div className="mt-4">
        <DataTable
          label="جدول البراندات"
          columns={columns}
          data={list.data?.items ?? EMPTY}
          getRowId={(b) => b._id}
          onRowClick={(b) => router.push(`/brands/${b._id}`)}
          isPending={list.isPending}
          isFetching={list.isFetching && list.isPlaceholderData}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={
            q
              ? { title: "لا توجد نتائج", description: "جرّب اسمًا آخر أو امسح البحث." }
              : { title: "لا توجد متاجر هنا", description: "عندما يقدّم صاحب متجر طلبًا جديدًا سيظهر في هذه القائمة." }
          }
          paging={{ page: url.page, pageSize: PAGE_SIZE, total, onPage: (p) => url.set({ page: p }, { resetPage: false }) }}
          mobileItem={(b) => (
            <MobileRow
              href={`/brands/${b._id}`}
              title={b.name}
              meta={[STORE_TYPE[b.storeType ?? "BRAND"]?.label, ownerOf(b)?.name].filter(Boolean).join(" · ")}
              badge={<Badge tone={BRAND_STATUS[b.status].tone}>{BRAND_STATUS[b.status].label}</Badge>}
              actions={<BrandMenu brand={b} onAction={(kind) => runAction(kind, b)} onOpen={() => router.push(`/brands/${b._id}`)} extra={del.menuItems({ id: b._id, name: b.name }, !!b.deletedAt)} />}
            />
          )}
        />
      </div>
      {actions.dialog}
      {del.dialog}
    </PageShell>
  );
}

const EMPTY: AdminBrand[] = [];

function BrandMenu({
  brand,
  onAction,
  onOpen,
  extra,
}: {
  brand: AdminBrand;
  onAction: (kind: BrandActionKind) => void;
  onOpen: () => void;
  extra: RowMenuItem[];
}) {
  // A deleted store only offers "restore"; decisions come back after it is restored.
  const allowed = brand.deletedAt ? [] : BRAND_ACTIONS[brand.status];
  return (
    <RowMenu
      label={`إجراءات ${brand.name}`}
      items={[
        { label: "عرض التفاصيل", icon: Eye, onSelect: onOpen },
        { label: ACTION_LABEL.approve, icon: CheckCircle2, onSelect: () => onAction("approve"), hidden: !allowed.includes("approve"), separated: true },
        { label: ACTION_LABEL.reinstate, icon: PlayCircle, onSelect: () => onAction("reinstate"), hidden: !allowed.includes("reinstate"), separated: true },
        { label: ACTION_LABEL.reject, icon: XCircle, onSelect: () => onAction("reject"), hidden: !allowed.includes("reject"), danger: true },
        { label: ACTION_LABEL.suspend, icon: PauseCircle, onSelect: () => onAction("suspend"), hidden: !allowed.includes("suspend"), danger: true, separated: true },
        ...extra,
      ]}
    />
  );
}
