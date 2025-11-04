/**
 * Server-side fetcher functions for simulations v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api/v2/api-base";
import { cache } from "react";
import { SimulationDetailResponseSchema } from "../schemas/simulations";

export const fetchSimulationDetail = cache(
  async (simulationId: string, profileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/simulations/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ simulationId, profileId }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Failed to fetch simulation detail: ${res.status} ${errorText}`
      );
    }

    const data = await res.json();
    return SimulationDetailResponseSchema.parse(data);
  }
);

export const fetchSimulationDetailDefault = cache(async (profileId: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/simulations/detail-default`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profileId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch default simulation detail");
  }

  const data = await res.json();
  return SimulationDetailResponseSchema.parse(data);
});
