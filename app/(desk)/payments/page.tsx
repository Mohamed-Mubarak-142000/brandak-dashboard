import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentsDesk } from "@/components/payments/payments-desk";

export const metadata: Metadata = { title: "مراجعة المدفوعات" };

export default function PaymentsPage() {
  // The desk reads the URL (selected receipt, filter), which must sit inside Suspense.
  return (
    <Suspense>
      <PaymentsDesk />
    </Suspense>
  );
}
