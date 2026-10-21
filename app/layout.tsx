import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Reem_Kufi } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

// Kufic display face — used only for page titles, the wordmark and the verification stamp.
const kufi = Reem_Kufi({
  subsets: ["arabic", "latin"],
  weight: ["500", "700"],
  variable: "--font-kufi",
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
    <html lang="ar" dir="rtl" className={`${plex.variable} ${kufi.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
