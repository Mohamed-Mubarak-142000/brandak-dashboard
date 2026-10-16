// Arabic text with Latin digits: amounts and references must read exactly like the InstaPay receipt.
const LOCALE = "ar-EG-u-nu-latn";

const money = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric" });
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

export const formatMoney = (amount: number) => `${money.format(amount)} ج.م`;
export const formatNumber = (n: number) => money.format(n);
export const formatDate = (iso?: string | null) => (iso ? date.format(new Date(iso)) : "—");
export const formatDateTime = (iso?: string | null) => (iso ? dateTime.format(new Date(iso)) : "—");

export function formatRelative(iso?: string | null, now = Date.now()) {
  if (!iso) return "—";
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "الآن";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  if (abs < 30 * 86_400) return relative.format(Math.round(seconds / 86_400), "day");
  return formatDate(iso);
}

/** "+201012345678" → "0101 234 5678", the way Egyptian numbers are read aloud. */
export function formatPhone(e164?: string | null) {
  if (!e164) return "—";
  const national = e164.replace(/^\+20/, "0");
  return national.length === 11 ? `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}` : national;
}

/** Case- and diacritic-insensitive matching for quick search (Arabic letter variants unified). */
export function normalizeSearch(value: string) {
  return value
    .replace(/[ً-ٰٟـ]/g, "") // tashkeel and tatweel
    .replace(/[أإآ]/g, "ا") // alef variants
    .replace(/ى/g, "ي") // alef maqsura to yaa
    .replace(/ة/g, "ه") // taa marbuta to haa
    .toLowerCase()
    .replace(/[\s-]+/g, "");
}

export const BILLING_LABEL = { MONTHLY: "شهري", YEARLY: "سنوي" } as const;
