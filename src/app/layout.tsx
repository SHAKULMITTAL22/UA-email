import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { Wordmark } from "@/components/wordmark";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: { default: "UA Email", template: "%s · UA Email" },
  description: "AI-first universal email client. Triaged in seconds.",
  manifest: "/manifest.webmanifest",
  applicationName: "UA Email",
  icons: { icon: "/icon-192.png", apple: "/icon-512.png" },
};

export const viewport: Viewport = {
  themeColor: "#f7f9fc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${fraunces.variable}`}
    >
      <body className="bg-canvas text-textPrimary antialiased min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
          <Link
            href="/"
            className="mb-6 inline-flex outline-none focus-visible:ring-2 focus-visible:ring-aiAccent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded-sm"
          >
            <Wordmark size="sm" />
          </Link>
          {children}
        </div>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
