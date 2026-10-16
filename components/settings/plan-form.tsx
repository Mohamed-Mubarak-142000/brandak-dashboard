"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/api/use-action";
import type { Plan } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";

const money = z.coerce.number({ message: "أدخل رقمًا" }).min(0, "لا يمكن أن يكون سالبًا");
const schema = z.object({
  nameAr: z.string().trim().min(2, "الاسم قصير جدًا").max(60),
  nameEn: z.string().trim().min(2, "الاسم قصير جدًا").max(60),
  code: z.string().trim().regex(/^[A-Z_]{2,30}$/, "حروف إنجليزية كبيرة و _ فقط، مثل GROWTH"),
  descriptionAr: z.string().max(500).optional(),
  priceMonthly: money,
  priceYearly: money,
  maxActiveProducts: z.coerce.number({ message: "أدخل رقمًا" }).int("رقم صحيح فقط").min(1, "منتج واحد على الأقل"),
  features: z.string().optional(),
});
type Values = z.input<typeof schema>;

export function PlanFormDialog({ plan, open, onOpenChange }: { plan: Plan | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const editing = !!plan;
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: plan
      ? {
          nameAr: plan.nameAr,
          nameEn: plan.nameEn,
          code: plan.code,
          descriptionAr: plan.descriptionAr,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          maxActiveProducts: plan.limits.maxActiveProducts,
          features: plan.features.join("\n"),
        }
      : { nameAr: "", nameEn: "", code: "", descriptionAr: "", priceMonthly: 0, priceYearly: 0, maxActiveProducts: 30, features: "" },
  });

  const save = useAction({
    run: (v: z.output<typeof schema>) => {
      const body = {
        nameAr: v.nameAr,
        nameEn: v.nameEn,
        descriptionAr: v.descriptionAr ?? "",
        priceMonthly: v.priceMonthly,
        priceYearly: v.priceYearly,
        limits: { maxActiveProducts: v.maxActiveProducts },
        features: (v.features ?? "").split("\n").map((f) => f.trim()).filter(Boolean),
      };
      return editing ? api.patch(`/admin/plans/${plan!._id}`, body) : api.post("/admin/plans", { ...body, code: v.code });
    },
    success: editing ? "تم حفظ الباقة" : "تمت إضافة الباقة",
    failure: "لم يتم حفظ الباقة",
    invalidate: [["plans"]],
    onDone: () => {
      reset();
      onOpenChange(false);
    },
  });

  const submit = handleSubmit((v) => save.mutate(schema.parse(v)));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `تعديل باقة ${plan!.nameAr}` : "باقة جديدة"}
      description={editing ? "الأسعار الجديدة تطبَّق على الاشتراكات الجديدة فقط؛ الاشتراكات الحالية تحتفظ بسعرها." : undefined}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={save.isPending}>
            إلغاء
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {editing ? "حفظ التعديلات" : "إضافة الباقة"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم بالعربية" error={errors.nameAr?.message}>{(a) => <Input {...a} {...register("nameAr")} />}</Field>
        <Field label="الاسم بالإنجليزية" error={errors.nameEn?.message}>{(a) => <Input {...a} {...register("nameEn")} dir="ltr" className="text-start" />}</Field>
        <Field label="الكود" hint={editing ? "لا يمكن تغييره بعد الإنشاء" : "يُستخدم داخليًا، مثل GROWTH"} error={errors.code?.message}>
          {(a) => <Input {...a} {...register("code")} dir="ltr" disabled={editing} className="text-start" />}
        </Field>
        <Field label="حد المنتجات المنشورة" error={errors.maxActiveProducts?.message}>
          {(a) => <Input {...a} {...register("maxActiveProducts")} type="number" inputMode="numeric" dir="ltr" className="text-start" />}
        </Field>
        <Field label="السعر الشهري (ج.م)" error={errors.priceMonthly?.message}>
          {(a) => <Input {...a} {...register("priceMonthly")} type="number" inputMode="decimal" dir="ltr" className="text-start" />}
        </Field>
        <Field label="السعر السنوي (ج.م)" hint="عادة 10 أضعاف الشهري (شهران مجانًا)" error={errors.priceYearly?.message}>
          {(a) => <Input {...a} {...register("priceYearly")} type="number" inputMode="decimal" dir="ltr" className="text-start" />}
        </Field>
        <div className="sm:col-span-2">
          <Field label="وصف قصير" error={errors.descriptionAr?.message}>{(a) => <Input {...a} {...register("descriptionAr")} />}</Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="المزايا" hint="ميزة في كل سطر؛ تظهر لصاحب البراند عند اختيار الباقة">
            {(a) => <Textarea {...a} {...register("features")} rows={4} />}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
