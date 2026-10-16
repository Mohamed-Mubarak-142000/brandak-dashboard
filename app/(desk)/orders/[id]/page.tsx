import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderDetail } from "@/components/orders/order-detail";

export const metadata: Metadata = { title: "تفاصيل الطلب" };

export default function Page() {
  return (
    <Suspense>
      <OrderDetail />
    </Suspense>
  );
}
