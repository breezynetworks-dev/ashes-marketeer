import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fallen Market | Ashes of Creation",
  description: "Marketplace data tool for the Fallen guild",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
      >
        <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
        <div className="fixed inset-0 bg-gradient-mesh pointer-events-none" />
        <Nav />
        <main className="relative ml-64">{children}</main>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
