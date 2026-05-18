import { getSession } from "@/auth";

import type { Metadata } from "next";
import { cookies } from "next/headers";
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
  // Favicon is handled by icon.tsx which uses GlowIconComponent
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession(); // server-side; no client network
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  // Only apply class for explicit light/dark; "system" resolved client-side
  const themeClass = themeCookie === "dark" || themeCookie === "light" ? themeCookie : "";

  return (
    <html lang="en" className={themeClass} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <Providers session={session} theme={themeCookie}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
