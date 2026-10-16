import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPage } from "@/components/account/account-page";

export const metadata: Metadata = { title: "حسابي" };

export default function Page() {
  return (
    <Suspense>
      <AccountPage />
    </Suspense>
  );
}
