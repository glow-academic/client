/**
 * Server-side fetcher functions for home v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api/v2/api-base";
import { cache } from "react";
import { HomeFilters, HomeOverviewResponseSchema } from "../schemas/home";

/**
 * Fetch home overview analytics from FastAPI server (memoized)
 * Note: Home always shows general simulations (no roles/simulationFilters)
 */
export const fetchHome = cache(async (filters: HomeFilters) => {
  const res = await fetch(`${getApiBase()}/api/v2/home`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(filters),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch home overview");
  }

  const data = await res.json();
  return HomeOverviewResponseSchema.parse(data);
});
