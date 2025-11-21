/**
 * Cache utilities for detecting hard refresh and managing cache behavior.
 */

import { headers } from "next/headers";

/** ---- Helper to detect hard refresh ----
 * Checks for Cache-Control or Pragma headers that browsers send on hard refresh.
 * Returns true if hard refresh detected, false otherwise.
 */
export async function isHardRefresh(): Promise<boolean> {
  try {
    const headersList = await headers();
    const cacheControl = headersList.get("cache-control");
    const pragma = headersList.get("pragma");

    // Hard refresh indicators:
    // - Cache-Control: no-cache or max-age=0
    // - Pragma: no-cache
    return (
      cacheControl?.toLowerCase().includes("no-cache") ||
      cacheControl?.includes("max-age=0") ||
      pragma?.toLowerCase() === "no-cache"
    );
  } catch {
    // If headers() fails, default to false (use cache)
    return false;
  }
}

