import { Suspense } from "react";
import { Rail } from "@/components/desk/rail";

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* The rail reads the pathname; under a dynamic route ([id]) that needs a Suspense boundary. */}
      <Suspense fallback={<div className="hidden w-60 shrink-0 border-e border-line lg:block" />}>
        <Rail />
      </Suspense>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
