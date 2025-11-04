/**
 * Server-side fetcher functions for personas v2 API
 * These are used for server-side prefetching in Next.js pages and BFF routes
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api/v2/api-base";
import { cache } from "react";
import { PersonaDetailResponseSchema } from "../schemas/personas";

/**
 * Fetch persona detail from FastAPI server (memoized)
 * Used in both BFF routes and server components
 */
export const fetchPersonaDetail = cache(
  async (personaId: string, profileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/personas/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ personaId, profileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch persona detail");
    }

    const data = await res.json();
    return PersonaDetailResponseSchema.parse(data);
  }
);

/**
 * Fetch default persona detail from FastAPI server (memoized)
 * Used in both BFF routes and server components
 */
export const fetchPersonaDetailDefault = cache(async (profileId: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/personas/detail-default`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profileId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch default persona detail");
  }

  const data = await res.json();
  return PersonaDetailResponseSchema.parse(data);
});
