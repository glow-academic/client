/**
 * Server-side fetcher functions for reports v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import { AnalyticsFilters } from "../schemas/base";
import { ReportsBundleResponseSchema } from "../schemas/reports";

/**
 * Fetch reports bundle analytics from FastAPI server (memoized)
 */
export const fetchReports = cache(async (filters: AnalyticsFilters) => {
  const res = await fetch(`${getApiBase()}/api/v2/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(filters),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch reports");
  }

  const data = await res.json();
  return ReportsBundleResponseSchema.parse(data);
});

