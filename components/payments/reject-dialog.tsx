"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";

// The reasons admins give most often; the owner sees the reason and can upload a new receipt.
const QUICK_REASONS = [
  "المبلغ لم يصل إلى حساب InstaPay",
  "المبلغ المحوّل أقل من المطلوب",
  "الرقم المرجعي غير مطابق للتحويل",
  "صورة الإيصال غير واضحة",
];

export function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  brandName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
  brandName: string;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const tooShort = reason.trim().length < 3;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const close = () => {
    setReason("");
    setTouched(false);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title="رفض إيصال الدفع"
      initialFocus={textarea}
      description={`سيصل السبب إلى صاحب براند ${brandName}، ويمكنه رفع إيصال جديد بعدها.`}
      footer={
        <>
          <Button onClick={close} disabled={loading}>
            إلغاء
          </Button>
          <Button
            variant="danger"
            loading={loading}
            onClick={() => {
              setTouched(true);
              if (!tooShort) onConfirm(reason.trim());
            }}
          >
            رفض الإيصال
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="أسباب شائعة">
        {QUICK_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            aria-pressed={reason === r}
            className={cn(
              "rounded-sm border px-3 py-2 text-ui transition-colors",
              reason === r
                ? "border-danger bg-danger-soft text-danger"
                : "border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink",
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <Field label="سبب الرفض" error={touched && tooShort ? "اكتب سببًا واضحًا حتى يعرف صاحب البراند ما يجب تصحيحه" : undefined}>
        {(a11y) => (
          <Textarea
            {...a11y}
            ref={textarea}
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: وصل 150 ج.م فقط والمطلوب 199 ج.م"
          />
        )}
      </Field>
    </Dialog>
  );
}
