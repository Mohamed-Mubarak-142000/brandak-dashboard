import type { Metadata } from "next";
import { Suspense } from "react";
import { UsersPage } from "@/components/users/users-page";

export const metadata: Metadata = { title: "المستخدمون" };

export default function Page() {
  return (
    <Suspense>
      <UsersPage />
    </Suspense>
  );
}
