"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { AssistantSettings, AssistantTone } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/data/detail-list";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";

const NAME_MAX = 40;
const EXTRA_MAX = 2000;

const TONES: { value: AssistantTone; label: string }[] = [
  { value: "friendly", label: "ودود" },
  { value: "formal", label: "رسمي" },
  { value: "brief", label: "مختصر" },
];

/** The store's AI assistant settings, editable by the admin (same fields the owner has). */
export function AssistantPanel({ brandId }: { brandId: string }) {
  const settings = useQuery({
    queryKey: qk.assistantSettings(brandId),
    queryFn: () => api.get<AssistantSettings>(`/admin/brands/${brandId}/assistant`),
  });

  return (
    <Panel>
      <div id="assistant" className="flex scroll-mt-6 flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-ui font-semibold text-ink">مساعد الذكاء الاصطناعي</h2>
          <p className="mt-0.5 text-meta text-ink-3">بيرد على أسئلة العملاء في صفحة المتجر من المنتجات والسياسات والمعلومات اللي هنا.</p>
        </div>
        <Link
          href={`/assistant?brandId=${brandId}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-ui text-accent underline-offset-4 hover:underline"
        >
          <MessagesSquare aria-hidden className="size-4" />
          محادثات المتجر
        </Link>
      </div>
      <div className="mt-4">
        {settings.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : settings.isError || !settings.data ? (
          <ErrorState error={settings.error} onRetry={() => settings.refetch()} className="py-8" />
        ) : (
          <AssistantForm brandId={brandId} current={settings.data} />
        )}
      </div>
    </Panel>
  );
}

function AssistantForm({ brandId, current }: { brandId: string; current: AssistantSettings }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(current.enabled);
  const [name, setName] = useState(current.name);
  const [tone, setTone] = useState<AssistantTone>(current.tone);
  const [extraInfo, setExtraInfo] = useState(current.extraInfo);

  const save = useAction({
    run: (body: Pick<AssistantSettings, "enabled" | "name" | "tone" | "extraInfo">) =>
      api.patch<AssistantSettings>(`/admin/brands/${brandId}/assistant`, body),
    success: "اتحفظت إعدادات المساعد",
    failure: "لم يتم حفظ إعدادات المساعد",
    onDone: (result) => queryClient.setQueryData(qk.assistantSettings(brandId), result),
  });

  const dirty =
    enabled !== current.enabled || name.trim() !== current.name || tone !== current.tone || extraInfo.trim() !== current.extraInfo;
  const tooLong = name.length > NAME_MAX || extraInfo.length > EXTRA_MAX;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!dirty || tooLong) return;
        save.mutate({ enabled, name: name.trim(), tone, extraInfo: extraInfo.trim() });
      }}
    >
      {!current.available && (
        <p className="rounded-sm border border-warning/25 bg-warning-soft px-3 py-2 text-ui text-warning">
          الذكاء الاصطناعي مش متظبط على السيرفر دلوقتي، فالمساعد مش هيظهر لأي متجر لحد ما يتظبط.
        </p>
      )}
      <Switch checked={enabled} onCheckedChange={setEnabled}>
        {enabled ? "المساعد شغّال في صفحة المتجر" : "المساعد مقفول"}
      </Switch>

      <Field label="اسم المساعد" hint={`لو سبته فاضي هيظهر باسم «${current.displayName || "مساعد المتجر"}». ${name.length}/${NAME_MAX}`} error={name.length > NAME_MAX ? `الاسم أطول من ${NAME_MAX} حرف` : undefined}>
        {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} placeholder={current.displayName} />}
      </Field>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-ui font-medium text-ink">أسلوب الرد</legend>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <label
              key={t.value}
              className={cn(
                "flex h-11 cursor-pointer items-center rounded-sm border px-4 text-ui transition-colors",
                tone === t.value ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line-strong text-ink hover:bg-sunken",
              )}
            >
              <input type="radio" name="assistant-tone" value={t.value} checked={tone === t.value} onChange={() => setTone(t.value)} className="sr-only" />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="معلومات إضافية"
        hint={`مواعيد، طرق دفع، أي حاجة المساعد محتاج يعرفها عن المتجر. ${extraInfo.length}/${EXTRA_MAX}`}
        error={extraInfo.length > EXTRA_MAX ? `النص أطول من ${EXTRA_MAX} حرف` : undefined}
      >
        {(a) => <Textarea {...a} value={extraInfo} onChange={(e) => setExtraInfo(e.target.value)} maxLength={EXTRA_MAX} rows={6} />}
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty || tooLong || save.isPending}>
          حفظ
        </Button>
        {dirty && !save.isPending && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEnabled(current.enabled);
              setName(current.name);
              setTone(current.tone);
              setExtraInfo(current.extraInfo);
            }}
          >
            تراجع
          </Button>
        )}
      </div>
    </form>
  );
}
