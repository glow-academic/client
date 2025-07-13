/**
 * app/(main)/create/cohorts/new/page.tsx
 * New cohort page for the cohorts section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import NewCohort from "@/components/create/cohorts/NewCohort";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cohorts",
  description: `Create new cohorts in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function NewCohortPage() {
  return (
    <div className="space-y-6">
      <NewCohort />
    </div>
  );
}
