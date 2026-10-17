import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandsPage } from "@/components/brands/brands-page";

export const metadata: Metadata = { title: "المتاجر" };

export default function Page() {
  return (
    <Suspense>
      <BrandsPage />
    </Suspense>
  );
}
