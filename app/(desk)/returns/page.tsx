import type { Metadata } from "next";
import { Suspense } from "react";
import { ReturnsPage } from "@/components/returns/returns-page";

export const metadata: Metadata = { title: "المرتجعات" };

export default function Page() {
  // The page keeps its filters and page in the URL, which must sit inside Suspense.
  return (
    <Suspense>
      <ReturnsPage />
    </Suspense>
  );
}
