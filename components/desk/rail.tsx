"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import * as RDialog from "@radix-ui/react-dialog";
import {
  Flag,
  HandCoins,
  LayoutList,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  MessageCircleQuestion,
  ReceiptText,
  ScrollText,
  Settings2,
  ShoppingBag,
  TicketPercent,
  Store,
  Undo2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useQueueCounts } from "@/lib/api/queries";

type CountKey = "payments" | "brands" | "reports" | "settlements" | "tickets" | "ads";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  count?: CountKey;
  ready: boolean;
}

// Ordered by how often the work needs attention, not alphabetically.
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "يحتاج قرارك",
    items: [
      // The count is buyer-protection cases waiting for a decision (the store missed its 48 hours).
      { href: "/support", label: "الدعم والشكاوى", icon: LifeBuoy, count: "tickets", ready: true },
      // The count is commission receipts waiting for review.
      { href: "/commissions", label: "العمولات", icon: HandCoins, count: "settlements", ready: true },
      // The count is placement receipts waiting for review.
      { href: "/ads", label: "الإعلانات", icon: Megaphone, count: "ads", ready: true },
      { href: "/brands", label: "المتاجر", icon: Store, count: "brands", ready: true },
      { href: "/reports", label: "البلاغات", icon: Flag, count: "reports", ready: true },
    ],
  },
  {
    group: "المتابعة",
    items: [
      { href: "/", label: "نظرة عامة", icon: LayoutList, ready: true },
      { href: "/orders", label: "الطلبات", icon: ShoppingBag, ready: true },
      { href: "/returns", label: "المرتجعات", icon: Undo2, ready: true },
      { href: "/questions", label: "أسئلة المنتجات", icon: MessageCircleQuestion, ready: true },
      { href: "/promotions", label: "العروض", icon: TicketPercent, ready: true },
      { href: "/users", label: "المستخدمون", icon: Users, ready: true },
      // Subscription payments from before the commission model; kept for the record.
      { href: "/payments", label: "مدفوعات الباقات", icon: ReceiptText, count: "payments", ready: true },
      { href: "/audit", label: "سجل العمليات", icon: ScrollText, ready: true },
      { href: "/settings", label: "الإعدادات", icon: Settings2, ready: true },
      { href: "/account", label: "حسابي", icon: UserRound, ready: true },
    ],
  },
];

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Image src="/brand/fatrina-mark.png" alt="" width={36} height={36} priority className="h-9 w-auto" />
      <span className="font-display text-section leading-none text-ink">فاترينة</span>
      <span className="rounded-sm border border-line px-1.5 py-0.5 text-meta text-ink-3">الإدارة</span>
    </span>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const counts = useQueueCounts();

  return (
    <nav aria-label="القائمة الرئيسية" className="flex flex-col gap-6">
      {NAV.map((section) => (
        <div key={section.group}>
          <p className="mb-1.5 px-3 text-meta font-medium text-ink-3">{section.group}</p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const count = item.count ? counts.data?.[item.count] : undefined;
              const body = (
                <>
                  <item.icon aria-hidden className="size-[18px] shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.ready && count ? (
                    <span
                      className={cn(
                        "num min-w-6 rounded-full px-1.5 text-center text-meta font-semibold leading-5",
                        active ? "bg-accent text-on-accent" : "bg-accent-soft text-accent",
                      )}
                      aria-label={`${count} بانتظار القرار`}
                    >
                      {count}
                    </span>
                  ) : null}
                  {!item.ready && <span className="text-meta text-ink-3">قريبًا</span>}
                </>
              );
              const base =
                "relative flex h-11 items-center gap-3 rounded-sm px-3 text-ui transition-colors";
              return (
                <li key={item.href}>
                  {item.ready ? (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        base,
                        active
                          ? "bg-surface font-semibold text-ink shadow-[inset_-3px_0_0_var(--brand)]"
                          : "text-ink-2 hover:bg-surface/70 hover:text-ink",
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <span aria-disabled className={cn(base, "cursor-not-allowed text-ink-3")} tabIndex={0}>
                          {body}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          side="left"
                          sideOffset={8}
                          className="z-50 rounded-sm bg-ink px-2.5 py-1.5 text-meta text-ground shadow-pop"
                        >
                          هذه الصفحة قيد التنفيذ
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        // Full reload on purpose: drops every cached query of the ended session.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login");
      }}
      className="flex h-11 w-full items-center gap-3 rounded-sm px-3 text-ui text-ink-2 transition-colors hover:bg-surface/70 hover:text-danger disabled:opacity-60"
    >
      <LogOut aria-hidden className="size-[18px] rtl:-scale-x-100" />
      {busy ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}
    </button>
  );
}

/** Desktop: fixed rail on the start (right) side. Mobile: top bar with a slide-in menu. */
export function Rail() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-line bg-ground px-3 py-5 lg:flex">
        <div className="mb-8 px-3">
          <Wordmark />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        <LogoutButton />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ground/95 px-4 backdrop-blur lg:hidden pt-[env(safe-area-inset-top)]">
        <Wordmark />
        <RDialog.Root open={open} onOpenChange={setOpen}>
          <RDialog.Trigger aria-label="فتح القائمة" className="grid size-11 place-items-center rounded-sm text-ink hover:bg-surface">
            <Menu className="size-5" />
          </RDialog.Trigger>
          <RDialog.Portal>
            <RDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
            <RDialog.Content
              dir="rtl"
              className="fixed inset-y-0 start-0 z-50 flex w-[min(300px,85vw)] flex-col bg-ground px-3 py-5 shadow-pop"
            >
              <div className="mb-6 flex items-center justify-between px-3">
                <RDialog.Title asChild>
                  <span>
                    <Wordmark />
                  </span>
                </RDialog.Title>
                <RDialog.Description className="sr-only">القائمة الرئيسية</RDialog.Description>
                <RDialog.Close aria-label="إغلاق القائمة" className="grid size-11 place-items-center rounded-sm hover:bg-surface">
                  <X className="size-5" />
                </RDialog.Close>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NavList onNavigate={() => setOpen(false)} />
              </div>
              <LogoutButton />
            </RDialog.Content>
          </RDialog.Portal>
        </RDialog.Root>
      </header>
    </>
  );
}
