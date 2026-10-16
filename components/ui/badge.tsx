import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2 border-line",
  accent: "bg-accent-soft text-accent border-accent/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/20",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-meta font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  AWAITING_PROOF: { label: "بانتظار الإيصال", tone: "neutral" },
  PENDING_REVIEW: { label: "قيد المراجعة", tone: "warning" },
  APPROVED: { label: "معتمد", tone: "success" },
  REJECTED: { label: "مرفوض", tone: "danger" },
  CANCELLED: { label: "ملغي", tone: "neutral" },
};

export const BRAND_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING_REVIEW: { label: "قيد المراجعة", tone: "warning" },
  ACTIVE: { label: "مفعّل", tone: "success" },
  REJECTED: { label: "مرفوض", tone: "danger" },
  SUSPENDED: { label: "موقوف", tone: "danger" },
};
