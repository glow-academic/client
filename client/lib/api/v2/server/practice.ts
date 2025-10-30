/**
 * Server-side fetcher functions for practice v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import {
  PracticeFilters,
  PracticeOverviewResponseSchema,
} from "../schemas/practice";

/**
 * Fetch practice overview analytics from FastAPI server (memoized)
 * Note: Practice uses simplified filters (profile-only)
 */
export const fetchPractice = cache(async (filters: PracticeFilters) => {
  const res = await fetch(`${getApiBase()}/api/v2/practice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(filters),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Failed to fetch practice overview: ${res.status} ${errorText}`
    );
  }

  const data = await res.json();
  return PracticeOverviewResponseSchema.parse(data);
});
