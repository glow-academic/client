/**
 * Server-side fetcher functions for pricing v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import { AnalyticsFilters } from "../schemas/base";
import { PricingAnalyticsResponseSchema } from "../schemas/pricing";

/**
 * Fetch pricing analytics from FastAPI server (memoized)
 */
export const fetchPricing = cache(async (filters: AnalyticsFilters) => {
  const res = await fetch(`${getApiBase()}/api/v2/pricing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(filters),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Failed to fetch pricing analytics: ${res.status} ${errorText}`
    );
  }

  const data = await res.json();
  return PricingAnalyticsResponseSchema.parse(data);
});

