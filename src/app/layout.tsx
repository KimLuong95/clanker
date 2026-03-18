import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CLANKER #001 — PSA GEM MINT 10 | Digital Collectible on Solana",
  description:
    "The SEC declared memecoins are Digital Collectibles. CLANKER #001 — PSA GEM MINT 10. Auto buyback & burn every minute. How much can this Digital Collectible be worth?",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://clanker001.fun"
  ),
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "CLANKER #001 — PSA GEM MINT 10",
    description:
      "The SEC declared memecoins are Digital Collectibles. CLANKER #001 auto buys back & burns its own token every minute. On-chain. Permissionless.",
    siteName: "CLANKER #001",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CLANKER #001 — PSA GEM MINT 10",
    description:
      "The SEC declared memecoins are Digital Collectibles. CLANKER #001 auto buys back & burns its own token every minute.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="scanline-overlay" />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
