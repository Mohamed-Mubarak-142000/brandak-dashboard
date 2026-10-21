"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ImageOff, ZoomIn, ZoomOut } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/states";

/** The verification stamp — the one expressive element of the interface. */
export function VerifiedStamp({ date, animate }: { date?: string; animate?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute start-1/2 top-1/2 z-10 -translate-y-1/2 translate-x-1/2",
        animate && "stamp-enter",
      )}
      // Tailwind translate uses the `translate` property, so rotation/scale in `transform` composes with it.
      style={animate ? undefined : { transform: "rotate(-9deg)" }}
    >
      <div
        className="flex flex-col items-center gap-1 rounded-md border-[3px] border-brand px-6 py-3 text-accent mix-blend-multiply"
        style={{ boxShadow: "inset 0 0 0 2px var(--surface), inset 0 0 0 4px var(--brand)" }}
      >
        <Image src="/brand/fatrina-mark.png" alt="" width={28} height={28} className="h-7 w-auto" />
        <span className="font-display text-[34px] leading-none font-bold">تم التحقق</span>
        {date && <span className="text-meta font-semibold">{formatDate(date)}</span>}
      </div>
    </div>
  );
}

/** Where each kind of receipt gets its short-lived signed link. */
const PROOF = {
  payment: { key: qk.proofUrl, path: (id: string) => `/admin/payments/${id}/proof-url` },
  settlement: { key: qk.settlementProof, path: (id: string) => `/admin/settlements/${id}/proof-url` },
  ad: { key: qk.adProof, path: (id: string) => `/admin/ads/${id}/proof` },
};

export function ReceiptViewer({
  paymentId,
  hasProof,
  approvedAt,
  stampAnimating,
  kind = "payment",
}: {
  /** The payment's id, or the settlement's when `kind` is "settlement". */
  paymentId: string;
  hasProof: boolean;
  approvedAt?: string;
  stampAnimating: boolean;
  /** Subscription payment (legacy), commission settlement or paid placement: picks the signed-URL endpoint. */
  kind?: keyof typeof PROOF;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const [broken, setBroken] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  // Signed links expire after 5 minutes; refresh a little before that.
  const proof = useQuery({
    queryKey: PROOF[kind].key(paymentId),
    queryFn: () => api.get<{ url: string }>(PROOF[kind].path(paymentId)),
    enabled: hasProof,
    staleTime: 4 * 60_000,
    refetchInterval: 4 * 60_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (e.key.toLowerCase() === "z") setZoomed((z) => !z);
      if (e.key === "Escape") setZoomed(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!hasProof) {
    return (
      <div className="grid aspect-[3/4] place-items-center rounded-md border border-dashed border-line-strong bg-sunken p-6 text-center text-ui text-ink-2">
        لم يرفع صاحب البراند إيصال التحويل بعد.
      </div>
    );
  }

  return (
    <figure className="flex flex-col gap-2">
      <div
        ref={frame}
        className={cn(
          "relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-sunken",
          zoomed ? "cursor-zoom-out" : "cursor-zoom-in",
        )}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setOrigin(`${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`);
          setZoomed((z) => !z);
        }}
      >
        {proof.isPending && <Skeleton className="absolute inset-0 rounded-none" />}
        {(proof.isError || broken) && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="flex flex-col items-center gap-2 text-ui text-ink-2">
              <ImageOff aria-hidden className="size-6 text-ink-3" />
              تعذّر عرض الإيصال هنا.
              {proof.data && (
                <a href={proof.data.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent underline underline-offset-4">
                  فتح الملف في نافذة جديدة
                  <ExternalLink aria-hidden className="size-3.5" />
                </a>
              )}
            </div>
          </div>
        )}
        {proof.data && !broken && (
          // Signed, short-lived URL from the API's storage — next/image would cache it past expiry.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proof.data.url}
            alt="صورة إيصال تحويل InstaPay"
            onError={() => setBroken(true)}
            className="size-full object-contain transition-transform duration-200"
            style={{ transform: zoomed ? "scale(2.2)" : "none", transformOrigin: origin }}
          />
        )}
        {approvedAt && <VerifiedStamp date={approvedAt} animate={stampAnimating} />}
      </div>
      <figcaption className="flex items-center justify-between text-meta text-ink-3">
        <span>الإيصال يظهر لفريق الإدارة فقط، ويتسجل كل اطلاع عليه.</span>
        <button
          type="button"
          onClick={() => setZoomed((z) => !z)}
          className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-ink-2 hover:bg-sunken hover:text-ink"
        >
          {zoomed ? <ZoomOut aria-hidden className="size-4" /> : <ZoomIn aria-hidden className="size-4" />}
          {zoomed ? "تصغير" : "تكبير"}
          <Kbd>Z</Kbd>
        </button>
      </figcaption>
    </figure>
  );
}

export function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || e.metaKey || e.ctrlKey || e.altKey);
}
