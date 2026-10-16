"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "@/lib/api/client";
import { useAction } from "@/lib/api/use-action";
import type { AdminUser } from "@/lib/api/types";
import { formatPhone } from "@/lib/format";
import { DetailList, DetailRow, Panel } from "@/components/data/detail-list";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/states";

const schema = z
  .object({
    currentPassword: z.string().min(1, "أدخل كلمة المرور الحالية"),
    newPassword: z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/, "8 أحرف على الأقل، وتحتوي على حرف ورقم"),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "كلمتا المرور غير متطابقتين" });
type Values = z.infer<typeof schema>;

export function AccountPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.get<AdminUser>("/users/me") });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const change = useAction({
    run: (v: Values) => api.post("/auth/change-password", { currentPassword: v.currentPassword, newPassword: v.newPassword }),
    success: () => ({ title: "تم تغيير كلمة المرور", description: "تم تسجيل الخروج من كل الأجهزة الأخرى." }),
    failure: "لم يتم تغيير كلمة المرور",
    onDone: () => reset(),
  });

  const submit = handleSubmit((v) =>
    change.mutate(v, {
      onError: (e) => {
        if (e instanceof ApiError && e.code === "WRONG_PASSWORD") setError("currentPassword", { message: "كلمة المرور الحالية غير صحيحة" });
        if (e instanceof ApiError && e.code === "SAME_PASSWORD") setError("newPassword", { message: "اختر كلمة مرور مختلفة عن الحالية" });
      },
    }),
  );

  return (
    <PageShell>
      <PageHeader title="حسابي" />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel>
          {me.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <DetailList title="بيانات الحساب">
              <DetailRow label="الاسم">{me.data?.name}</DetailRow>
              <DetailRow label="البريد">
                <span className="num">{me.data?.email}</span>
              </DetailRow>
              <DetailRow label="الهاتف">
                <span className="num">{formatPhone(me.data?.phone)}</span>
              </DetailRow>
            </DetailList>
          )}
        </Panel>
        <Panel>
          <h2 className="text-ui font-semibold text-ink">تغيير كلمة المرور</h2>
          <p className="mb-5 mt-0.5 text-meta text-ink-3">ستبقى مسجّلًا هنا، ويتم تسجيل خروجك من أي جهاز آخر.</p>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <Field label="كلمة المرور الحالية" error={errors.currentPassword?.message}>
              {(a) => <Input {...a} {...register("currentPassword")} type="password" autoComplete="current-password" dir="ltr" className="text-start" />}
            </Field>
            <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل، وتحتوي على حرف ورقم" error={errors.newPassword?.message}>
              {(a) => <Input {...a} {...register("newPassword")} type="password" autoComplete="new-password" dir="ltr" className="text-start" />}
            </Field>
            <Field label="تأكيد كلمة المرور الجديدة" error={errors.confirm?.message}>
              {(a) => <Input {...a} {...register("confirm")} type="password" autoComplete="new-password" dir="ltr" className="text-start" />}
            </Field>
            <Button type="submit" variant="primary" loading={change.isPending} className="self-start">
              تغيير كلمة المرور
            </Button>
          </form>
        </Panel>
      </div>
    </PageShell>
  );
}
