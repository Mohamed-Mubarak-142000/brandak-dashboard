import type { Metadata } from "next";
import { Suspense } from "react";
import { OverviewPage } from "@/components/overview/overview-page";

export const metadata: Metadata = { title: "نظرة عامة" };

export default function Page() {
  return (
    <Suspense>
      <OverviewPage />
    </Suspense>
  );
}
