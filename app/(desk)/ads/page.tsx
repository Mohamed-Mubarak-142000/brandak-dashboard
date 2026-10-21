import type { Metadata } from "next";
import { Suspense } from "react";
import { AdsPage } from "@/components/ads/ads-page";

export const metadata: Metadata = { title: "الإعلانات" };

export default function Page() {
  // The page keeps its filters and page in the URL, which must sit inside Suspense.
  return (
    <Suspense>
      <AdsPage />
    </Suspense>
  );
}
