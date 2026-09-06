import type { Metadata, Viewport } from "next";
import { TelegramScript } from "@/components/TelegramScript";
import "./globals.css";

export const metadata: Metadata = {
  title: "225-yo'nalish — jonli xarita",
  description:
    "Siyob bozori — G'o'bdin qishlog'i yo'nalishidagi avtobuslarning jonli holati va jadvali.",
  applicationName: "Bus 225",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz">
      <body className="min-h-dvh antialiased">
        {children}
        <TelegramScript />
      </body>
    </html>
  );
}
