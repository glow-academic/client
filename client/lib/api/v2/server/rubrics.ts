/**
 * Server-side fetcher functions for rubrics v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import { RubricDetailResponseSchema } from "../schemas/rubrics";

export const fetchRubricDetail = cache(
  async (rubricId: string, profileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/rubrics/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ rubricId, profileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch rubric detail");
    }

    const data = await res.json();
    return RubricDetailResponseSchema.parse(data);
  }
);

export const fetchRubricDetailDefault = cache(async (profileId: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/rubrics/detail-default`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profileId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch default rubric detail");
  }

  const data = await res.json();
  return RubricDetailResponseSchema.parse(data);
});
