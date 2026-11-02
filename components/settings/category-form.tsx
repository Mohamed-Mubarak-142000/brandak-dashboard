"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Tabs from "@radix-ui/react-tabs";
import { useQuery } from "@tanstack/react-query";
import { FolderTree, Info } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { useMemo, useState } from "react";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "@/lib/api/client";
import { useAction } from "@/lib/api/use-action";
import type { Category, CategoryPresets, ResolvedTemplate, StoreType } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { Badge, STORE_TYPE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { categorySchema, categoryToValues, DEFAULT_RESOLVED, valuesToTemplate, type CategoryValues } from "./category-schema";
import { childrenMap, localizeCategoryError, MAX_LEVEL, pathName, rootOf, subtreeDepth } from "./category-utils";
import { TemplateEditor } from "./template-editor";

const select = "h-11 w-full rounded-sm border border-line-strong bg-surface px-3 text-body text-ink focus:border-accent focus:outline-none";
const sameTypes = (a: string[], b: string[]) => a.length === b.length && a.every((t) => b.includes(t));

export function CategoryFormDialog({
  category,
  defaultParentId = null,
  categories,
  open,
  onOpenChange,
}: {
  category: Category | null;
  /** "إضافة قسم فرعي": the new category starts under this one. */
  defaultParentId?: string | null;
  /** Live (not deleted) categories. */
  categories: Category[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const editing = !!category;
  const byId = useMemo(() => new Map(categories.map((c) => [c._id, c])), [categories]);
  // Fresh defaults each time the dialog opens; stable while it is open so typing is never reset.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaults = useMemo(() => categoryToValues(category, defaultParentId), [category, defaultParentId, open]);
  const form = useForm<CategoryValues>({ resolver: zodResolver(categorySchema), values: defaults });
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors },
    reset,
  } = form;

  const [tab, setTab] = useState("details");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTab("details");
  }

  const parentId = useWatch({ control, name: "parentId" });
  const icon = useWatch({ control, name: "icon" });
  const parent = parentId ? byId.get(parentId) : undefined;
  const root = parent ? rootOf(parent, byId) : undefined;

  // Possible parents in tree order: not itself or anything under it, and not so deep that its own
  // sub-categories would pass the third level.
  const parents = useMemo(() => {
    const depth = category ? subtreeDepth(category._id, categories) : 0;
    const tree = childrenMap(categories);
    const out: Category[] = [];
    const walk = (list: Category[]) => {
      for (const c of list) {
        if (c.level >= MAX_LEVEL || c._id === category?._id || (category && c.ancestors.includes(category._id))) continue;
        if (c.level + 1 + depth <= MAX_LEVEL) out.push(c);
        walk(tree.get(c._id) ?? []);
      }
    };
    walk(tree.get("") ?? []);
    return out;
  }, [categories, category]);

  const presets = useQuery({
    queryKey: ["category-presets"],
    queryFn: () => api.get<CategoryPresets>("/admin/categories/presets"),
    staleTime: Infinity,
    enabled: open,
  });
  const inherited = useQuery({
    queryKey: ["category-template", parentId],
    queryFn: () => api.get<ResolvedTemplate>(`/categories/${parentId}/template`),
    enabled: open && !!parentId,
  });

  const save = useAction({
    run: async (v: z.output<typeof categorySchema>) => {
      // Sub-categories are offered to the same store types as their top level.
      const storeTypes = (root ? root.storeTypes ?? [] : v.storeTypes) as StoreType[];
      const body = {
        nameAr: v.nameAr,
        nameEn: v.nameEn,
        slug: v.slug,
        parentId: v.parentId || null,
        sortOrder: v.sortOrder,
        storeTypes,
        ...(v.icon ? { icon: v.icon } : editing && category!.icon ? { icon: null } : {}),
        template: valuesToTemplate(v.template),
      };
      try {
        if (!editing) return await api.post<Category>("/admin/categories", body);
        const saved = await api.patch<Category>(`/admin/categories/${category!._id}`, body);
        // The API keeps store types per category; bring everything below in line after a move or change.
        const stale = categories.filter((c) => c.ancestors.includes(category!._id) && !sameTypes(c.storeTypes ?? [], storeTypes));
        await Promise.all(stale.map((c) => api.patch(`/admin/categories/${c._id}`, { storeTypes })));
        return saved;
      } catch (e) {
        return localizeCategoryError(e);
      }
    },
    success: (v) => ({ title: editing ? "تم حفظ التصنيف" : "تمت إضافة التصنيف", description: v.nameAr }),
    failure: "لم يتم حفظ التصنيف",
    invalidate: [["categories"], ["category-template"]],
    onDone: () => {
      reset();
      onOpenChange(false);
    },
  });

  const onInvalid = (e: FieldErrors<CategoryValues>) => {
    // Show the tab with the first problem.
    const detailsBad = Object.keys(e).some((k) => k !== "template");
    setTab(detailsBad ? "details" : "template");
  };
  const submit = handleSubmit(
    (v) =>
      save.mutate(categorySchema.parse(v), {
        onError: (e) => {
          if (!(e instanceof ApiError)) return;
          if (e.code === "INVALID_PARENT" || e.code === "TOO_DEEP" || e.code === "INVALID_CATEGORY") {
            setTab("details");
            setError("parentId", { message: e.message });
          }
          if (e.code === "INVALID_TEMPLATE") setTab("template");
          if (e.code === "DUPLICATE") setError("slug", { message: "الرابط ده مستخدم لتصنيف تاني" });
        },
      }),
    onInvalid,
  );

  const tabClass =
    "relative h-10 px-1 text-ui text-ink-2 transition-colors hover:text-ink data-[state=active]:font-semibold data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-brand";
  const templateErrors = !!errors.template;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={editing ? `تعديل تصنيف ${category!.nameAr}` : parent ? `تصنيف جديد تحت ${parent.nameAr}` : "قسم رئيسي جديد"}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={save.isPending}>
            إلغاء
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {editing ? "حفظ التعديلات" : "إضافة التصنيف"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <Tabs.Root value={tab} onValueChange={setTab} dir="rtl">
          <Tabs.List aria-label="أجزاء التصنيف" className="mb-5 flex gap-6 border-b border-line">
            <Tabs.Trigger value="details" className={tabClass}>
              البيانات
            </Tabs.Trigger>
            <Tabs.Trigger value="template" className={cn(tabClass, "flex items-center gap-1.5")}>
              قالب المنتج
              {templateErrors && <span aria-label="فيه أخطاء" className="size-2 rounded-full bg-danger" />}
            </Tabs.Trigger>
          </Tabs.List>

          {/* forceMount keeps both halves registered, so validation sees every field. */}
          <Tabs.Content value="details" forceMount className="grid gap-4 data-[state=inactive]:hidden sm:grid-cols-2">
            <Field label="الاسم بالعربية" error={errors.nameAr?.message}>{(a) => <Input {...a} {...register("nameAr")} />}</Field>
            <Field label="الاسم بالإنجليزية" error={errors.nameEn?.message}>
              {(a) => (
                <Input
                  {...a}
                  {...register("nameEn", {
                    onChange: (e) => {
                      // Suggest a slug from the English name while creating; children carry their parent's prefix.
                      if (editing) return;
                      const own = e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                      setValue("slug", parent && own ? `${parent.slug}-${own}` : own);
                    },
                  })}
                  dir="ltr"
                  className="text-start"
                />
              )}
            </Field>
            <Field label="الرابط (slug)" hint="لازم يكون مختلف عن كل التصنيفات" error={errors.slug?.message}>
              {(a) => <Input {...a} {...register("slug")} dir="ltr" className="text-start" />}
            </Field>
            <Field label="ترتيب العرض" hint="الأصغر يظهر أولًا بين إخواته" error={errors.sortOrder?.message}>
              {(a) => <Input {...a} {...register("sortOrder")} type="number" inputMode="numeric" dir="ltr" className="text-start" />}
            </Field>
            <div className="sm:col-span-2">
              <Field label="تابع لـ" hint="اتركه فارغًا ليكون قسمًا رئيسيًا. الشجرة 3 مستويات بالكتير." error={errors.parentId?.message}>
                {(a) => (
                  <select {...a} {...register("parentId")} className={select}>
                    <option value="">بدون (قسم رئيسي)</option>
                    {parents.map((p) => (
                      <option key={p._id} value={p._id} disabled={!p.isActive}>
                        {pathName(p, byId)}
                        {!p.isActive ? " (مخفي)" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <Field label="الأيقونة" hint={parent ? "بتظهر للأقسام الرئيسية بس، فمش هتفرق هنا." : "اسم أيقونة من lucide.dev بالإنجليزي، زي shirt أو sofa."} error={errors.icon?.message}>
              {(a) => (
                <div className="flex items-center gap-2">
                  <Input {...a} {...register("icon")} dir="ltr" className="text-start" placeholder="shirt" autoComplete="off" spellCheck={false} />
                  <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-sm border border-line bg-sunken text-accent">
                    {icon?.trim() ? (
                      <DynamicIcon name={icon.trim() as IconName} className="size-5" fallback={() => <FolderTree className="size-5 text-ink-3" />} />
                    ) : (
                      <FolderTree className="size-5 text-ink-3" />
                    )}
                  </span>
                </div>
              )}
            </Field>
            <div />
            {root ? (
              <div className="flex items-start gap-2 rounded-sm bg-sunken px-3 py-2.5 text-ui text-ink-2 sm:col-span-2">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <div>
                  <p>
                    بيظهر لنفس أنواع المتاجر بتاعة «{root.nameAr}»: {" "}
                    {root.storeTypes?.length ? (
                      <span className="inline-flex flex-wrap gap-1 align-middle">
                        {root.storeTypes.map((t) => (
                          <Badge key={t}>{STORE_TYPE[t]?.plural ?? t}</Badge>
                        ))}
                      </span>
                    ) : (
                      "كل الأنواع"
                    )}
                  </p>
                  <p className="mt-0.5 text-meta text-ink-3">تقدر تغيّرها من القسم الرئيسي، وبتتطبق على كل اللي تحته.</p>
                </div>
              </div>
            ) : (
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-ui text-ink-2">يظهر لأنواع المتاجر</legend>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STORE_TYPE).map(([value, t]) => (
                    <label key={value} className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 text-ui has-[:checked]:border-brand has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
                      <input type="checkbox" value={value} {...register("storeTypes")} className="accent-[var(--accent)]" />
                      {t.plural}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-meta text-ink-3">لو مفيش اختيار، القسم يظهر لكل الأنواع. التصنيفات اللي تحته بتاخد نفس الاختيار.</p>
              </fieldset>
            )}
          </Tabs.Content>

          <Tabs.Content value="template" forceMount className="data-[state=inactive]:hidden">
            <TemplateEditor
              form={form}
              topLevel={!parentId}
              inherited={parentId ? inherited.data : DEFAULT_RESOLVED}
              inheritedPending={!!parentId && inherited.isPending}
              presets={presets.data}
            />
            {inherited.error && <p className="mt-3 text-meta text-danger">مقدرناش نجيب قالب الأب، بس تقدر تحفظ عادي.</p>}
          </Tabs.Content>
        </Tabs.Root>
      </form>
    </Dialog>
  );
}
