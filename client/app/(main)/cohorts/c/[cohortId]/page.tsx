/**
 * app/(main)/cohorts/c/[cohortId]/page.tsx
 * Cohort dashboard page for the cohort.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { getSession } from "@/auth";

import Leaderboard from "@/components/leaderboard/Leaderboard";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata, ResolvingMetadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type LeaderboardIn = InputOf<"/api/v3/leaderboard", "post">;
type LeaderboardOut = OutputOf<"/api/v3/leaderboard", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getLeaderboard = cache(
  async (input: LeaderboardIn): Promise<LeaderboardOut> => {
    return api.post("/leaderboard", input);
  }
);

/** ---- Inline filters function for cohort page ---- */
const getCohortFilters = cache(async (searchParams?: URLSearchParams) => {
  const session = await getSession();

  // Fetch profile context to get earliestAttemptDate
  const profileContext = await api.post("/profile/context", {
    body: {
      actualProfileId: session?.user?.profileId || "",
      effectiveProfileId: session?.effectiveProfileId || "",
      pathname: "/",
    },
  });

  // Compute startDate using same logic as analytics context
  let startDate: Date;
  if (profileContext.earliestAttemptDate) {
    startDate = new Date(profileContext.earliestAttemptDate);
    startDate.setHours(0, 0, 0, 0);
  } else {
    // Fallback to 30 days ago (matching analytics context)
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  }

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const defaults = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    cohortIds: [] as string[],
    roles: [] as string[],
    simulationFilters: ["general" as const],
    departmentIds: [] as string[],
  };

  // If search params are provided, merge them with defaults
  if (searchParams) {
    return searchParamsToFilters(searchParams, defaults);
  }

  return defaults;
});

/** ---- Metadata ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ cohortId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { cohortId } = await params;
  const session = await getSession();
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
  const defaultFilters = await getCohortFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
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
