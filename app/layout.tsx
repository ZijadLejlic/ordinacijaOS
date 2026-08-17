import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { VercelAnalytics } from "@/components/analytics/vercel-analytics";
import { VercelSpeedInsights } from "@/components/analytics/vercel-speed-insights";
import { routing } from "@/i18n/routing";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "optional",
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "optional",
});

export const metadata: Metadata = {
  title: {
    default: "DentOrd",
    template: "%s · DentOrd",
  },
  description: "Cloud softver za stomatološke ordinacije",
  metadataBase: new URL("https://dentord.com"),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DentOrd",
    statusBarStyle: "default",
  },
  themeColor: "#0B6EF5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Do not call getLocale() here — it reads request headers and forces the
  // whole tree dynamic (Fluid CPU on every marketing crawl). Locale layout
  // sets `document.documentElement.lang` to the real locale.
  return (
    <html
      lang={routing.defaultLocale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <VercelAnalytics />
        <VercelSpeedInsights />
      </body>
    </html>
  );
}
