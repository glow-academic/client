/**
 * app/page.tsx
 * This is the homepage.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Home | GLOW",
  description: `GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}`,
};

export default function HomePage() {
  return redirect("/login");
}
