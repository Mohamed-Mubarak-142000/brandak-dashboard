import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentDetailPage } from "@/components/payments/payment-detail-page";

export const metadata: Metadata = { title: "مراجعة دفعة" };

export default function PaymentPage() {
  // The client page reads the route param, which needs a Suspense boundary under Cache Components.
  return (
    <Suspense>
      <PaymentDetailPage />
    </Suspense>
  );
}
