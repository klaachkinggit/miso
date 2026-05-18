import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { BottomNav } from "@/components/site/bottom-nav";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3002";

const description =
  "On-chain ticketing on Base. Buyers checkout with Stripe and mint an ERC-721 ticket per tier; organizers onboard via Stripe Connect and track sales, revenue, and door redemptions in real time. Anti-scalping resale with price caps.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Miso — On-chain ticketing on Base",
    template: "%s · Miso",
  },
  description,
  applicationName: "Miso",
  generator: "Next.js",
  keywords: [
    "NFT ticketing",
    "Base Sepolia",
    "ERC-721 tickets",
    "Stripe Connect",
    "event organizer dashboard",
    "anti-scalping resale",
    "Web3 events",
    "primary + resale marketplace",
  ],
  authors: [{ name: "Miso" }],
  creator: "Miso",
  publisher: "Miso",
  category: "events",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Miso",
    title: "Miso — On-chain ticketing on Base",
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Miso — On-chain ticketing on Base",
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans">
        <Header />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <Footer />
        <BottomNav />
        <Toaster />
      </body>
    </html>
  );
}
