import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { BottomNav } from "@/components/site/bottom-nav";
import { SmoothScroll } from "@/components/site/smooth-scroll";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const siteUrl =
  (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3002").replace(
    /\/+$/,
    "",
  );

const description =
  "MISO Tickets helps fans discover concerts, festivals, nightlife, and cultural events with verified digital tickets, secure checkout, QR door access, and official anti-scalping resale.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MISO Tickets | Verified Event Tickets & Official Resale",
    template: "%s · MISO Tickets",
  },
  description,
  applicationName: "MISO Tickets",
  generator: "Next.js",
  keywords: [
    "MISO Tickets",
    "MISO events",
    "MISO ticketing",
    "MISO resale",
    "verified event tickets",
    "concert tickets",
    "festival tickets",
    "nightlife tickets",
    "verified digital ticketing",
    "ERC-721 tickets",
    "event organizer dashboard",
    "anti-scalping resale",
    "Web3 events",
    "official ticket resale marketplace",
  ],
  authors: [{ name: "MISO Tickets" }],
  creator: "MISO Tickets",
  publisher: "MISO Tickets",
  category: "events",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "MISO Tickets",
    title: "MISO Tickets | Verified Event Tickets & Official Resale",
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "MISO Tickets | Verified Event Tickets & Official Resale",
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
  themeColor: "#0e0e10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${geist.variable} ${geistMono.variable} ${fraunces.variable}`}
    >
      <body className="font-sans">
        <SmoothScroll />
        <Header />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <Footer />
        <BottomNav />
        <Toaster />
      </body>
    </html>
  );
}
