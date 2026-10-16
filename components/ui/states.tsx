import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api/client";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-sm bg-line/70", className)} />;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-16 text-center", className)}>
      {icon && <div className="text-ink-3">{icon}</div>}
      <p className="font-display text-section text-ink">{title}</p>
      {description && <p className="max-w-sm text-ui text-ink-2">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof ApiError ? error.message : "حدث خطأ غير متوقع أثناء تحميل البيانات.";
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-3 px-6 py-16 text-center", className)}>
      <AlertTriangle aria-hidden className="size-6 text-danger" />
      <p className="text-body font-medium text-ink">تعذّر تحميل البيانات</p>
      <p className="max-w-sm text-ui text-ink-2">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          <RotateCw aria-hidden className="size-4" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
