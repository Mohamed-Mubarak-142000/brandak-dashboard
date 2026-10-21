import type { TicketOutcome, TicketType } from "@/lib/api/types";

/** Protection cases lost before the API suspends a store (mirrors the backend's MAX_STRIKES). */
export const MAX_STRIKES = 3;

export const TICKET_TYPE: Record<TicketType, string> = {
  NOT_RECEIVED: "الطلب موصلش",
  NOT_AS_DESCRIBED: "مختلف عن الوصف",
  ORDER_PROBLEM: "مشكلة في طلب",
  PAYMENT: "الدفع",
  ACCOUNT: "الحساب",
  OTHER: "أخرى",
};

export const OUTCOME_LABEL: Record<TicketOutcome, string> = {
  CUSTOMER: "لصالح العميل",
  STORE: "لصالح المتجر",
  NEUTRAL: "اتحلت ودياً",
};

export const AUTHOR_LABEL: Record<string, string> = { CUSTOMER: "العميل", BRAND: "المتجر", ADMIN: "دعم فاترينة" };

export const isActiveTicket = (status: string) => status === "WAITING_STORE" || status === "OPEN" || status === "ESCALATED";
