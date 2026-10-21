"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { AdminCoupon, CouponType } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { chip, fromLocalInput, toLocalInput } from "./promo-status";

// Inputs are kept as strings (empty = not set); the rules below match the API's.
const schema = z
  .object({
    code: z.string().trim(),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.string(),
    maxDiscount: z.string(),
    minSubtotal: z.string(),
    maxUses: z.string(),
    perUserLimit: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const num = (s: string) => (s.trim() === "" ? null : Number(s));

    if (!/^[A-Za-z0-9_-]{3,20}$/.test(v.code)) issue("code", "من 3 لـ 20 حرف: حروف إنجليزية وأرقام و _ و - بس");

    const value = num(v.value);
    if (value === null || Number.isNaN(value)) issue("value", "اكتب قيمة الخصم");
    else if (v.type === "PERCENT" && (value < 1 || value > 90)) issue("value", "النسبة من 1 لـ 90%");
    else if (v.type === "FIXED" && value < 1) issue("value", "المبلغ 1 ج.م على الأقل");

    const cap = num(v.maxDiscount);
    if (v.type === "PERCENT" && cap !== null && (Number.isNaN(cap) || cap < 1)) issue("maxDiscount", "اكتب مبلغ 1 ج.م أو أكتر، أو سيبه فاضي");

    const min = num(v.minSubtotal);
    if (min !== null && (Number.isNaN(min) || min < 0)) issue("minSubtotal", "مبلغ صفر أو أكتر");

    const uses = num(v.maxUses);
    if (uses !== null && (Number.isNaN(uses) || !Number.isInteger(uses) || uses < 1)) issue("maxUses", "رقم صحيح 1 أو أكتر، أو سيبه فاضي لعدد مفتوح");

    const per = num(v.perUserLimit);
    if (per === null || Number.isNaN(per) || !Number.isInteger(per) || per < 1 || per > 100) issue("perUserLimit", "رقم صحيح من 1 لـ 100");

    const starts = fromLocalInput(v.startsAt);
    const ends = fromLocalInput(v.endsAt);
    if (v.startsAt && !starts) issue("startsAt", "تاريخ غير صحيح");
    if (!ends) issue("endsAt", "اختار تاريخ النهاية");
    else if (new Date(ends).getTime() <= new Date(starts ?? Date.now()).getTime()) issue("endsAt", "النهاية لازم تكون بعد البداية");
  });
type Values = z.infer<typeof schema>;

const blank = (n: number | null | undefined) => (n == null ? "" : String(n));

function initialValues(coupon: AdminCoupon | null): Values {
  if (coupon)
    return {
      code: coupon.code,
      type: coupon.type,
      value: String(coupon.value),
      maxDiscount: blank(coupon.maxDiscount),
      minSubtotal: blank(coupon.minSubtotal),
      maxUses: blank(coupon.maxUses),
      perUserLimit: String(coupon.perUserLimit),
      startsAt: toLocalInput(coupon.startsAt),
      endsAt: toLocalInput(coupon.endsAt),
      isActive: coupon.isActive,
    };
  const week = new Date(Date.now() + 7 * 86_400_000);
  week.setHours(23, 59, 0, 0);
  return {
    code: "",
    type: "PERCENT",
    value: "10",
    maxDiscount: "",
    minSubtotal: "0",
    maxUses: "",
    perUserLimit: "1",
    startsAt: toLocalInput(new Date()),
    endsAt: toLocalInput(week),
    isActive: true,
  };
}

export function CouponFormDialog({ coupon, open, onOpenChange }: { coupon: AdminCoupon | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const editing = !!coupon;
  // Fresh defaults each time the dialog opens; stable while it is open so typing is never reset.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaults = useMemo(() => initialValues(coupon), [coupon, open]);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), values: defaults });
  const type = useWatch({ control, name: "type" }) as CouponType;
  const isActive = useWatch({ control, name: "isActive" });

  const save = useAction({
    run: (v: Values) => {
      const optional = (s: string) => (s.trim() === "" ? null : Number(s));
      const body = {
        type: v.type,
        value: Number(v.value),
        maxDiscount: v.type === "PERCENT" ? optional(v.maxDiscount) : null,
        minSubtotal: optional(v.minSubtotal) ?? 0,
        maxUses: optional(v.maxUses),
        perUserLimit: Number(v.perUserLimit),
        ...(fromLocalInput(v.startsAt) ? { startsAt: fromLocalInput(v.startsAt) } : {}),
        endsAt: fromLocalInput(v.endsAt),
        isActive: v.isActive,
      };
      return editing
        ? api.patch<AdminCoupon>(`/admin/coupons/${coupon!._id}`, body)
        : api.post<AdminCoupon>("/admin/coupons", { ...body, code: v.code.trim().toUpperCase() });
    },
    success: (v) => ({ title: editing ? "تم حفظ الكوبون" : "تم إنشاء الكوبون", description: v.code.trim().toUpperCase() }),
    failure: "لم يتم حفظ الكوبون",
    invalidate: [qk.coupons],
    onDone: () => {
      reset();
      onOpenChange(false);
    },
  });

  const submit = handleSubmit((v) =>
    save.mutate(v, {
      onError: (e) => {
        if (!(e instanceof ApiError)) return;
        if (e.code === "COUPON_CODE_TAKEN") setError("code", { message: "الكود ده مستخدم قبل كده، اختار كود تاني" });
        if (e.code === "COUPON_VALUE") setError("value", { message: e.message });
        if (e.code === "INVALID_DATES") setError("endsAt", { message: e.message });
      },
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `تعديل كوبون ${coupon!.code}` : "كوبون فاترينة جديد"}
      description="يشتغل في كل المتاجر، وفاترينة بتدفع الخصم: بيتسجل للمتجر كتسوية لصالحه أول ما الطلب يتسلّم."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={save.isPending}>
            إلغاء
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {editing ? "حفظ التعديلات" : "إنشاء الكوبون"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="الكود" hint={editing ? "الكود مبيتغيرش بعد الإنشاء" : "اللي العميل بيكتبه في السلة، مثل FATRINA10. بيتحفظ بحروف كبيرة."} error={errors.code?.message}>
            {(a) => (
              <Input
                {...a}
                {...register("code", { onChange: (e) => setValue("code", e.target.value.toUpperCase()) })}
                dir="ltr"
                maxLength={20}
                autoComplete="off"
                disabled={editing}
                className="num text-start uppercase"
              />
            )}
          </Field>
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-ui font-medium text-ink">نوع الخصم</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className={chip}>
              <input type="radio" value="PERCENT" {...register("type")} className="sr-only" />
              نسبة مئوية
            </label>
            <label className={chip}>
              <input type="radio" value="FIXED" {...register("type")} className="sr-only" />
              مبلغ ثابت
            </label>
          </div>
        </fieldset>

        <Field label={type === "PERCENT" ? "النسبة (%)" : "المبلغ (ج.م)"} hint={type === "PERCENT" ? "من 1 لـ 90%" : "1 ج.م على الأقل"} error={errors.value?.message}>
          {(a) => <Input {...a} {...register("value")} type="number" inputMode="decimal" min={1} max={type === "PERCENT" ? 90 : undefined} dir="ltr" className="num text-start" />}
        </Field>
        <Field
          label="أقصى خصم (ج.م)"
          hint={type === "PERCENT" ? "اختياري: سقف للخصم بالنسبة. فاضي = من غير سقف" : "للنسبة المئوية بس"}
          error={type === "PERCENT" ? errors.maxDiscount?.message : undefined}
        >
          {(a) => (
            <Input
              {...a}
              {...register("maxDiscount")}
              type="number"
              inputMode="decimal"
              min={1}
              dir="ltr"
              disabled={type !== "PERCENT"}
              placeholder={type === "PERCENT" ? "من غير سقف" : "—"}
              className="num text-start"
            />
          )}
        </Field>

        <Field label="أقل قيمة للطلب (ج.م)" hint="المنتجات قبل الشحن. 0 = أي طلب" error={errors.minSubtotal?.message}>
          {(a) => <Input {...a} {...register("minSubtotal")} type="number" inputMode="decimal" min={0} dir="ltr" className="num text-start" />}
        </Field>
        <Field label="عدد مرات الاستخدام" hint="لكل العملاء مع بعض. فاضي = مفتوح" error={errors.maxUses?.message}>
          {(a) => <Input {...a} {...register("maxUses")} type="number" inputMode="numeric" min={1} step={1} dir="ltr" placeholder="∞" className="num text-start" />}
        </Field>
        <Field label="لكل عميل" hint="كام مرة العميل الواحد يقدر يستخدمه (1–100)" error={errors.perUserLimit?.message}>
          {(a) => <Input {...a} {...register("perUserLimit")} type="number" inputMode="numeric" min={1} max={100} step={1} dir="ltr" className="num text-start" />}
        </Field>
        <div className="hidden sm:block" />

        <Field label="يبدأ من" hint="فاضي = من دلوقتي" error={errors.startsAt?.message}>
          {(a) => <Input {...a} {...register("startsAt")} type="datetime-local" dir="ltr" className="num text-start" />}
        </Field>
        <Field label="ينتهي في" error={errors.endsAt?.message}>
          {(a) => <Input {...a} {...register("endsAt")} type="datetime-local" dir="ltr" className="num text-start" />}
        </Field>

        <div className="sm:col-span-2">
          <Checkbox checked={!!isActive} onCheckedChange={(c) => setValue("isActive", c)}>
            مفعّل — العملاء يقدروا يستخدموه في الفترة دي
          </Checkbox>
        </div>
      </form>
    </Dialog>
  );
}
