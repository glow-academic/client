/**
 * app/(main)/management/cohorts/new/page.tsx
 * New cohort page for the cohorts section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import NewCohort from "@/components/management/cohorts/NewCohort";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cohorts",
  description: "Create new cohorts in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function NewCohortPage() {
  return (
    <div className="space-y-6">
      <NewCohort />
    </div>
  );
}
