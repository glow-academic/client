/**
 * Server-side fetcher functions for breadcrumbs v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import { BreadcrumbsResponseSchema } from "@/lib/api/v2/schemas/breadcrumbs";

/**
 * Fetch breadcrumbs from FastAPI server (memoized)
 * Used for server-side prefetching in Next.js pages
 */
export const fetchBreadcrumbs = cache(async (pathname: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/breadcrumbs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pathname }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch breadcrumbs");
  }

  const data = await res.json();
  return BreadcrumbsResponseSchema.parse(data);
});

