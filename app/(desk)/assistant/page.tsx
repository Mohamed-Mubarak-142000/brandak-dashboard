import type { Metadata } from "next";
import { Suspense } from "react";
import { ConversationsPage } from "@/components/assistant/conversations-page";

export const metadata: Metadata = { title: "مساعد المتاجر" };

export default function Page() {
  // The page keeps its filters and page in the URL, which must sit inside Suspense.
  return (
    <Suspense>
      <ConversationsPage />
    </Suspense>
  );
}
