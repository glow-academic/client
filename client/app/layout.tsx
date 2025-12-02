import { getSession } from "@/auth";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | GLOW",
    default: "GLOW",
  },
  description: "Graduate Learning Orientation Workshop",
  icons: {
    icon: [
      { url: "/glow-icon-simple.svg", type: "image/svg+xml" },
      { url: "/glow-icon.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: [{ url: "/glow-icon.svg", sizes: "512x512", type: "image/svg+xml" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession(); // server-side; no client network
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
