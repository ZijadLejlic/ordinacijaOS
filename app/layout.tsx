import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const marketingDisplay = Fraunces({
  variable: "--font-marketing-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "OrdinacijaOS",
    template: "%s · OrdinacijaOS",
  },
  description: "Cloud softver za stomatološke ordinacije",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} ${marketingDisplay.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
