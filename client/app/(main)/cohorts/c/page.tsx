/**
 * app/(main)/create/cohorts/c/page.tsx
 * Cohort edit page for the cohorts section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Cohorts",
    description: "Manage learning cohorts for teaching assistant training programs. Organize groups of teaching assistants, track cohort progress, and coordinate group-based learning activities for effective L&D program administration.",
  };
}

export default function CohortEditPage() {
  return redirect("/create/cohorts");
}
