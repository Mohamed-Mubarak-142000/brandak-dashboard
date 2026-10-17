import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Image src="/brand/dakakeen-logo.png" alt="دكاكين" width={1254} height={1254} priority className="h-28 w-auto" />
        <h1 className="mt-8 font-display text-page text-ink">لوحة الإدارة</h1>
        <p className="mt-1.5 text-body text-ink-2">الدخول لفريق إدارة المنصة فقط.</p>
        <div className="mt-8 rounded-md border border-line bg-surface p-6 sm:p-8">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
