"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/api/use-action";
import type { Category } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { STORE_TYPE } from "@/components/ui/badge";

const schema = z.object({
  nameAr: z.string().trim().min(2, "الاسم قصير جدًا").max(60),
  nameEn: z.string().trim().min(2, "الاسم قصير جدًا").max(60),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,60}$/, "حروف إنجليزية صغيرة وأرقام و - فقط"),
  parentId: z.string().optional(),
  sortOrder: z.coerce.number({ message: "أدخل رقمًا" }).int().min(0),
  // Unchecked boxes give false; nothing ticked = offered to every store type.
  storeTypes: z.union([z.array(z.string()), z.literal(false), z.string()]).transform((v) => (v === false ? [] : typeof v === "string" ? [v] : v)),
});
type Values = z.input<typeof schema>;

export function CategoryFormDialog({
  category,
  categories,
  open,
  onOpenChange,
}: {
  category: Category | null;
  categories: Category[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const editing = !!category;
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: category
      ? { nameAr: category.nameAr, nameEn: category.nameEn, slug: category.slug, parentId: category.parentId ?? "", sortOrder: category.sortOrder, storeTypes: category.storeTypes ?? [] }
      : { nameAr: "", nameEn: "", slug: "", parentId: "", sortOrder: 0, storeTypes: [] },
  });

  const save = useAction({
    run: (v: z.output<typeof schema>) => {
      const body = { nameAr: v.nameAr, nameEn: v.nameEn, slug: v.slug, sortOrder: v.sortOrder, storeTypes: v.storeTypes, ...(v.parentId ? { parentId: v.parentId } : {}) };
      return editing ? api.patch(`/admin/categories/${category!._id}`, body) : api.post("/admin/categories", body);
    },
    success: editing ? "تم حفظ التصنيف" : "تمت إضافة التصنيف",
    failure: "لم يتم حفظ التصنيف",
    invalidate: [["categories"]],
    onDone: () => {
      reset();
      onOpenChange(false);
    },
  });
  const submit = handleSubmit((v) => save.mutate(schema.parse(v)));
  const parents = categories.filter((c) => !c.parentId && c._id !== category?._id);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `تعديل تصنيف ${category!.nameAr}` : "تصنيف جديد"}
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
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم بالعربية" error={errors.nameAr?.message}>{(a) => <Input {...a} {...register("nameAr")} />}</Field>
        <Field label="الاسم بالإنجليزية" error={errors.nameEn?.message}>
          {(a) => (
            <Input
              {...a}
              {...register("nameEn", {
                onChange: (e) => {
                  // Suggest a slug from the English name while creating.
                  if (!editing) setValue("slug", e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                },
              })}
              dir="ltr"
              className="text-start"
            />
          )}
        </Field>
        <Field label="الرابط (slug)" error={errors.slug?.message}>{(a) => <Input {...a} {...register("slug")} dir="ltr" className="text-start" />}</Field>
        <Field label="ترتيب العرض" hint="الأصغر يظهر أولًا" error={errors.sortOrder?.message}>
          {(a) => <Input {...a} {...register("sortOrder")} type="number" inputMode="numeric" dir="ltr" className="text-start" />}
        </Field>
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
          <p className="mt-1 text-meta text-ink-3">لو مفيش اختيار، القسم يظهر لكل الأنواع.</p>
        </fieldset>
        <div className="sm:col-span-2">
          <Field label="تصنيف رئيسي" hint="اتركه فارغًا ليكون تصنيفًا رئيسيًا">
            {(a) => (
              <select {...a} {...register("parentId")} className="h-11 w-full rounded-sm border border-line-strong bg-surface px-3 text-body text-ink focus:border-accent focus:outline-none">
                <option value="">بدون (تصنيف رئيسي)</option>
                {parents.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.nameAr}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
