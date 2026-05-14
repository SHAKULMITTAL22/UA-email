import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "UA Email", template: "%s · UA Email" },
  description: "AI-first universal email client. Triaged in seconds.",
  manifest: "/manifest.webmanifest",
  applicationName: "UA Email",
  icons: { icon: "/icon-192.png", apple: "/icon-512.png" },
};

export const viewport: Viewport = {
  themeColor: "#0f0f14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}
    >
      <body className="bg-canvas text-textPrimary antialiased min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">{children}</div>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
