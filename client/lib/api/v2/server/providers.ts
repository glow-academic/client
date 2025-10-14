/**
 * Server-side fetcher functions for providers v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import { ProviderDetailResponseSchema } from "../schemas/providers";

export const fetchProviderDetail = cache(
  async (providerId: string, profileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/providers/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ providerId, profileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch provider detail");
    }

    const data = await res.json();
    return ProviderDetailResponseSchema.parse(data);
  }
);
