/**
 * Server-side fetcher functions for parameters v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api/v2/api-base";
import { cache } from "react";
import { ParameterDetailResponseSchema } from "../schemas/parameters";

export const fetchParameterDetail = cache(
  async (parameterId: string, profileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/parameters/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ parameterId, profileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch parameter detail");
    }

    const data = await res.json();
    return ParameterDetailResponseSchema.parse(data);
  }
);

export const fetchParameterDetailDefault = cache(async (profileId: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/parameters/detail-default`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profileId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch default parameter detail");
  }

  const data = await res.json();
  return ParameterDetailResponseSchema.parse(data);
});
