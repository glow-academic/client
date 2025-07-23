/**
 * app/(main)/cohorts/e/page.tsx
 * Cohort edit page for the cohorts section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cohorts",
  description: `Manage cohorts in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function CohortEditPage() {
  return redirect("/cohorts");
}
