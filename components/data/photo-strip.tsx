"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";

/** Customer/store photos as thumbnails; one click opens the full-size image. */
export function PhotoStrip({ urls, label, size = 72 }: { urls: string[]; label: string; size?: number }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!urls.length) return null;
  return (
    <>
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {urls.map((url, i) => (
          <li key={url}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`عرض الصورة ${i + 1} بالحجم الكامل`}
              className="block overflow-hidden rounded-sm border border-line hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Image src={url} alt="" width={size} height={size} unoptimized className="object-cover" style={{ width: size, height: size }} />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && (
        <Dialog open size="lg" onOpenChange={(o) => !o && setOpen(null)} title={`${label} (${open + 1} من ${urls.length})`}>
          {/* Full size, as uploaded; next/image would resize it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[open]} alt="" className="mx-auto max-h-[70dvh] w-auto rounded-sm object-contain" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <a href={urls[open]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ui text-accent underline-offset-4 hover:underline">
              فتح في نافذة جديدة
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
            {urls.length > 1 && (
              <div className="flex gap-2">
                <button type="button" disabled={open === 0} onClick={() => setOpen(open - 1)} className="h-9 rounded-sm border border-line-strong px-3 text-ui disabled:opacity-50">
                  السابقة
                </button>
                <button
                  type="button"
                  disabled={open === urls.length - 1}
                  onClick={() => setOpen(open + 1)}
                  className="h-9 rounded-sm border border-line-strong px-3 text-ui disabled:opacity-50"
                >
                  التالية
                </button>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
