"use client";

import { ArrowDown, ArrowUp, Info, Plus, Star, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import type { CategoryPresets, ResolvedTemplate, SpecType } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/ui/tag-input";
import { emptySpec, specToValues, type AxisMode, type CategoryValues } from "./category-schema";

const SPEC_TYPES: Record<SpecType, string> = {
  text: "نص",
  number: "رقم",
  select: "اختيار من قائمة",
  boolean: "آه / لأ",
};
const select =
  "h-11 w-full rounded-sm border border-line-strong bg-surface px-3 text-body text-ink focus:border-accent focus:outline-none";

/** "XS، S، M … 5XL" — short enough for a hint line. */
function preview(values: string[]) {
  return values.length > 6 ? `${values.slice(0, 3).join("، ")} … ${values.at(-1)}` : values.join("، ");
}

function sizeText(s: ResolvedTemplate["size"]) {
  if (!s) return "مفيش";
  if (!s.values.length) return `${s.label} (المتجر بيكتبه)`;
  return `${s.label} — ${preview(s.values)}${s.allowCustom ? " + كتابة حرة" : ""}`;
}

/** Where a value comes from: the parent's resolved template, or the platform default for a top level. */
function Inherited({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-meta text-ink-3">
      <span>{label}:</span>
      <span className="text-ink-2">{children}</span>
    </p>
  );
}

function ModeSwitch({ value, onChange, inheritLabel, name }: { value: AxisMode; onChange: (m: AxisMode) => void; inheritLabel: string; name: string }) {
  const options: { v: AxisMode; label: string }[] = [
    { v: "inherit", label: inheritLabel },
    { v: "custom", label: "مخصص" },
    { v: "none", label: "مفيش" },
  ];
  return (
    <div role="radiogroup" aria-label={name} className="inline-flex rounded-sm border border-line bg-sunken p-1 text-ui">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn("h-8 rounded-sm px-3", value === o.v ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-3 hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-meta text-ink-3">{description}</p>}
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/**
 * Edits a category's own product template. Every part starts as "inherit"; the hints show what
 * the parent (or the platform default, for a top level) gives when it is left alone.
 */
export function TemplateEditor({
  form,
  inherited,
  inheritedPending,
  presets,
  topLevel,
}: {
  form: UseFormReturn<CategoryValues>;
  inherited: ResolvedTemplate | undefined;
  inheritedPending: boolean;
  presets: CategoryPresets | undefined;
  topLevel: boolean;
}) {
  const { control, register, setValue, formState } = form;
  const errors = formState.errors.template;
  const from = topLevel ? "الافتراضي" : "موروث من الأب";
  const inheritLabel = topLevel ? "الافتراضي" : "زي الأب";
  const sizeMode = useWatch({ control, name: "template.size.mode" });
  const preset = useWatch({ control, name: "template.size.preset" });
  const colorMode = useWatch({ control, name: "template.color.mode" });
  const units = useWatch({ control, name: "template.units" });
  const specValues = useWatch({ control, name: "template.specs" });
  const specs = useFieldArray({ control, name: "template.specs" });
  const ownKeys = new Set(specValues.map((s) => s.key.trim()));
  const inheritedByKey = new Map((inherited?.specs ?? []).map((s) => [s.key, s]));

  const hint = (node: React.ReactNode) =>
    inheritedPending ? <Skeleton className="h-4 w-48" /> : inherited ? <Inherited label={from}>{node}</Inherited> : null;

  const setSizeMode = (m: AxisMode) => {
    setValue("template.size.mode", m, { shouldDirty: true });
    // Start a custom axis from what is inherited, so the admin only changes the difference.
    if (m === "custom" && !form.getValues("template.size.label")) {
      setValue("template.size.label", inherited?.size?.label ?? "المقاس");
      setValue("template.size.preset", inherited?.size?.preset ?? "");
      setValue("template.size.allowCustom", inherited?.size?.allowCustom ?? true);
    }
  };
  const setColorMode = (m: AxisMode) => {
    setValue("template.color.mode", m, { shouldDirty: true });
    if (m === "custom" && !form.getValues("template.color.label")) {
      setValue("template.color.label", inherited?.color?.label ?? "اللون");
      setValue("template.color.allowCustom", inherited?.color?.allowCustom ?? true);
    }
  };
  const setUnits = (next: string[]) => setValue("template.units", next, { shouldDirty: true, shouldValidate: true });

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-sm bg-sunken px-3 py-2.5 text-meta text-ink-2">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
        القالب هو اللي المتجر بيملاه وهو بينزّل منتج هنا. اكتب بس اللي مختلف عن {topLevel ? "الافتراضي" : "التصنيف الأب"} — أي حاجة تسيبها «{inheritLabel}» بتتورث، والتصنيفات اللي تحت ده بتورث منه.
      </p>

      <Section title="المقاس / السعة" description="اسم الاختيار التاني في الألوان والمقاسات: المقاس، المساحة، الحجم، الوزن…" action={<ModeSwitch name="المقاس" value={sizeMode} onChange={setSizeMode} inheritLabel={inheritLabel} />}>
        {hint(sizeText(inherited?.size ?? null))}
        {sizeMode === "none" && <p className="text-meta text-ink-3">المنتجات هنا مش هيبقى ليها مقاس خالص.</p>}
        {sizeMode === "custom" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسمه" hint="زي: المقاس، السعة، المساحة" error={errors?.size?.label?.message}>
              {(a) => <Input {...a} {...register("template.size.label")} maxLength={20} />}
            </Field>
            <Field label="قائمة جاهزة" hint="اختيارية — تقدر تكتب القيم بنفسك">
              {(a) => (
                <select {...a} {...register("template.size.preset")} className={select}>
                  <option value="">بدون قائمة</option>
                  {Object.entries(presets?.sizes ?? {}).map(([key, p]) => (
                    <option key={key} value={key}>
                      {p.labelAr}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {preset && presets?.sizes[preset] && (
              <div className="flex flex-wrap gap-1 sm:col-span-2" aria-label="قيم القائمة الجاهزة">
                {presets.sizes[preset].values.map((v) => (
                  <Badge key={v}>{v}</Badge>
                ))}
              </div>
            )}
            <div className="sm:col-span-2">
              <Field label={preset ? "قيم زيادة" : "القيم"} hint={preset ? "بتتضاف بعد القائمة الجاهزة. Enter بعد كل قيمة." : "Enter بعد كل قيمة."} error={errors?.size?.values?.message}>
                {(a) => (
                  <Controller
                    control={control}
                    name="template.size.values"
                    render={({ field }) => <TagInput id={a.id} describedBy={a["aria-describedby"]} invalid={a["aria-invalid"]} value={field.value} onChange={field.onChange} maxLength={30} placeholder="مثلًا: 128GB" />}
                  />
                )}
              </Field>
            </div>
            <Controller
              control={control}
              name="template.size.allowCustom"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} className="sm:col-span-2">
                  المتجر يقدر يكتب قيمة مش في القائمة
                </Switch>
              )}
            />
          </div>
        )}
      </Section>

      <Section title="اللون" action={<ModeSwitch name="اللون" value={colorMode} onChange={setColorMode} inheritLabel={inheritLabel} />}>
        {hint(inherited?.color ? `${inherited.color.label}${inherited.color.allowCustom ? " (كتابة حرة)" : ""}` : "مفيش")}
        {colorMode === "none" && <p className="text-meta text-ink-3">المنتجات هنا مش هيبقى ليها ألوان.</p>}
        {colorMode === "custom" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسمه" hint="زي: اللون، اللون/النقشة" error={errors?.color?.label?.message}>
              {(a) => <Input {...a} {...register("template.color.label")} maxLength={20} />}
            </Field>
            <Controller
              control={control}
              name="template.color.allowCustom"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} className="self-end pb-2.5">
                  المتجر يكتب اللون بنفسه
                </Switch>
              )}
            />
          </div>
        )}
      </Section>

      <Section
        title="المواصفات"
        description="حقول زيادة للمنتج (الخامة، الضمان…). مفتاح زي مفتاح في الأب بيغيّر المواصفة الموروثة."
        action={
          <Button size="sm" onClick={() => specs.append(emptySpec())} disabled={specs.fields.length >= 30}>
            <Plus aria-hidden className="size-4" />
            مواصفة
          </Button>
        }
      >
        {inheritedPending ? (
          <Skeleton className="h-6 w-64" />
        ) : inherited?.specs.length ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-meta text-ink-3">{from} — دوس على واحدة عشان تعدّلها هنا:</p>
            <div className="flex flex-wrap gap-1.5">
              {inherited.specs.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  disabled={ownKeys.has(s.key)}
                  onClick={() => specs.append(specToValues(s))}
                  title={ownKeys.has(s.key) ? "متعدّلة هنا" : "تعديلها في التصنيف ده"}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-meta",
                    ownKeys.has(s.key) ? "border-line text-ink-3 line-through" : "border-line-strong text-ink-2 hover:border-accent hover:text-accent",
                  )}
                >
                  {s.labelAr}
                  <span dir="ltr" className="num text-ink-3">
                    {s.key}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          !topLevel && inherited && <p className="text-meta text-ink-3">الأب مفيهوش مواصفات.</p>
        )}
        {specs.fields.map((f, i) => {
          const type = specValues[i]?.type ?? "text";
          const e = errors?.specs?.[i];
          const overrides = inheritedByKey.get(specValues[i]?.key.trim() ?? "");
          return (
            <div key={f.id} className="rounded-sm border border-line bg-sunken/40 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-meta font-semibold text-ink-2">
                  مواصفة <span className="num">{i + 1}</span>
                  {overrides && <Badge tone="warning">بتغيّر «{overrides.labelAr}» الموروثة</Badge>}
                </span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" aria-label="لفوق" disabled={i === 0} onClick={() => specs.move(i, i - 1)} className="px-2">
                    <ArrowUp aria-hidden className="size-4" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="لتحت" disabled={i === specs.fields.length - 1} onClick={() => specs.move(i, i + 1)} className="px-2">
                    <ArrowDown aria-hidden className="size-4" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="شيل المواصفة" onClick={() => specs.remove(i)} className="px-2 text-danger hover:bg-danger-soft hover:text-danger">
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="الاسم" error={e?.labelAr?.message}>
                  {(a) => <Input {...a} {...register(`template.specs.${i}.labelAr`)} maxLength={40} placeholder="الخامة" />}
                </Field>
                <Field label="المفتاح (key)" hint="إنجليزي صغير و _ زي: material" error={e?.key?.message}>
                  {(a) => <Input {...a} {...register(`template.specs.${i}.key`)} dir="ltr" className="text-start" maxLength={31} autoComplete="off" spellCheck={false} />}
                </Field>
                <Field label="النوع">
                  {(a) => (
                    <select {...a} {...register(`template.specs.${i}.type`)} className={select}>
                      {Object.entries(SPEC_TYPES).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                {type === "select" && (
                  <div className="sm:col-span-3">
                    <Field label="الاختيارات" hint="Enter بعد كل اختيار" error={e?.options?.message}>
                      {(a) => (
                        <Controller
                          control={control}
                          name={`template.specs.${i}.options`}
                          render={({ field }) => <TagInput id={a.id} describedBy={a["aria-describedby"]} invalid={a["aria-invalid"]} value={field.value} onChange={field.onChange} maxLength={40} placeholder="قطن، كتان…" />}
                        />
                      )}
                    </Field>
                  </div>
                )}
                {type === "number" && (
                  <Field label="الوحدة" hint="اختيارية: شهر، لتر، كجم" error={e?.unit?.message}>
                    {(a) => <Input {...a} {...register(`template.specs.${i}.unit`)} maxLength={15} />}
                  </Field>
                )}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:col-span-3">
                  <Controller
                    control={control}
                    name={`template.specs.${i}.required`}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange}>
                        مطلوبة قبل النشر
                      </Switch>
                    )}
                  />
                  <Controller
                    control={control}
                    name={`template.specs.${i}.filterable`}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange}>
                        العميل يفلتر بيها
                      </Switch>
                    )}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {errors?.specs?.message && <p className="text-meta text-danger">{errors.specs.message}</p>}
        <p className="text-meta text-ink-3">المعارض بيتضاف لها تلقائيًا الحالة والضمان والتوصيل والتركيب، فمش محتاج تكتبهم.</p>
      </Section>

      <Section title="وحدات البيع" description="فاضية = زي الأب. أول وحدة هي الافتراضية.">
        {hint(
          (inherited?.units ?? []).map((u, i) => (
            <span key={u}>
              {i > 0 && "، "}
              {u}
              {i === 0 && " (الافتراضية)"}
            </span>
          )),
        )}
        {units.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="الوحدات المختارة">
            {units.map((u, i) => (
              <span key={u} className="inline-flex h-8 items-center gap-1 rounded-full border border-accent bg-accent-soft ps-3 pe-1 text-ui text-accent">
                {u}
                {i === 0 ? (
                  <span className="pe-2 text-meta">· الافتراضية</span>
                ) : (
                  <button type="button" aria-label={`خلّي ${u} الافتراضية`} title="خليها الافتراضية" onClick={() => setUnits([u, ...units.filter((x) => x !== u)])} className="grid size-6 place-items-center rounded-full hover:bg-surface">
                    <Star aria-hidden className="size-3.5" />
                  </button>
                )}
                <button type="button" aria-label={`شيل ${u}`} onClick={() => setUnits(units.filter((x) => x !== u))} className="grid size-6 place-items-center rounded-full hover:bg-surface">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(presets?.units ?? []).filter((u) => !units.includes(u)).map((u) => (
            <button key={u} type="button" onClick={() => setUnits([...units, u])} disabled={units.length >= 20} className="h-8 rounded-full border border-line-strong px-3 text-ui text-ink-2 hover:border-accent hover:text-accent disabled:opacity-50">
              + {u}
            </button>
          ))}
        </div>
        {errors?.units?.message && <p className="text-meta text-danger">{errors.units.message}</p>}
      </Section>

      <Section title="دليل المقاسات" description="جدول مقاسات أو طريقة القياس، بتظهر للعميل في صفحة المنتج. فاضي = زي الأب.">
        {hint(inherited?.sizeGuide ? `${inherited.sizeGuide.slice(0, 80)}${inherited.sizeGuide.length > 80 ? "…" : ""}` : "مفيش")}
        <Field label="الدليل" error={errors?.sizeGuide?.message}>
          {(a) => <Textarea {...a} {...register("template.sizeGuide")} maxLength={3000} rows={4} />}
        </Field>
      </Section>
    </div>
  );
}
