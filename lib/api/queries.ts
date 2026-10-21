"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { TicketCounts } from "./types";

export const qk = {
  payments: (status: string) => ["payments", status] as const,
  paymentsPage: (status: string, page: number, sort: string) =>
    ["payments", status, page, sort] as const,
  paymentCounts: ["payments", "counts"] as const,
  payment: (id: string) => ["payment", id] as const,
  proofUrl: (id: string) => ["payment", id, "proof"] as const,
  counts: ["queue-counts"] as const,
  // Commission: everything under ["commissions"] so one invalidation refreshes balances and lists.
  commissionSummary: ["commissions", "summary"] as const,
  commissionBrands: ["commissions", "brands"] as const,
  commissionBrand: (brandId: string) =>
    ["commissions", "brand", brandId] as const,
  commissionLedger: (brandId: string, page: number) =>
    ["commissions", "brand", brandId, "ledger", page] as const,
  settlements: (status: string, page: number) =>
    ["commissions", "settlements", status, page] as const,
  settlementCounts: ["commissions", "settlements", "counts"] as const,
  settlementProof: (id: string) => ["settlement", id, "proof"] as const,
  platformSettings: ["platform-settings"] as const,
  // Promotions: everything under ["promotions"].
  coupons: ["promotions", "coupons"] as const,
  campaigns: ["promotions", "campaigns"] as const,
  campaignProducts: (campaignId: string, limit: number) =>
    ["promotions", "campaigns", campaignId, "products", limit] as const,
  // Support: everything under ["tickets"].
  tickets: (status: string, page: number) =>
    ["tickets", "list", status, page] as const,
  ticketCounts: ["tickets", "counts"] as const,
  ticket: (id: string) => ["tickets", "detail", id] as const,
  returns: (status: string, page: number) =>
    ["returns", "list", status, page] as const,
  returnCounts: ["returns", "counts"] as const,
  questions: (visibility: string, answer: string, q: string, page: number) =>
    ["questions", "list", visibility, answer, q, page] as const,
  // Ads: everything under ["ads"].
  ads: (status: string, page: number) => ["ads", "list", status, page] as const,
  adCounts: ["ads", "counts"] as const,
  adPrices: ["ads", "prices"] as const,
  adProof: (id: string) => ["ad", id, "proof"] as const,
  // Resellers: everything under ["resellers"].
  payouts: (status: string, page: number) =>
    ["resellers", "payouts", status, page] as const,
  payoutCounts: ["resellers", "payouts", "counts"] as const,
  missedSearches: (days: number) => ["insights", "searches", days] as const,
};

/** Number of items waiting in each admin queue (shown in the rail). */
export function useQueueCounts() {
  return useQuery({
    queryKey: qk.counts,
    queryFn: async () => {
      const total = (path: string, status: string) =>
        api.page(path, { status, limit: 1 }).then((p) => p.meta.total);
      const [payments, brands, reports, settlements, tickets, ads, payouts] =
        await Promise.all([
          total("/admin/payments", "PENDING_REVIEW"),
          total("/admin/brands", "PENDING_REVIEW"),
          total("/admin/reports", "OPEN"),
          total("/admin/settlements", "PENDING_REVIEW"),
          // Only cases waiting for an admin's decision; on the others the store still has time.
          api
            .get<TicketCounts>("/admin/tickets/counts")
            .then((c) => c.ESCALATED),
          total("/admin/ads", "PENDING_REVIEW"),
          total("/admin/resellers/payouts", "REQUESTED"),
        ]);
      return { payments, brands, reports, settlements, tickets, ads, payouts };
    },
    refetchInterval: 60_000,
  });
}
