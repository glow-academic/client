/**
 * app/a/page.tsx
 * Attempts page. Redirects to new attempt page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attempts",
  description: `Attempts in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function AttemptPage() {
  return redirect("/home");
}
