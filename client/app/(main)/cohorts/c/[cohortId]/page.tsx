/**
 * app/(main)/cohorts/c/[cohortId]/page.tsx
 * Cohort dashboard page for the cohort.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { use } from "react";

import Leaderboard from "@/components/analytics/Leaderboard";
import { getCohort } from "@/utils/queries/cohorts/get-cohort";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ cohortId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { cohortId } = await params;

  const cohort = await getCohort(cohortId);

  return {
    title: `${cohort?.title || "Cohort"}`,
    description: `${cohort ? `${cohort.title} ${cohort.description}` : "Cohort"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default function CohortDashboardPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = use(params);
  return (
    <div className="space-y-6">
      <Leaderboard cohortId={cohortId} />
    </div>
  );
}
