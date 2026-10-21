"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export const qk = {
  payments: (status: string) => ["payments", status] as const,
  paymentsPage: (status: string, page: number, sort: string) => ["payments", status, page, sort] as const,
  paymentCounts: ["payments", "counts"] as const,
  payment: (id: string) => ["payment", id] as const,
  proofUrl: (id: string) => ["payment", id, "proof"] as const,
  counts: ["queue-counts"] as const,
  // Commission: everything under ["commissions"] so one invalidation refreshes balances and lists.
  commissionSummary: ["commissions", "summary"] as const,
  commissionBrands: ["commissions", "brands"] as const,
  commissionBrand: (brandId: string) => ["commissions", "brand", brandId] as const,
  commissionLedger: (brandId: string, page: number) => ["commissions", "brand", brandId, "ledger", page] as const,
  settlements: (status: string, page: number) => ["commissions", "settlements", status, page] as const,
  settlementCounts: ["commissions", "settlements", "counts"] as const,
  settlementProof: (id: string) => ["settlement", id, "proof"] as const,
  platformSettings: ["platform-settings"] as const,
};

/** Number of items waiting in each admin queue (shown in the rail). */
export function useQueueCounts() {
  return useQuery({
    queryKey: qk.counts,
    queryFn: async () => {
      const total = (path: string, status: string) =>
        api.page(path, { status, limit: 1 }).then((p) => p.meta.total);
      const [payments, brands, reports, settlements] = await Promise.all([
        total("/admin/payments", "PENDING_REVIEW"),
        total("/admin/brands", "PENDING_REVIEW"),
        total("/admin/reports", "OPEN"),
        total("/admin/settlements", "PENDING_REVIEW"),
      ]);
      return { payments, brands, reports, settlements };
    },
    refetchInterval: 60_000,
  });
}
