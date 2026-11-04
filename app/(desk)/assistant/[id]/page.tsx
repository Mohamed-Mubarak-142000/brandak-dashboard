import type { Metadata } from "next";
import { Suspense } from "react";
import { ConversationDetail } from "@/components/assistant/conversation-detail";

export const metadata: Metadata = { title: "محادثة المساعد" };

export default function Page() {
  // The client page reads the route param, which needs a Suspense boundary under Cache Components.
  return (
    <Suspense>
      <ConversationDetail />
    </Suspense>
  );
}
