/**
 * Server-side fetcher functions for models v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import { ModelDetailResponseSchema } from "../schemas/models";

export const fetchModelDetail = cache(
  async (modelId: string, providerId: string, profileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/providers/models/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ modelId, providerId, profileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch model detail");
    }

    const data = await res.json();
    return ModelDetailResponseSchema.parse(data);
  }
);
