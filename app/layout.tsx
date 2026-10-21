import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// One family for everything: Cairo is clear at small sizes and familiar to Egyptian users.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "فاترينة · لوحة الإدارة", template: "%s · فاترينة" },
  description: "لوحة إدارة منصة فاترينة",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fefcf7",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
