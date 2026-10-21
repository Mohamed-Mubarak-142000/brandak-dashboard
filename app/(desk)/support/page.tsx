import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketsPage } from "@/components/support/tickets-page";

export const metadata: Metadata = { title: "الدعم والشكاوى" };

export default function Page() {
  // The page keeps its tab and page in the URL, which must sit inside Suspense.
  return (
    <Suspense>
      <TicketsPage />
    </Suspense>
  );
}
