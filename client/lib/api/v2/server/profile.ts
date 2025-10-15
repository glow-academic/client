/**
 * Server-side fetcher functions for profile v2 API
 * Memoized with React cache to prevent duplicate requests
 * Used for server-side prefetching and in auth.ts
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import {
  ProfileDetailResponseSchema,
  ProfileSimpleDetailResponseSchema,
} from "../schemas/profile";

/**
 * Fetch profile detail from FastAPI server (memoized)
 * Used for prefetching profile data in pages
 */
export const fetchProfileDetail = cache(
  async (profileId: string, currentProfileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/profile/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ profileId, currentProfileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch profile detail");
    }

    const data = await res.json();
    return ProfileDetailResponseSchema.parse(data);
  }
);

/**
 * Fetch simple profile detail from FastAPI server (memoized)
 * Used for auth operations and simple profile lookups
 */
export const fetchProfileSimple = cache(async (profileId: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/profile/detail-simple`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profileId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch simple profile detail");
  }

  const data = await res.json();
  return ProfileSimpleDetailResponseSchema.parse(data);
});

/**
 * Fetch profile by alias from FastAPI server (memoized)
 * Used in auth.ts for profile lookup by alias
 * Note: This requires a server endpoint that supports alias lookup
 * For now, using client-side profileRepo until server endpoint is available
 */
export const fetchProfileByAlias = async (alias: string) => {
  // This will be implemented when we add a server endpoint for alias lookup
  // For now, we'll keep using the client-side profileRepo in auth.ts
  throw new Error("fetchProfileByAlias not yet implemented - use profileRepo");
};
