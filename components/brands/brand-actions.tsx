"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/api/use-action";
import type { BrandStatus } from "@/lib/api/types";
import { ReasonDialog } from "@/components/ui/reason-dialog";

export type BrandActionKind = "approve" | "reject" | "suspend" | "reinstate";
type Target = { _id: string; name: string };

/** Which decisions are possible from each brand state — mirrors the API's transitions. */
export const BRAND_ACTIONS: Record<BrandStatus, BrandActionKind[]> = {
  PENDING_REVIEW: ["approve", "reject"],
  ACTIVE: ["suspend"],
  SUSPENDED: ["reinstate"],
  REJECTED: [],
};

export const ACTION_LABEL: Record<BrandActionKind, string> = {
  approve: "الموافقة على البراند",
  reject: "رفض الطلب",
  suspend: "إيقاف البراند",
  reinstate: "إعادة التفعيل",
};

const DONE: Record<BrandActionKind, string> = {
  approve: "تمت الموافقة على البراند",
  reject: "تم رفض الطلب",
  suspend: "تم إيقاف البراند",
  reinstate: "تمت إعادة تفعيل البراند",
};

const REASON_COPY = {
  reject: {
    title: "رفض طلب البراند",
    description: "سيصل السبب لصاحب البراند، ويمكنه تعديل بياناته وإعادة الإرسال.",
    confirm: "رفض الطلب",
    quick: ["بيانات التواصل غير صحيحة", "المنتجات غير مسموح بها على المنصة", "اسم البراند مخالف", "الوصف غير كافٍ"],
  },
  suspend: {
    title: "إيقاف البراند",
    description: "سيختفي المتجر فورًا ولن يستقبل طلبات جديدة. الطلبات الحالية لا تتأثر.",
    confirm: "إيقاف البراند",
    quick: ["بلاغات متكررة من العملاء", "بيع منتجات مخالفة", "عدم تسليم الطلبات"],
  },
} as const;

/** Runs brand decisions for any brand; reject/suspend first ask for a reason. */
export function useBrandActions(onDone?: () => void) {
  const [asking, setAsking] = useState<{ kind: "reject" | "suspend"; brand: Target } | null>(null);

  const act = useAction({
    run: ({ kind, brand, reason }: { kind: BrandActionKind; brand: Target; reason?: string }) =>
      api.post(`/admin/brands/${brand._id}/${kind}`, reason ? { reason } : {}),
    success: ({ kind, brand }) => ({ title: DONE[kind], description: brand.name }),
    failure: "لم يتم تنفيذ الإجراء",
    invalidate: [["brands"], ["brand"]],
    onDone: () => {
      setAsking(null);
      onDone?.();
    },
  });

  const run = (kind: BrandActionKind, brand: Target) =>
    kind === "reject" || kind === "suspend" ? setAsking({ kind, brand }) : act.mutate({ kind, brand });

  const dialog = asking ? (
    <ReasonDialog
      open
      onOpenChange={(o) => !o && setAsking(null)}
      title={REASON_COPY[asking.kind].title}
      description={`${asking.brand.name}: ${REASON_COPY[asking.kind].description}`}
      confirmLabel={REASON_COPY[asking.kind].confirm}
      quickReasons={[...REASON_COPY[asking.kind].quick]}
      loading={act.isPending}
      onConfirm={(reason) => act.mutate({ kind: asking.kind, brand: asking.brand, reason })}
    />
  ) : null;

  return { run, dialog, pending: act.isPending, pendingKind: act.isPending ? act.variables?.kind : undefined };
}
