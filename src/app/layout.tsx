import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "First Share — buy your first tokenized stock",
  description: "A friendly, step-by-step guide to buying your first tokenized stock on BNB Chain.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f0b90b",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookies = (await headers()).get("cookie");
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers cookies={cookies}>{children}</Providers>
      </body>
    </html>
  );
}
