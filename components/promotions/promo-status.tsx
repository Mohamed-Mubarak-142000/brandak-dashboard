import { formatDate, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

type Period = { isActive: boolean; startsAt: string; endsAt: string };
type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

/** Where a coupon or season stands right now; a stopped one reads «موقوف» whatever its dates. */
export function periodStatus(p: Period, now = Date.now()): { label: string; tone: Tone } {
  if (!p.isActive) return { label: "موقوف", tone: "neutral" };
  if (now < new Date(p.startsAt).getTime()) return { label: "لسه مابدأش", tone: "accent" };
  if (now > new Date(p.endsAt).getTime()) return { label: "انتهى", tone: "warning" };
  return { label: "شغال", tone: "success" };
}

export function PeriodBadge({ period }: { period: Period }) {
  const s = periodStatus(period);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** «1 نوفمبر 2026 ← 30 نوفمبر 2026», with the exact times on hover. */
export function PeriodText({ period }: { period: Period }) {
  return (
    <span className="text-ink-2" title={`${formatDateTime(period.startsAt)} — ${formatDateTime(period.endsAt)}`}>
      {formatDate(period.startsAt)} <span className="text-ink-3">←</span> {formatDate(period.endsAt)}
    </span>
  );
}

/** ISO → value for <input type="datetime-local"> in the admin's local time. */
export function toLocalInput(iso?: string | Date | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO, or undefined when empty/invalid. */
export function fromLocalInput(value?: string) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Shared radio-chip style used by the promotion forms. */
export const chip =
  "flex h-11 cursor-pointer items-center justify-center rounded-sm border border-line-strong px-4 text-ui transition-colors hover:bg-sunken has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:font-semibold has-[:checked]:text-accent";
