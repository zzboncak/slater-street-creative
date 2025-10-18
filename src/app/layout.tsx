import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartProvider } from "@/context/CartContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteName = "Slater Street Candles";
const siteDescription =
  "Hand-poured, premium candles. Natural wax, clean scents, fast shipping.";
const baseUrl = new URL(
  process.env.SITE_URL || "https://slaterstreetcreative.com",
);

export const metadata: Metadata = {
  metadataBase: baseUrl,
  title: {
    default: siteName,
    template: "%s · " + siteName,
  },
  description: siteDescription,
  applicationName: siteName,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName,
    title: siteName,
    description: siteDescription,
    url: baseUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CartProvider>
          <Header />
          <main className="min-h-[calc(100vh-140px)]">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
