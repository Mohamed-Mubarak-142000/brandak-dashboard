"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

const schema = z.object({
  identifier: z.string().trim().min(1, "أدخل البريد الإلكتروني"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const params = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) {
      setServerError(body?.error?.message ?? "تعذّر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة");
      return;
    }
    // Only follow same-site paths, never an absolute URL from the query string.
    const next = params.get("next");
    window.location.assign(next?.startsWith("/") && !next.startsWith("//") ? next : "/payments");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Field label="البريد الإلكتروني" error={errors.identifier?.message}>
        {(a11y) => (
          <Input {...a11y} {...register("identifier")} type="email" dir="ltr" autoComplete="username" className="text-start" autoFocus />
        )}
      </Field>
      <Field label="كلمة المرور" error={errors.password?.message}>
        {(a11y) => <Input {...a11y} {...register("password")} type="password" dir="ltr" autoComplete="current-password" className="text-start" />}
      </Field>
      {serverError && (
        <p role="alert" className="rounded-sm border border-danger/30 bg-danger-soft px-3 py-2.5 text-ui text-danger">
          {serverError}
        </p>
      )}
      <Button type="submit" variant="primary" loading={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? "جارٍ الدخول…" : "تسجيل الدخول"}
      </Button>
    </form>
  );
}
