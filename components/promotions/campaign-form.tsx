"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { Campaign } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { fromLocalInput, toLocalInput } from "./promo-status";

const DEFAULT_COLOR = "#F16B21";
const HEX = /^#[0-9a-fA-F]{6}$/;

const schema = z
  .object({
    nameAr: z.string().trim().min(2, "الاسم قصير جدًا").max(60, "60 حرف كحد أقصى"),
    slug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "من 2 لـ 40: حروف إنجليزية صغيرة وأرقام و - بس"),
    descriptionAr: z.string().trim().max(300, "300 حرف كحد أقصى"),
    startsAt: z.string(),
    endsAt: z.string(),
    minPercent: z.string(),
    color: z.string().trim().regex(HEX, "لون بصيغة #RRGGBB"),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const min = Number(v.minPercent);
    if (!v.minPercent.trim() || !Number.isInteger(min) || min < 1 || min > 90) issue("minPercent", "رقم صحيح من 1 لـ 90");
    const starts = fromLocalInput(v.startsAt);
    const ends = fromLocalInput(v.endsAt);
    if (!starts) issue("startsAt", "اختار تاريخ البداية");
    if (!ends) issue("endsAt", "اختار تاريخ النهاية");
    else if (starts && new Date(ends).getTime() <= new Date(starts).getTime()) issue("endsAt", "النهاية لازم تكون بعد البداية");
  });
type Values = z.infer<typeof schema>;

function initialValues(c: Campaign | null): Values {
  if (c)
    return {
      nameAr: c.nameAr,
      slug: c.slug,
      descriptionAr: c.descriptionAr ?? "",
      startsAt: toLocalInput(c.startsAt),
      endsAt: toLocalInput(c.endsAt),
      minPercent: String(c.minPercent),
      color: HEX.test(c.color) ? c.color.toUpperCase() : DEFAULT_COLOR,
      isActive: c.isActive,
    };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  end.setHours(23, 59, 0, 0);
  return { nameAr: "", slug: "", descriptionAr: "", startsAt: toLocalInput(start), endsAt: toLocalInput(end), minPercent: "10", color: DEFAULT_COLOR, isActive: true };
}

export function CampaignFormDialog({ campaign, open, onOpenChange }: { campaign: Campaign | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const editing = !!campaign;
  // Fresh defaults each time the dialog opens; stable while it is open so typing is never reset.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaults = useMemo(() => initialValues(campaign), [campaign, open]);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), values: defaults });
  const color = useWatch({ control, name: "color" });
  const isActive = useWatch({ control, name: "isActive" });

  const save = useAction({
    run: (v: Values) => {
      const body = {
        nameAr: v.nameAr,
        slug: v.slug,
        descriptionAr: v.descriptionAr,
        startsAt: fromLocalInput(v.startsAt),
        endsAt: fromLocalInput(v.endsAt),
        minPercent: Number(v.minPercent),
        color: v.color.toUpperCase(),
        isActive: v.isActive,
      };
      return editing ? api.patch<Campaign>(`/admin/campaigns/${campaign!._id}`, body) : api.post<Campaign>("/admin/campaigns", body);
    },
    success: (v) => ({ title: editing ? "تم حفظ الموسم" : "تمت إضافة الموسم", description: v.nameAr }),
    failure: "لم يتم حفظ الموسم",
    invalidate: [qk.campaigns],
    onDone: () => {
      reset();
      onOpenChange(false);
    },
  });

  const submit = handleSubmit((v) =>
    save.mutate(v, {
      onError: (e) => {
        if (!(e instanceof ApiError)) return;
        if (e.code === "CAMPAIGN_SLUG_TAKEN") setError("slug", { message: "الرابط ده مستخدم لموسم تاني" });
        if (e.code === "INVALID_DATES") setError("endsAt", { message: e.message });
      },
    }),
  );

  const swatch = HEX.test(color ?? "") ? color : DEFAULT_COLOR;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `تعديل موسم ${campaign!.nameAr}` : "موسم عروض جديد"}
      description="المتاجر بتشترك في الموسم لما تعمل خصم على منتجاتها جوه فترته، بنسبة مش أقل من الحد اللي هنا."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={save.isPending}>
            إلغاء
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {editing ? "حفظ التعديلات" : "إضافة الموسم"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم الموسم" hint="مثل «الجمعة البيضاء» أو «عروض رمضان»" error={errors.nameAr?.message}>
          {(a) => <Input {...a} {...register("nameAr")} maxLength={60} />}
        </Field>
        <Field label="الرابط (slug)" hint="حروف إنجليزية صغيرة وأرقام و -، مثل white-friday-2026" error={errors.slug?.message}>
          {(a) => (
            <Input
              {...a}
              {...register("slug", { onChange: (e) => setValue("slug", e.target.value.toLowerCase().replace(/\s+/g, "-")) })}
              dir="ltr"
              maxLength={40}
              autoComplete="off"
              placeholder="white-friday-2026"
              className="num text-start"
            />
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label="وصف قصير" hint="اختياري، بيظهر للعملاء في صفحة الموسم (300 حرف)" error={errors.descriptionAr?.message}>
            {(a) => <Textarea {...a} {...register("descriptionAr")} rows={2} maxLength={300} className="min-h-20" />}
          </Field>
        </div>
        <Field label="يبدأ من" error={errors.startsAt?.message}>
          {(a) => <Input {...a} {...register("startsAt")} type="datetime-local" dir="ltr" className="num text-start" />}
        </Field>
        <Field label="ينتهي في" error={errors.endsAt?.message}>
          {(a) => <Input {...a} {...register("endsAt")} type="datetime-local" dir="ltr" className="num text-start" />}
        </Field>
        <Field label="أقل نسبة خصم (%)" hint="المنتج يدخل الموسم لو خصمه بالنسبة دي أو أكتر (1–90)" error={errors.minPercent?.message}>
          {(a) => <Input {...a} {...register("minPercent")} type="number" inputMode="numeric" min={1} max={90} step={1} dir="ltr" className="num text-start" />}
        </Field>
        <Field label="لون الموسم" hint="بيظهر بيه الموسم في التطبيق" error={errors.color?.message}>
          {(a) => (
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="اختيار اللون"
                value={swatch}
                onChange={(e) => setValue("color", e.target.value.toUpperCase(), { shouldValidate: true })}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-sm border border-line-strong bg-surface p-1"
              />
              <Input {...a} {...register("color")} dir="ltr" maxLength={7} className="num text-start uppercase" />
            </div>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Checkbox checked={!!isActive} onCheckedChange={(c) => setValue("isActive", c)}>
            مفعّل — الموسم يظهر للعملاء في فترته
          </Checkbox>
        </div>
      </form>
    </Dialog>
  );
}
