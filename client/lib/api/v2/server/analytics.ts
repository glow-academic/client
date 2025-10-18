/**
 * Server-side fetcher functions for analytics v2 API
 * Memoized with React cache to prevent duplicate requests
 * Used for server-side prefetching in Next.js pages
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import {
  AnalyticsFilters,
  LeaderboardBundleResponseSchema,
} from "../schemas/analytics";

/**
 * Fetch analytics leaderboard bundle from FastAPI server (memoized)
 * Used for prefetching leaderboard data in cohort pages
 * Includes leaderboard rows with all metrics computed server-side
 */
export const fetchAnalyticsLeaderboard = cache(
  async (filters: AnalyticsFilters) => {
    const res = await fetch(`${getApiBase()}/api/v2/analytics/leaderboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(filters),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch analytics leaderboard");
    }

    const data = await res.json();
    return LeaderboardBundleResponseSchema.parse(data);
  }
);
