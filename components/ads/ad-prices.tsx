"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { AdPlacement, AdPrice } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { Panel } from "@/components/data/detail-list";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";

const MAX_PRICE = 100_000;

function PricesForm({ current }: { current: AdPrice[] }) {
  const queryClient = useQueryClient();
  const initial = Object.fromEntries(current.map((p) => [p.placement, String(p.weekPrice)])) as Record<AdPlacement, string>;
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState(false);

  const error = (v: string) => {
    const n = Number(v);
    return !v.trim() || !Number.isInteger(n) || n < 0 || n > MAX_PRICE ? "مبلغ صحيح من 0 لـ 100,000 ج.م" : undefined;
  };
  const invalid = current.some((p) => error(values[p.placement]));
  // Send only what changed.
  const body: Partial<Record<AdPlacement, number>> = {};
  for (const p of current) if (!error(values[p.placement]) && Number(values[p.placement]) !== p.weekPrice) body[p.placement] = Number(values[p.placement]);
  const dirty = current.some((p) => values[p.placement] !== initial[p.placement]);

  const save = useAction({
    run: (prices: Partial<Record<AdPlacement, number>>) => api.put<Record<AdPlacement, number>>("/admin/ads/prices", prices),
    success: "تم حفظ أسعار الإعلانات",
    failure: "لم يتم حفظ الأسعار",
    onDone: (saved) =>
      queryClient.setQueryData<AdPrice[]>(qk.adPrices, (old) => old?.map((p) => ({ ...p, weekPrice: saved[p.placement] ?? p.weekPrice }))),
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!invalid && Object.keys(body).length) save.mutate(body);
      }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {current.map((p) => (
          <Field
            key={p.placement}
            label={`${p.name} (ج.م / أسبوع)`}
            hint={`بيظهر ${formatNumber(p.slots)} منتج في نفس الوقت، بالتبادل.`}
            error={touched ? error(values[p.placement]) : undefined}
          >
            {(a11y) => (
              <Input
                {...a11y}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_PRICE}
                step="1"
                dir="ltr"
                className="num text-end"
                value={values[p.placement]}
                onChange={(e) => setValues((v) => ({ ...v, [p.placement]: e.target.value }))}
              />
            )}
          </Field>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-meta text-ink-3">السعر الجديد بيتطبق على الطلبات الجديدة بس؛ الإعلانات اللي اتدفعت قبل كده سعرها ثابت.</p>
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
            حفظ الأسعار
          </Button>
        </div>
      </div>
    </form>
  );
}

/** «أسعار الإعلانات» card: the weekly price of each placement. */
export function AdPrices() {
  const prices = useQuery({ queryKey: qk.adPrices, queryFn: () => api.get<AdPrice[]>("/ads/prices") });
  return (
    <Panel>
      <h2 className="text-section font-semibold text-ink">أسعار الإعلانات</h2>
      <p className="mb-5 mt-0.5 text-ui text-ink-2">سعر الأسبوع لكل مكان. المتجر بيشتري من أسبوع لـ4 أسابيع ويدفع بتحويل InstaPay.</p>
      {prices.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : prices.isError || !prices.data ? (
        <ErrorState error={prices.error} onRetry={() => prices.refetch()} className="py-8" />
      ) : (
        // Re-mount on new server values so the form starts from what's saved.
        <PricesForm key={JSON.stringify(prices.data)} current={prices.data} />
      )}
    </Panel>
  );
}
