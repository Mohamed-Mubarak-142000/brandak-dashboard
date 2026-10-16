"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Field, Textarea } from "./field";

/**
 * Confirmation that needs a written reason (reject, suspend, cancel…). The reason is stored in
 * the audit log and usually shown to the affected person, so it is required by default.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "danger",
  quickReasons = [],
  label = "السبب",
  placeholder,
  required = true,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  quickReasons?: string[];
  label?: string;
  placeholder?: string;
  required?: boolean;
  loading?: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const invalid = required && reason.trim().length < 3;

  const close = () => {
    setReason("");
    setTouched(false);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={title}
      description={description}
      initialFocus={textarea}
      footer={
        <>
          <Button onClick={close} disabled={loading}>
            إلغاء
          </Button>
          <Button
            variant={tone}
            loading={loading}
            onClick={() => {
              setTouched(true);
              if (!invalid) onConfirm(reason.trim());
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {quickReasons.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="أسباب شائعة">
          {quickReasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              aria-pressed={reason === r}
              className={cn(
                "rounded-sm border px-3 py-2 text-ui transition-colors",
                reason === r
                  ? tone === "danger"
                    ? "border-danger bg-danger-soft text-danger"
                    : "border-accent bg-accent-soft text-accent"
                  : "border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      )}
      <Field label={label} error={touched && invalid ? "اكتب سببًا واضحًا (3 أحرف على الأقل)" : undefined}>
        {(a11y) => (
          <Textarea
            {...a11y}
            ref={textarea}
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
          />
        )}
      </Field>
    </Dialog>
  );
}
