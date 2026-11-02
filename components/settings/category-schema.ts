import { z } from "zod";
import type { Category, CategoryTemplate, ResolvedTemplate, SpecDef } from "@/lib/api/types";

/**
 * Category form values. The template part mirrors the API's CategoryTemplateDto, but each axis
 * carries a `mode` so "inherit" (field left out) and "off" (null) can both be chosen.
 */
const mode = z.enum(["inherit", "custom", "none"]);
export type AxisMode = z.infer<typeof mode>;

const spec = z
  .object({
    labelAr: z.string().trim().min(1, "اكتب اسم المواصفة").max(40, "40 حرف بالكتير"),
    key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,30}$/, "حروف إنجليزية صغيرة وأرقام و _، تبدأ بحرف (2–31 حرف)"),
    type: z.enum(["text", "number", "select", "boolean"]),
    options: z.array(z.string().max(40, "الاختيار 40 حرف بالكتير")).max(60, "60 اختيار بالكتير"),
    unit: z.string().trim().max(15, "15 حرف بالكتير"),
    required: z.boolean(),
    filterable: z.boolean(),
  })
  .superRefine((s, ctx) => {
    if (s.type === "select" && !s.options.length) ctx.addIssue({ code: "custom", path: ["options"], message: "الاختيار من قائمة محتاج اختيار واحد على الأقل" });
  });

const template = z
  .object({
    size: z.object({
      mode,
      label: z.string().trim(),
      preset: z.string(),
      values: z.array(z.string().max(30, "القيمة 30 حرف بالكتير")).max(60, "60 قيمة بالكتير"),
      allowCustom: z.boolean(),
    }),
    color: z.object({ mode, label: z.string().trim(), allowCustom: z.boolean() }),
    specs: z.array(spec).max(30, "30 مواصفة بالكتير"),
    units: z.array(z.string()).max(20, "20 وحدة بالكتير"),
    sizeGuide: z.string().max(3000, "3000 حرف بالكتير"),
  })
  .superRefine((t, ctx) => {
    for (const axis of ["size", "color"] as const) {
      const label = t[axis].label;
      if (t[axis].mode === "custom" && (label.length < 1 || label.length > 20)) {
        ctx.addIssue({ code: "custom", path: [axis, "label"], message: "اسم من 1 لـ 20 حرف" });
      }
    }
    const seen = new Map<string, number>();
    t.specs.forEach((s, i) => {
      const key = s.key.trim();
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["specs", i, "key"], message: `نفس مفتاح المواصفة رقم ${seen.get(key)! + 1}` });
      else seen.set(key, i);
    });
  });

export const categorySchema = z.object({
  nameAr: z.string().trim().min(2, "الاسم قصير جدًا").max(60),
  nameEn: z.string().trim().min(2, "الاسم قصير جدًا").max(60),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,60}$/, "حروف إنجليزية صغيرة وأرقام و - فقط"),
  parentId: z.string(),
  icon: z.string().trim().max(60, "60 حرف بالكتير"),
  sortOrder: z.coerce.number({ message: "أدخل رقمًا" }).int().min(0),
  // Unchecked boxes give false; nothing ticked = offered to every store type.
  storeTypes: z.union([z.array(z.string()), z.literal(false), z.string()]).transform((v) => (v === false ? [] : typeof v === "string" ? [v] : v)),
  template,
});
export type CategoryValues = z.input<typeof categorySchema>;
export type TemplateValues = CategoryValues["template"];
export type SpecValues = TemplateValues["specs"][number];

export const emptySpec = (): SpecValues => ({ labelAr: "", key: "", type: "text", options: [], unit: "", required: false, filterable: false });

export function specToValues(s: SpecDef): SpecValues {
  return { labelAr: s.labelAr, key: s.key, type: s.type, options: s.options ?? [], unit: s.unit ?? "", required: !!s.required, filterable: !!s.filterable };
}

/** Form state for a stored template: anything the category doesn't set shows as "inherit". */
export function templateToValues(t: CategoryTemplate | null): TemplateValues {
  const size = t?.size;
  const color = t?.color;
  return {
    size: {
      mode: size === undefined ? "inherit" : size === null ? "none" : "custom",
      label: size?.label ?? "",
      preset: size?.preset ?? "",
      values: size?.values ?? [],
      allowCustom: size?.allowCustom ?? true,
    },
    color: { mode: color === undefined ? "inherit" : color === null ? "none" : "custom", label: color?.label ?? "", allowCustom: color?.allowCustom ?? true },
    specs: (t?.specs ?? []).map(specToValues),
    units: t?.units ?? [],
    sizeGuide: t?.sizeGuide ?? "",
  };
}

/** What the API stores: only the fields the admin set; null when everything is inherited. */
export function valuesToTemplate(v: TemplateValues): CategoryTemplate | null {
  const out: CategoryTemplate = {};
  if (v.size.mode === "none") out.size = null;
  else if (v.size.mode === "custom") {
    out.size = {
      label: v.size.label.trim(),
      ...(v.size.preset ? { preset: v.size.preset } : {}),
      ...(v.size.values.length ? { values: v.size.values } : {}),
      allowCustom: v.size.allowCustom,
    };
  }
  if (v.color.mode === "none") out.color = null;
  else if (v.color.mode === "custom") out.color = { label: v.color.label.trim(), allowCustom: v.color.allowCustom };
  if (v.specs.length) {
    out.specs = v.specs.map((s) => ({
      key: s.key.trim(),
      labelAr: s.labelAr.trim(),
      type: s.type,
      ...(s.type === "select" ? { options: s.options } : {}),
      ...(s.type === "number" && s.unit.trim() ? { unit: s.unit.trim() } : {}),
      ...(s.required ? { required: true } : {}),
      ...(s.filterable ? { filterable: true } : {}),
    }));
  }
  if (v.units.length) out.units = v.units;
  if (v.sizeGuide.trim()) out.sizeGuide = v.sizeGuide.trim();
  return Object.keys(out).length ? out : null;
}

export function categoryToValues(c: Category | null, parentId: string | null): CategoryValues {
  return c
    ? {
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        slug: c.slug,
        parentId: c.parentId ?? "",
        icon: c.icon ?? "",
        sortOrder: c.sortOrder,
        storeTypes: c.storeTypes ?? [],
        template: templateToValues(c.template),
      }
    : { nameAr: "", nameEn: "", slug: "", parentId: parentId ?? "", icon: "", sortOrder: 0, storeTypes: [], template: templateToValues(null) };
}

/** What a top-level category starts from (the API's defaults before any template). */
export const DEFAULT_RESOLVED: ResolvedTemplate = {
  size: { label: "المقاس", values: [], allowCustom: true },
  color: { label: "اللون", allowCustom: true },
  specs: [],
  units: ["قطعة"],
  sizeGuide: null,
  wholesale: "optional",
};
