/**
 * app/(main)/analytics/leaderboard/page.tsx
 * Leaderboard page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import Leaderboard from "@/components/leaderboard/Leaderboard";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata } from "next";
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

/** ---- Inline filters function for leaderboard page ---- */
const getLeaderboardFilters = cache(async (searchParams?: URLSearchParams) => {
  const session = await auth();

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

export const metadata: Metadata = {
  title: "Leaderboard",
  description: `Leaderboard in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

interface LeaderboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
  // Parse search params
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Get filters from search params or defaults
  const filters = await getLeaderboardFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
  );

  // Fetch leaderboard data server-side
  const leaderboardData = await getLeaderboard({
    body: filters,
  });

  return (
    <div className="space-y-6">
      <Leaderboard leaderboardData={leaderboardData} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { LeaderboardIn, LeaderboardOut };
