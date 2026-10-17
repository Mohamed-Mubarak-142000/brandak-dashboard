"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { BadgeCheck, Copy, PauseCircle, PlayCircle, ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/api/use-action";
import type { AdminUser } from "@/lib/api/types";
import { formatDate, formatPhone } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { DataTable, MobileRow, type TableFeatures } from "@/components/data/data-table";
import { FilterChips, FilterDialog, type FilterSection } from "@/components/data/filter-dialog";
import { DELETED_FILTER, useSoftDelete } from "@/components/data/use-soft-delete";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { RowMenu } from "@/components/data/row-menu";
import { SearchInput } from "@/components/data/search-input";
import { Badge, USER_STATUS } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

const PAGE_SIZE = 20;
const helper = createColumnHelper<TableFeatures, AdminUser>();
const EMPTY: AdminUser[] = [];
const STATUS_OPTIONS = [
  { value: "ALL", label: "الكل" },
  { value: "ACTIVE", label: "نشط" },
  { value: "SUSPENDED", label: "موقوف", hint: "لا يستطيع الدخول" },
];

function Verified({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "inline-flex items-center gap-1 text-success" : "inline-flex items-center gap-1 text-ink-3"}>
      {ok && <BadgeCheck aria-hidden className="size-3.5" />}
      {label}
      <span className="sr-only">{ok ? "موثّق" : "غير موثّق"}</span>
    </span>
  );
}

export function UsersPage() {
  const router = useRouter();
  const url = useUrlState();
  const toast = useToast();
  const status = url.get("status") ?? "ALL";
  const deleted = url.get("deleted") ?? "no";
  const q = url.get("q") ?? "";
  const [confirm, setConfirm] = useState<AdminUser | null>(null);

  const list = useQuery({
    queryKey: ["users", status, deleted, q, url.page],
    queryFn: () =>
      api.page<AdminUser>("/admin/users", {
        status: status === "ALL" ? undefined : status,
        deleted: deleted === "yes" ? true : undefined,
        q,
        page: url.page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const setStatus = useAction({
    run: ({ user, next }: { user: AdminUser; next: "ACTIVE" | "SUSPENDED" }) => api.patch(`/admin/users/${user.id}/status`, { status: next }),
    success: ({ user, next }) => ({
      title: next === "SUSPENDED" ? "تم إيقاف الحساب" : "تمت إعادة تفعيل الحساب",
      description: next === "SUSPENDED" ? `تم تسجيل خروج ${user.name} من كل الأجهزة.` : user.name,
    }),
    failure: "لم يتم تغيير حالة الحساب",
    invalidate: [["users"]],
    onDone: () => setConfirm(null),
  });

  const sections: FilterSection[] = [{ key: "status", label: "حالة الحساب", options: STATUS_OPTIONS, defaultValue: "ALL" }, DELETED_FILTER];
  const filterValues = { status, deleted };
  const del = useSoftDelete({
    base: "/admin/users",
    noun: "الحساب",
    invalidate: [["users"]],
    warning: "هيتسجّل خروجه من كل الأجهزة ومش هيقدر يدخل تاني. طلباته القديمة بتفضل عند المتاجر.",
  });

  const menu = (u: AdminUser) => (
    <RowMenu
      label={`إجراءات ${u.name}`}
      items={[
        {
          label: "نسخ البريد الإلكتروني",
          icon: Copy,
          onSelect: async () => {
            await navigator.clipboard?.writeText(u.email).catch(() => undefined);
            toast({ tone: "success", title: "تم نسخ البريد", description: u.email });
          },
        },
        { label: "سجل إجراءات الحساب", icon: ScrollText, onSelect: () => router.push(`/audit?entity=User&id=${u.id}`) },
        { label: "إيقاف الحساب", icon: PauseCircle, danger: true, separated: true, hidden: !!u.deletedAt || u.status !== "ACTIVE" || u.roles.includes("SUPER_ADMIN"), onSelect: () => setConfirm(u) },
        { label: "إعادة تفعيل الحساب", icon: PlayCircle, separated: true, hidden: !!u.deletedAt || u.status !== "SUSPENDED", onSelect: () => setConfirm(u) },
        // Admin accounts are protected (the API refuses too).
        ...(u.roles.includes("SUPER_ADMIN") ? [] : del.menuItems({ id: u.id, name: u.name }, !!u.deletedAt)),
      ]}
    />
  );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "المستخدم",
          cell: (info) => (
            <span className="flex flex-col">
              <span className="flex items-center gap-2 font-medium text-ink">
                {info.getValue()}
                {info.row.original.roles.includes("SUPER_ADMIN") && <Badge tone="accent">مشرف</Badge>}
              </span>
              <span className="num text-meta text-ink-3">{info.row.original.email}</span>
            </span>
          ),
        }),
        helper.accessor("phone", { header: "الهاتف", cell: (info) => <span className="num">{formatPhone(info.getValue())}</span> }),
        helper.display({
          id: "verified",
          header: "التحقق",
          cell: (info) => (
            <span className="flex gap-3 text-meta">
              <Verified ok={info.row.original.phoneVerified} label="الهاتف" />
              <Verified ok={info.row.original.emailVerified} label="البريد" />
            </span>
          ),
        }),
        helper.accessor("status", {
          header: "الحالة",
          cell: (info) => <Badge tone={USER_STATUS[info.getValue()].tone}>{USER_STATUS[info.getValue()].label}</Badge>,
        }),
        helper.accessor("createdAt", { header: "تاريخ التسجيل", cell: (info) => <span className="text-ink-2">{formatDate(info.getValue())}</span> }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">إجراءات</span>,
          cell: (info) => <div className="flex justify-end">{menu(info.row.original)}</div>,
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const suspending = confirm?.status === "ACTIVE";

  return (
    <PageShell>
      <PageHeader title="المستخدمون" description="كل الحسابات المسجّلة: عملاء وأصحاب براندات وفريق الإدارة." />
      <div className="mt-6 flex items-center gap-2">
        <SearchInput value={q} onChange={(v) => url.set({ q: v })} placeholder="الاسم أو البريد أو الهاتف" label="بحث بالاسم أو البريد أو الهاتف" />
        <FilterDialog
          title="تصفية المستخدمين"
          sections={sections}
          values={filterValues}
          onApply={(v) => url.set({ status: v.status === "ALL" ? null : v.status, deleted: v.deleted === "yes" ? "yes" : null })}
        />
      </div>
      <FilterChips sections={sections} values={filterValues} onClear={(key) => url.set(key === "all" ? { status: null, deleted: null } : { [key]: null })} />
      <div className="mt-4">
        <DataTable
          label="جدول المستخدمين"
          columns={columns}
          data={list.data?.items ?? EMPTY}
          getRowId={(u) => u.id}
          isPending={list.isPending}
          isFetching={list.isFetching && list.isPlaceholderData}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={q ? { title: "لا توجد نتائج", description: "جرّب جزءًا من الاسم أو البريد أو رقم الهاتف." } : { title: "لا يوجد مستخدمون هنا" }}
          paging={{ page: url.page, pageSize: PAGE_SIZE, total: list.data?.meta.total ?? 0, onPage: (p) => url.set({ page: p }, { resetPage: false }) }}
          mobileItem={(u) => (
            <MobileRow
              title={u.name}
              meta={<span className="num">{formatPhone(u.phone)}</span>}
              badge={<Badge tone={USER_STATUS[u.status].tone}>{USER_STATUS[u.status].label}</Badge>}
              actions={menu(u)}
            />
          )}
        />
      </div>
      {del.dialog}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={suspending ? `إيقاف حساب ${confirm?.name ?? ""}` : `إعادة تفعيل حساب ${confirm?.name ?? ""}`}
        description={
          suspending
            ? "سيتم تسجيل خروجه من كل الأجهزة فورًا ولن يستطيع الدخول حتى تعيد تفعيل الحساب."
            : "سيستطيع الدخول واستخدام حسابه من جديد."
        }
        confirmLabel={suspending ? "إيقاف الحساب" : "إعادة التفعيل"}
        tone={suspending ? "danger" : "primary"}
        loading={setStatus.isPending}
        onConfirm={() => confirm && setStatus.mutate({ user: confirm, next: suspending ? "SUSPENDED" : "ACTIVE" })}
      />
    </PageShell>
  );
}
