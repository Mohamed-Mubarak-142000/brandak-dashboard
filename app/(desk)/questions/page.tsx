import type { Metadata } from "next";
import { Suspense } from "react";
import { QuestionsPage } from "@/components/questions/questions-page";

export const metadata: Metadata = { title: "أسئلة المنتجات" };

export default function Page() {
  // The page keeps its filters, search and page in the URL, which must sit inside Suspense.
  return (
    <Suspense>
      <QuestionsPage />
    </Suspense>
  );
}
