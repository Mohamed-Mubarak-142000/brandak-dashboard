import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentsTable } from "@/components/payments/payments-table";

export const metadata: Metadata = { title: "مدفوعات الباقات" };

export default function PaymentsPage() {
  // The table keeps its filter, page and sort in the URL, which must sit inside Suspense.
  return (
    <Suspense>
      <PaymentsTable />
    </Suspense>
  );
}
