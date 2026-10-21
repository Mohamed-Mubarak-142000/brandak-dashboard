"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { PlatformSettings } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { Panel } from "@/components/data/detail-list";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";

/** 0.05 → "5"; the rate is edited as a percentage and stored as a fraction (up to 4 decimals). */
const toPercent = (rate: number) => String(Math.round(rate * 10_000) / 100);

function validate(values: { rate: string; days: string; max: string }) {
  const rate = Number(values.rate);
  const days = Number(values.days);
  const max = Number(values.max);
  return {
    rate:
      !values.rate.trim() || !Number.isFinite(rate) || rate < 0 || rate > 50
        ? "النسبة من 0 لـ 50%"
        : Math.abs(Math.round(rate * 100) - rate * 100) > 1e-6
          ? "مسموح برقمين عشريين بس (مثل 2.75)"
          : undefined,
    days: !values.days.trim() || !Number.isInteger(days) || days < 1 || days > 90 ? "عدد أيام صحيح من 1 لـ 90" : undefined,
    max: !values.max.trim() || !Number.isFinite(max) || max < 0 || max > 1_000_000 ? "مبلغ من 0 لـ 1,000,000 ج.م" : undefined,
  };
}

function CommissionForm({ current }: { current: PlatformSettings }) {
  const queryClient = useQueryClient();
  const initial = { rate: toPercent(current.commissionRate), days: String(current.settlementDays), max: String(current.maxUnpaidBalance) };
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState(false);
  const errors = validate(values);
  const invalid = Object.values(errors).some(Boolean);

  // Send only what changed; 5 (%) → 0.05.
  const patch: Partial<PlatformSettings> = {};
  const rate = Number((Number(values.rate) / 100).toFixed(4));
  if (!errors.rate && rate !== current.commissionRate) patch.commissionRate = rate;
  if (!errors.days && Number(values.days) !== current.settlementDays) patch.settlementDays = Number(values.days);
  if (!errors.max && Number(values.max) !== current.maxUnpaidBalance) patch.maxUnpaidBalance = Number(values.max);
  const dirty = values.rate !== initial.rate || values.days !== initial.days || values.max !== initial.max;

  const save = useAction({
    run: (body: Partial<PlatformSettings>) => api.patch<PlatformSettings>("/admin/platform-settings", body),
    success: "تم حفظ شروط العمولة",
    failure: "لم يتم حفظ الشروط",
    invalidate: [["commissions"]],
    onDone: (saved) => queryClient.setQueryData(qk.platformSettings, saved),
  });

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!invalid && Object.keys(patch).length) save.mutate(patch);
      }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="نسبة العمولة (%)" hint="من قيمة كل طلب بيتسلّم." error={touched ? errors.rate : undefined}>
          {(a11y) => <Input {...a11y} type="number" inputMode="decimal" min={0} max={50} step="0.01" dir="ltr" className="num text-end" value={values.rate} onChange={set("rate")} />}
        </Field>
        <Field label="مهلة السداد (يوم)" hint="بعدها المتجر بيقف عن استقبال الطلبات لو لسه عليه فلوس." error={touched ? errors.days : undefined}>
          {(a11y) => <Input {...a11y} type="number" inputMode="numeric" min={1} max={90} step="1" dir="ltr" className="num text-end" value={values.days} onChange={set("days")} />}
        </Field>
        <Field label="أقصى مستحق (ج.م)" hint="لو المستحق عدّاه، المتجر بيقف فورًا لحد ما يسدد." error={touched ? errors.max : undefined}>
          {(a11y) => <Input {...a11y} type="number" inputMode="decimal" min={0} step="1" dir="ltr" className="num text-end" value={values.max} onChange={set("max")} />}
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-meta text-ink-3">
          النسبة الجديدة بتتطبق على الطلبات اللي بتتسلّم بعد الحفظ؛ العمولات المسجلة قبل كده مش بتتغير. الحالي:{" "}
          <span className="num">{toPercent(current.commissionRate)}%</span>، <span className="num">{current.settlementDays}</span> يوم، حد{" "}
          <span className="num">{formatMoney(current.maxUnpaidBalance)}</span>.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!dirty || save.isPending}
            onClick={() => {
              setValues(initial);
              setTouched(false);
            }}
          >
            تراجع
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty}>
            حفظ الشروط
          </Button>
        </div>
      </div>
    </form>
  );
}

/** «العمولة» card: the platform's commission terms. */
export function CommissionSettings() {
  const terms = useQuery({ queryKey: qk.platformSettings, queryFn: () => api.get<PlatformSettings>("/admin/platform-settings") });
  return (
    <Panel>
      <h2 className="text-section font-semibold text-ink">العمولة</h2>
      <p className="mb-5 mt-0.5 text-ui text-ink-2">
        فاترينة بتاخد نسبة من كل طلب بيتسلّم. المتاجر بتسدد اللي عليها بتحويل InstaPay، وإيصالها بيتراجع من صفحة العمولات.
      </p>
      {terms.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : terms.isError || !terms.data ? (
        <ErrorState error={terms.error} onRetry={() => terms.refetch()} className="py-8" />
      ) : (
        // Re-mount on new server values so the form starts from what's saved.
        <CommissionForm key={JSON.stringify(terms.data)} current={terms.data} />
      )}
    </Panel>
  );
}
