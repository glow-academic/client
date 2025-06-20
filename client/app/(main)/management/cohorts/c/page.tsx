/**
 * app/(main)/management/cohorts/c/page.tsx
 * Cohort edit page for the cohorts section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cohorts",
  description: "Manage cohorts in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function CohortEditPage() {
  return redirect("/management/cohorts");
}
