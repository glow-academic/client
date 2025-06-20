/**
 * app/a/page.tsx
 * Agent page. Redirects to new agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attempts",
  description: "Attempts in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function AttemptPage() {
  return redirect("/home");
}
