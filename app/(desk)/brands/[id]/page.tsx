import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandDetail } from "@/components/brands/brand-detail";

export const metadata: Metadata = { title: "تفاصيل البراند" };

export default function Page() {
  return (
    <Suspense>
      <BrandDetail />
    </Suspense>
  );
}
