/**
 * Server-side fetcher functions for dashboard v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import { AnalyticsFilters } from "../schemas/base";
import { DashboardBundleResponseSchema } from "../schemas/dashboard";

/**
 * Fetch dashboard bundle analytics from FastAPI server (memoized)
 */
export const fetchDashboard = cache(async (filters: AnalyticsFilters) => {
  const res = await fetch(`${getApiBase()}/api/v2/dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(filters),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Failed to fetch dashboard: ${res.status} ${errorText}`
    );
  }

  const data = await res.json();
  return DashboardBundleResponseSchema.parse(data);
});

