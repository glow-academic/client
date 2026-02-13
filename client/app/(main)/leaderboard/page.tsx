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

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/leaderboard/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/leaderboard/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/leaderboard/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
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
  const { defaults, profileContext, analyticsFilters } = await computeAnalyticsDefaults();
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
      accessible_cohort_ids: analyticsFilters?.cohort_options?.map(o => o.value) ?? [],
      accessible_department_ids: analyticsFilters?.department_options?.map(o => o.value) ?? [],
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
