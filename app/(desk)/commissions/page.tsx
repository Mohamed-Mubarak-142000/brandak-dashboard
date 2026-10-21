import type { Metadata } from "next";
import { Suspense } from "react";
import { CommissionsPage } from "@/components/commissions/commissions-page";

export const metadata: Metadata = { title: "العمولات" };

export default function Page() {
  // The page keeps its tab, filters and page in the URL, which must sit inside Suspense.
  return (
    <Suspense>
      <CommissionsPage />
    </Suspense>
  );
}
