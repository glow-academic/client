/**
 * Server-side fetcher functions for scenarios v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api/v2/api-base";
import { cache } from "react";
import { ScenarioDetailResponseSchema } from "../schemas/scenarios";

export const fetchScenarioDetail = cache(
  async (scenarioId: string, profileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/scenarios/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ scenarioId, profileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch scenario detail");
    }

    const data = await res.json();
    return ScenarioDetailResponseSchema.parse(data);
  }
);

export const fetchScenarioDetailDefault = cache(async (profileId: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/scenarios/detail-default`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profileId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch default scenario detail");
  }

  const data = await res.json();
  return ScenarioDetailResponseSchema.parse(data);
});
