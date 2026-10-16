import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <h1 className="font-display text-display text-ink">براندك</h1>
        <p className="mt-2 text-body text-ink-2">لوحة إدارة المنصة. الدخول لفريق الإدارة فقط.</p>
        <div className="mt-8 rounded-md border border-line bg-surface p-6 sm:p-8">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
