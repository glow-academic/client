/**
 * app/(main)/cohorts/c/[cohortId]/page.tsx
 * Cohort dashboard page for the cohort.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { auth } from "@/auth";
import Leaderboard from "@/components/analytics/Leaderboard";
import { analyticsLeaderboardBundleKeys } from "@/lib/api/v2/keys";
import { fetchAnalyticsLeaderboard } from "@/lib/api/v2/server/analytics";
import { fetchCohortDetail } from "@/lib/api/v2/server/cohorts";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ cohortId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { cohortId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const cohort = await fetchCohortDetail(cohortId, profileId);
    return {
      title: `${cohort?.title || "Cohort"}`,
      description: `${cohort ? `${cohort.title} ${cohort.description}` : "Cohort"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Cohort",
      description: `Cohort in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

export default async function CohortDashboardPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = await params;

  const queryClient = getQueryClient();

  // Prefetch leaderboard data with default date range (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const filters = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    cohortIds: [cohortId],
    roles: [],
    simulationFilters: [],
    departmentIds: [],
  };

  await queryClient.prefetchQuery({
    queryKey: analyticsLeaderboardBundleKeys.list(filters),
    queryFn: () => fetchAnalyticsLeaderboard(filters),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <Leaderboard cohortId={cohortId} />
      </div>
    </HydrationBoundary>
  );
}
