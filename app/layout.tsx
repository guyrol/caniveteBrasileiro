import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Canivete Brasileiro - Multi-Tool Utility",
  description: "Bilingual financial salary/hourly converters and time frame accumulators for modern professionals and freelancers.",
  keywords: ["salary converter", "hourly rate", "time calculator", "time frame accumulator", "canivete brasileiro"],
  authors: [{ name: "Canivete Brasileiro" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
