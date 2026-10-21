import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketDetail } from "@/components/support/ticket-detail";

export const metadata: Metadata = { title: "تذكرة دعم" };

export default function Page() {
  // The client page reads the route param, which needs a Suspense boundary under Cache Components.
  return (
    <Suspense>
      <TicketDetail />
    </Suspense>
  );
}
