import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportsPage } from "@/components/reports/reports-page";

export const metadata: Metadata = { title: "البلاغات" };

export default function Page() {
  return (
    <Suspense>
      <ReportsPage />
    </Suspense>
  );
}
