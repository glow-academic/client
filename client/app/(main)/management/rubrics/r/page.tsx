/**
 * app/(main)/management/rubrics/r/page.tsx
 * Rubric page for the rubrics section. Redirects to rubrics page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rubrics",
  description: "Rubrics in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function RubricsPage() {
  return redirect("/management/rubrics");
}
