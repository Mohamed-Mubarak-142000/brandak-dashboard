"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import type { PaymentListItem } from "@/lib/api/types";
import { PaymentReview } from "./payment-review";

/** Full-page review of one payment, opened from the table's "view details" / "review" actions. */
export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // After a decision, continue with the oldest receipt still waiting; otherwise go back to the table.
  const goToNext = async () => {
    try {
      const { items } = await api.page<PaymentListItem>("/admin/payments", {
        status: "PENDING_REVIEW",
        sort: "oldest",
        limit: 2,
      });
      const next = items.find((p) => p._id !== id);
      router.replace(next ? `/payments/${next._id}` : "/payments?status=PENDING_REVIEW");
    } catch {
      router.replace("/payments");
    }
  };

  return (
    <div className="min-h-dvh bg-surface">
      <div className="mx-auto max-w-[1280px]">
        <PaymentReview key={id} paymentId={id} onDecided={goToNext} onBack={() => router.push("/payments")} />
      </div>
    </div>
  );
}
