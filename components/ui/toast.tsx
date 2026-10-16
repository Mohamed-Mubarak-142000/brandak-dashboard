"use client";

import * as RToast from "@radix-ui/react-toast";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

const ToastContext = createContext<(t: Omit<ToastItem, "id">) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    setItems((prev) => [...prev.slice(-2), { ...t, id: Date.now() + Math.random() }]);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      <RToast.Provider swipeDirection="left" duration={4500} label="الإشعارات">
        {children}
        {items.map((t) => (
          <RToast.Root
            key={t.id}
            onOpenChange={(open) => !open && setItems((prev) => prev.filter((x) => x.id !== t.id))}
            className={cn(
              "flex items-start gap-3 rounded-md border bg-surface p-4 shadow-pop",
              "data-[state=open]:animate-in data-[state=closed]:opacity-0 transition-opacity",
              t.tone === "success" ? "border-success/30" : "border-danger/30",
            )}
          >
            {t.tone === "success" ? (
              <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <XCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
            )}
            <div className="min-w-0 flex-1">
              <RToast.Title className="text-ui font-semibold text-ink">{t.title}</RToast.Title>
              {t.description && (
                <RToast.Description className="mt-0.5 text-ui text-ink-2">{t.description}</RToast.Description>
              )}
            </div>
            <RToast.Close aria-label="إغلاق" className="rounded-sm p-1 text-ink-3 hover:text-ink">
              <X className="size-4" />
            </RToast.Close>
          </RToast.Root>
        ))}
        <RToast.Viewport className="fixed bottom-4 start-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 outline-none" />
      </RToast.Provider>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
