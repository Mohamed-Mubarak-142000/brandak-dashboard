import type { Metadata } from "next";
import { Suspense } from "react";
import { InsightsPage } from "@/components/insights/insights-page";

export const metadata: Metadata = { title: "الناس بتدوّر على إيه" };

export default function Page() {
  // The page keeps its period in the URL, which must sit inside Suspense.
  return (
    <Suspense>
      <InsightsPage />
    </Suspense>
  );
}
