import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/site/header";
import { BottomNav } from "@/components/site/bottom-nav";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Miso — On-chain ticketing",
  description: "ERC-721 tickets on Base. Tap to enter — no QR, no screenshot, no forwarded PDF.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans pb-16 md:pb-0">
        <Header />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <BottomNav />
        <Toaster />
      </body>
    </html>
  );
}
