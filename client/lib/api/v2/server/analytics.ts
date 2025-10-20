/**
 * Server-side fetcher functions for analytics utilities
 * Only contains refresh - all analytics data fetchers are in separate files:
 * - dashboard.ts
 * - home.ts
 * - practice.ts
 * - leaderboard.ts
 * - reports.ts
 * - pricing.ts
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import { RefreshResponseSchema } from "../schemas/analytics";

/**
 * Refresh analytics materialized view (memoized)
 */
export const refreshAnalytics = cache(async () => {
  const res = await fetch(`${getApiBase()}/api/v2/analytics/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to refresh analytics");
  }

  const data = await res.json();
  return RefreshResponseSchema.parse(data);
});
