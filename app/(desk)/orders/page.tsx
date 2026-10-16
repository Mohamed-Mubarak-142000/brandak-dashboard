import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersPage } from "@/components/orders/orders-page";

export const metadata: Metadata = { title: "الطلبات" };

export default function Page() {
  return (
    <Suspense>
      <OrdersPage />
    </Suspense>
  );
}
