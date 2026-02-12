/**
 * app/(main)/leaderboard/page.tsx
 * Root-level leaderboard page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Leaderboard from "@/components/artifacts/leaderboard/Leaderboard";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { loadLeaderboardSearchParams } from "@/lib/search-params/leaderboard";

/** ---- Strong types from OpenAPI ---- */
type LeaderboardIn = InputOf<"/api/v4/artifacts/leaderboard/get", "post">;
type LeaderboardOut = OutputOf<"/api/v4/artifacts/leaderboard/get", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Leaderboard responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getLeaderboard = async (
  input: LeaderboardIn
): Promise<LeaderboardOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/leaderboard/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Leaderboard",
    description:
      "Teaching assistant performance leaderboard and comparative analytics. View rankings, performance metrics, and comparative assessment data to track teaching effectiveness and identify top performers in pedagogical practice.",
  };
}

interface LeaderboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
  // Parse search params via nuqs loader
  const q = loadLeaderboardSearchParams(await searchParams);

  // Compute defaults and resolve filters
  const { defaults, profileContext } = await computeAnalyticsDefaults();
  const filters = resolveAnalyticsFilters(q, defaults, profileContext);

  // Fetch leaderboard data server-side
  const leaderboardData = await getLeaderboard({
    body: {
      start_date: filters.startDate,
      end_date: filters.endDate,
      cohort_ids: filters.cohortIds,
      department_ids: filters.departmentIds,
      roles: filters.roles,
      simulation_filters: filters.simulationFilters,
      sort_by: "highest_score",
      sort_order: "desc",
      page_limit: 50,
      page_offset: 0,
      accessible_cohort_ids: profileContext.cohort_ids || [],
      accessible_department_ids: profileContext.department_ids || [],
    },
  });

  return (
    <div className="space-y-6" data-page="leaderboard-index">
      <Leaderboard leaderboardData={leaderboardData} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { LeaderboardIn, LeaderboardOut };
