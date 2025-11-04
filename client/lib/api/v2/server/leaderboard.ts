/**
 * Server-side fetcher functions for leaderboard v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api/v2/api-base";
import { cache } from "react";
import { AnalyticsFilters } from "../schemas/base";
import { LeaderboardBundleResponseSchema } from "../schemas/leaderboard";

/**
 * Fetch analytics leaderboard bundle from FastAPI server (memoized)
 */
export const fetchLeaderboard = cache(async (filters: AnalyticsFilters) => {
  const res = await fetch(`${getApiBase()}/api/v2/leaderboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(filters),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch leaderboard: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return LeaderboardBundleResponseSchema.parse(data);
});
