import type { Metadata } from "next";
import { Suspense } from "react";
import { PromotionsPage } from "@/components/promotions/promotions-page";

export const metadata: Metadata = { title: "العروض" };

export default function Page() {
  // The page keeps its tab in the URL, which must sit inside Suspense.
  return (
    <Suspense>
      <PromotionsPage />
    </Suspense>
  );
}
