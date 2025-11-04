/**
 * Server-side fetcher functions for attempts v2 API
 * Memoized with React cache to prevent duplicate requests
 * Used for server-side prefetching in Next.js pages and BFF routes
 */

import { getApiBase } from "@/lib/api/v2/api-base";
import { cache } from "react";
import { AttemptFullResponseSchema } from "../schemas/attempts";

/**
 * Fetch attempt full data from FastAPI server (memoized)
 * Used for prefetching attempt data in pages
 * Includes attempt, simulation, chats, messages, rubrics, etc.
 */
export const fetchAttemptFull = cache(async (attemptId: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/attempts/${attemptId}/full`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch attempt full data");
  }

  const data = await res.json();
  return AttemptFullResponseSchema.parse(data);
});
