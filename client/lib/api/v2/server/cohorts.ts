/**
 * Server-side fetcher functions for cohorts v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api/v2/api-base";
import { cache } from "react";
import { CohortDetailResponseSchema } from "../schemas/cohorts";

export const fetchCohortDetail = cache(
  async (cohortId: string, profileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/cohorts/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ cohortId, profileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch cohort detail");
    }

    const data = await res.json();
    return CohortDetailResponseSchema.parse(data);
  }
);

export const fetchCohortDetailDefault = cache(async (profileId: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/cohorts/detail-default`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profileId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch default cohort detail");
  }

  const data = await res.json();
  return CohortDetailResponseSchema.parse(data);
});
