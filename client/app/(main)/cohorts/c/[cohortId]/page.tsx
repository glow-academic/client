/**
 * app/(main)/cohorts/c/[cohortId]/page.tsx
 * Cohort dashboard page for the cohort.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { auth } from "@/auth";
import Leaderboard from "@/components/leaderboard/Leaderboard";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getDefaultAnalyticsFilters } from "@/lib/server/analytics-filters";
import type { Metadata, ResolvingMetadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type LeaderboardIn = InputOf<"/api/v3/leaderboard", "post">;
type LeaderboardOut = OutputOf<"/api/v3/leaderboard", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getLeaderboard = cache(
  async (input: LeaderboardIn): Promise<LeaderboardOut> => {
    return api.post("/leaderboard", input);
  },
);

/** ---- Metadata ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ cohortId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { cohortId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const cohort = await api.post("/cohorts/detail", {
      body: { cohortId, profileId },
    });
    return {
      title: `${cohort?.title || "Cohort"}`,
      description: `${cohort ? `${cohort.title} ${cohort.description || ""}` : "Cohort"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Cohort",
      description: `Cohort in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Server page with SSR ---- */
interface CohortDashboardPageProps {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CohortDashboardPage({
  params,
  searchParams,
}: CohortDashboardPageProps) {
  const { cohortId } = await params;

  // Parse search params
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Get filters from search params or defaults, then override cohortIds with the cohortId from URL
  const defaultFilters = await getDefaultAnalyticsFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined,
  );
  const filters = { ...defaultFilters, cohortIds: [cohortId] };

  // Fetch leaderboard data server-side
  const leaderboardData = await getLeaderboard({
    body: filters,
  });

  return (
    <div className="space-y-6">
      <Leaderboard cohortId={cohortId} leaderboardData={leaderboardData} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { LeaderboardIn, LeaderboardOut };
