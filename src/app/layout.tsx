import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clanker | Put AI Robots to Work",
  description:
    "The memecoin with AI robot workers that claim fees, buy back and burn $CLANKER on-chain — every minute, permissionless.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://clanker.fun"
  ),
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Clanker",
    description:
      "AI robots that automatically buy back and burn their own token. On-chain. Permissionless.",
    siteName: "Clanker",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clanker",
    description:
      "AI robots that automatically buy back and burn their own token. On-chain. Permissionless.",
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
