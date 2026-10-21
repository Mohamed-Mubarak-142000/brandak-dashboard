import type { Metadata } from "next";
import { Suspense } from "react";
import { ResellersPage } from "@/components/resellers/resellers-page";

export const metadata: Metadata = { title: "أرباح المسوّقين" };

export default function Page() {
  // The page keeps its filters and page in the URL, which must sit inside Suspense.
  return (
    <Suspense>
      <ResellersPage />
    </Suspense>
  );
}
