import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandCommissionDetail } from "@/components/commissions/brand-commission-detail";

export const metadata: Metadata = { title: "عمولة المتجر" };

export default function Page() {
  // The client page reads the route param, which needs a Suspense boundary under Cache Components.
  return (
    <Suspense>
      <BrandCommissionDetail />
    </Suspense>
  );
}
