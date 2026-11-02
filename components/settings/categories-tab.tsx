"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, FolderTree, ListPlus, Pencil, Plus } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/api/use-action";
import type { Category, StoreType } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { RowMenu } from "@/components/data/row-menu";
import { SearchInput } from "@/components/data/search-input";
import { useSoftDelete } from "@/components/data/use-soft-delete";
import { Badge, STORE_TYPE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { CategoryFormDialog } from "./category-form";
import { childrenMap, LEVEL_LABEL, localizeCategoryError, MAX_LEVEL, normalizeSearch, rootOf, templateSummary } from "./category-utils";
import { DeletedToggle } from "./deleted-toggle";

const NO_CATS: Category[] = [];
const INDENT = ["ps-3", "ps-9", "ps-15"];
/** Same columns for the header and every row. */
const GRID = "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 md:grid-cols-[minmax(0,1fr)_13rem_13rem_3.5rem_2.25rem]";

function StoreTypeBadges({ types, inherited }: { types: StoreType[]; inherited: boolean }) {
  if (!types.length) return <span className={cn("text-meta", inherited ? "text-ink-3/70" : "text-ink-3")}>كل الأنواع</span>;
  return (
    <span className={cn("flex flex-wrap gap-1", inherited && "opacity-55")} title={inherited ? "موروثة من القسم الرئيسي" : undefined}>
      {types.map((t) => (
        <Badge key={t}>{STORE_TYPE[t]?.label ?? t}</Badge>
      ))}
    </span>
  );
}

function TemplateChip({ c }: { c: Category }) {
  const summary = templateSummary(c.template);
  if (summary) return <Badge tone="accent" className="max-w-full truncate">قالب: {summary}</Badge>;
  return <span className="text-meta text-ink-3">{c.level === 0 ? "القالب الافتراضي" : "موروث"}</span>;
}

/** The category tree (section › category › sub-category) with each node's own product template. */
export function CategoriesTab() {
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/admin/categories") });
  const all = cats.data ?? NO_CATS;
  const byId = useMemo(() => new Map(all.map((c) => [c._id, c])), [all]);

  const [form, setForm] = useState<{ open: boolean; category: Category | null; parentId: string | null }>({ open: false, category: null, parentId: null });
  const edit = (c: Category) => setForm({ open: true, category: c, parentId: null });
  const addUnder = (parentId: string | null) => setForm({ open: true, category: null, parentId });

  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState("");
  const [storeType, setStoreType] = useState<StoreType | "">("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const filtering = !!search || !!storeType;

  const toggle = useAction({
    run: (c: Category) => api.patch(`/admin/categories/${c._id}`, { isActive: !c.isActive }).catch(localizeCategoryError),
    success: (c) => ({ title: c.isActive ? "تم إخفاء التصنيف" : "تم تفعيل التصنيف", description: c.nameAr }),
    failure: "لم يتم تحديث التصنيف",
    invalidate: [["categories"]],
  });
  const del = useSoftDelete({
    base: "/admin/categories",
    noun: "التصنيف",
    invalidate: [["categories"]],
    warning: "مش هيظهر للعملاء ولا لأصحاب المتاجر. المنتجات اللي عليه بتفضل موجودة.",
    mapError: localizeCategoryError,
  });

  // Matching nodes plus their ancestors, so a match is always shown in its place in the tree.
  const { tree, matches } = useMemo(() => {
    const q = normalizeSearch(search);
    const matches = new Set(
      all
        .filter((c) => !!c.deletedAt === showDeleted)
        .filter((c) => !q || [c.nameAr, c.nameEn, c.slug].some((s) => normalizeSearch(s).includes(q)))
        .filter((c) => {
          if (!storeType) return true;
          const types = rootOf(c, byId).storeTypes ?? [];
          return !types.length || types.includes(storeType);
        })
        .map((c) => c._id),
    );
    const shown = new Set(matches);
    for (const id of matches) for (const a of byId.get(id)!.ancestors) if (byId.has(a)) shown.add(a);
    return { tree: childrenMap(all.filter((c) => shown.has(c._id))), matches };
  }, [all, byId, search, storeType, showDeleted]);

  const childCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of all) if (!c.deletedAt && c.parentId) m.set(c.parentId, (m.get(c.parentId) ?? 0) + 1);
    return m;
  }, [all]);
  const parentIds = useMemo(() => [...tree.keys()].filter(Boolean), [tree]);
  const isOpen = (id: string) => filtering || expanded.has(id);
  const flip = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const menu = (c: Category) => (
    <RowMenu
      label={`إجراءات تصنيف ${c.nameAr}`}
      items={[
        { label: "تعديل", icon: Pencil, onSelect: () => edit(c), hidden: !!c.deletedAt },
        { label: "إضافة قسم فرعي", icon: ListPlus, onSelect: () => addUnder(c._id), hidden: !!c.deletedAt || c.level >= MAX_LEVEL || !c.isActive },
        ...del.menuItems({ id: c._id, name: c.nameAr }, !!c.deletedAt),
      ]}
    />
  );

  const renderNode = (c: Category): React.ReactNode => {
    const depth = c.level;
    const kids = tree.get(c._id) ?? [];
    const open = isOpen(c._id);
    // Shown only as the path to a match (search, filter, or a deleted child).
    const context = !matches.has(c._id);
    const root = rootOf(c, byId);
    const types = root.storeTypes ?? [];
    const count = childCount.get(c._id) ?? 0;
    return (
      <li key={c._id} role="treeitem" aria-selected={false} aria-expanded={kids.length ? open : undefined} aria-level={depth + 1}>
        <div
          onClick={() => !c.deletedAt && edit(c)}
          className={cn(GRID, INDENT[depth] ?? INDENT[2], "min-h-14 border-b border-line py-2 pe-3 transition-colors", !c.deletedAt && "cursor-pointer hover:bg-sunken/60")}
        >
          <div className="flex min-w-0 items-center gap-2">
            {kids.length ? (
              <button
                type="button"
                aria-label={open ? `قفل ${c.nameAr}` : `فتح ${c.nameAr}`}
                disabled={filtering}
                onClick={(e) => {
                  e.stopPropagation();
                  flip(c._id);
                }}
                className="grid size-8 shrink-0 place-items-center rounded-sm text-ink-2 hover:bg-sunken hover:text-ink disabled:cursor-default disabled:hover:bg-transparent"
              >
                {open ? <ChevronDown aria-hidden className="size-4" /> : <ChevronLeft aria-hidden className="size-4" />}
              </button>
            ) : (
              <span aria-hidden className="size-8 shrink-0" />
            )}
            {c.level === 0 && (
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-sm bg-accent-soft text-accent">
                {c.icon ? <DynamicIcon name={c.icon as IconName} className="size-4" fallback={() => <FolderTree className="size-4" />} /> : <FolderTree className="size-4" />}
              </span>
            )}
            <span className={cn("flex min-w-0 flex-col", context && "opacity-60")}>
              <span className="flex items-center gap-2">
                <span className={cn("truncate text-ink", c.level === 0 ? "font-semibold" : "font-medium", !c.isActive && "text-ink-3")}>{c.nameAr}</span>
                {count > 0 && <span className="num shrink-0 text-meta text-ink-3">({count})</span>}
                {!c.isActive && !c.deletedAt && <Badge>مخفي</Badge>}
              </span>
              <span className="truncate text-meta text-ink-3">
                {c.nameEn} · <span dir="ltr" className="num">{c.slug}</span>
              </span>
              <span className="mt-1 flex flex-wrap gap-1 md:hidden">
                <TemplateChip c={c} />
              </span>
            </span>
          </div>
          <div className="hidden md:block">
            <StoreTypeBadges types={types} inherited={c.level > 0} />
          </div>
          <div className="hidden min-w-0 md:block">
            <TemplateChip c={c} />
          </div>
          <div className="flex justify-center">
            {!c.deletedAt && <Switch checked={c.isActive} onCheckedChange={() => toggle.mutate(c)} disabled={toggle.isPending} label={c.isActive ? `إخفاء ${c.nameAr}` : `تفعيل ${c.nameAr}`} />}
          </div>
          <div className="flex justify-end">{menu(c)}</div>
        </div>
        {kids.length > 0 && open && <ul role="group">{kids.map(renderNode)}</ul>}
      </li>
    );
  };

  const roots = tree.get("") ?? [];
  const deletedCount = all.filter((c) => c.deletedAt).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <DeletedToggle value={showDeleted} onChange={setShowDeleted} deletedCount={deletedCount} />
          <p className="text-ui text-ink-2">الأقسام والتصنيفات اللي المتاجر بتنزّل تحتها منتجاتها، وقالب كل تصنيف.</p>
        </div>
        <Button variant="primary" onClick={() => addUnder(null)}>
          <Plus aria-hidden className="size-4" />
          قسم رئيسي جديد
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="دوّر بالاسم أو الرابط" label="بحث في التصنيفات" />
        <label className="flex items-center gap-2">
          <span className="sr-only">نوع المتجر</span>
          <select
            value={storeType}
            onChange={(e) => setStoreType(e.target.value as StoreType | "")}
            className="h-11 rounded-sm border border-line-strong bg-surface px-3 text-ui text-ink focus:border-accent focus:outline-none"
          >
            <option value="">كل أنواع المتاجر</option>
            {Object.entries(STORE_TYPE).map(([value, t]) => (
              <option key={value} value={value}>
                {t.plural}
              </option>
            ))}
          </select>
        </label>
        {!filtering && (
          <div className="ms-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setExpanded(new Set(parentIds))}>
              فتح الكل
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExpanded(new Set())}>
              قفل الكل
            </Button>
          </div>
        )}
      </div>
      <section aria-label="شجرة التصنيفات" aria-busy={cats.isFetching} className="overflow-hidden rounded-md border border-line bg-surface">
        {cats.isPending ? (
          <div>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex h-14 items-center gap-4 border-b border-line px-4 last:border-b-0">
                <Skeleton className="size-8" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ms-auto hidden h-6 w-24 rounded-full md:block" />
                <Skeleton className="h-6 w-10 rounded-full" />
              </div>
            ))}
          </div>
        ) : cats.error ? (
          <ErrorState error={cats.error} onRetry={() => cats.refetch()} />
        ) : !roots.length ? (
          <EmptyState
            icon={<FolderTree className="size-8" />}
            {...(filtering
              ? { title: "مفيش نتايج", description: "جرّب كلمة تانية أو شيل فلتر نوع المتجر." }
              : showDeleted
                ? { title: "مفيش تصنيفات محذوفة" }
                : { title: "لا توجد تصنيفات", description: "أضف قسمًا رئيسيًا ليختار منه أصحاب المتاجر." })}
          />
        ) : (
          <>
            <div className={cn(GRID, "hidden h-11 border-b border-line bg-sunken ps-3 pe-3 text-meta font-semibold text-ink-2 md:grid")}>
              <span className="ps-10">التصنيف</span>
              <span>أنواع المتاجر</span>
              <span>قالب المنتج</span>
              <span className="text-center">ظاهر</span>
              <span className="sr-only">إجراءات</span>
            </div>
            <ul role="tree" aria-label="التصنيفات" className={cn("-mb-px", cats.isFetching && "opacity-70 transition-opacity")}>
              {roots.map(renderNode)}
            </ul>
          </>
        )}
      </section>
      <p className="mt-2 text-meta text-ink-3">
        {LEVEL_LABEL.join(" › ")} — 3 مستويات بالكتير. التصنيفات الفرعية بتاخد أنواع المتاجر من القسم الرئيسي، وبتورث قالبه إلا اللي يتغيّر فيها.
      </p>
      <CategoryFormDialog
        category={form.category}
        defaultParentId={form.parentId}
        categories={all.filter((c) => !c.deletedAt)}
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
      />
      {del.dialog}
    </>
  );
}
