/**
 * app/(main)/leaderboard/page.tsx
 * Root-level leaderboard page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Leaderboard from "@/components/leaderboard/Leaderboard";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata } from "next";
import { getLayoutContext } from "../layout-server";

/** ---- Strong types from OpenAPI ---- */
type LeaderboardIn = InputOf<"/api/v4/analytics/leaderboard/get", "post">;
type LeaderboardOut = OutputOf<"/api/v4/analytics/leaderboard/get", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Leaderboard responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getLeaderboard = async (
  input: LeaderboardIn
): Promise<LeaderboardOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/analytics/leaderboard/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Inline filters function for leaderboard page ---- */
async function getLeaderboardFilters(searchParams?: URLSearchParams) {
  // Use cached layout context (reuses data already fetched by layout)
  // profileId come from X-Profile-Id header (auto-injected by request-core.ts)
  const profileContext = await getLayoutContext({
    body: {},
  });

  // Compute startDate using same logic as analytics context
  let startDate: Date;
  if (profileContext.earliest_attempt_date) {
    startDate = new Date(profileContext.earliest_attempt_date);
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
  let filters = defaults;
  if (searchParams) {
    const parsedFilters = searchParamsToFilters(searchParams, defaults);
    filters = {
      startDate: parsedFilters.startDate || defaults.startDate,
      endDate: parsedFilters.endDate || defaults.endDate,
      cohortIds: parsedFilters.cohortIds || defaults.cohortIds,
      roles: parsedFilters.roles || defaults.roles,
      simulationFilters: (parsedFilters.simulationFilters ||
        defaults.simulationFilters) as typeof defaults.simulationFilters,
      departmentIds: parsedFilters.departmentIds || defaults.departmentIds,
    };
  }

  // For member users: scope cohort filter to their profile's cohorts if no cohortIds specified
  // For instructional+: use all accessible cohorts from profile context if no cohortIds specified
  const cohortIds =
    filters.cohortIds && filters.cohortIds.length > 0
      ? filters.cohortIds
      : profileContext.cohort_ids || [];
  const departmentIds =
    filters.departmentIds && filters.departmentIds.length > 0
      ? filters.departmentIds
      : profileContext.department_ids || [];
  const roles =
    filters.roles && filters.roles.length > 0
      ? filters.roles
      : profileContext.scoped_roles || [];

  return {
    ...filters,
    cohortIds,
    departmentIds,
    roles,
  };
}

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
  // Access control handled server-side in layout
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts)
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
    body: {
      start_date: filters.startDate,
      end_date: filters.endDate,
      cohort_ids: filters.cohortIds,
      department_ids: filters.departmentIds,
      roles: filters.roles,
      simulation_filters: filters.simulationFilters,
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
