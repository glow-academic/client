/**
 * app/page.tsx
 * This is the homepage.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
import Info from "@/components/home/Info";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GLOW",
  description: `GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}`,
};

export default function InfoPage() {
  return <Info />;
}
