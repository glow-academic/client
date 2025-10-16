/**
 * Factory for creating V2 analytics BFF routes
 * These routes call the FastAPI server using the fetcher pattern
 */

import { getApiBase } from "@/lib/api-base";
import { AnalyticsFiltersSchema } from "@/lib/api/v2/schemas/analytics";
import { log } from "@/lib/api/v2/server/logs";
import { NextRequest, NextResponse } from "next/server";

/**
 * Creates a BFF route handler that proxies to the server v2 endpoint
 * @param serverEndpoint - The server endpoint path (e.g., "/header/average-score")
 * @param logKey - The log key for errors (e.g., "analytics.v2.header.average-score")
 */
export function createAnalyticsBFFRoute(
  serverEndpoint: string,
  logKey: string
) {
  return async function POST(req: NextRequest) {
    try {
      const body = await req.json();
      const filters = AnalyticsFiltersSchema.parse(body);

      // Call server v2 endpoint
      const response = await fetch(
        `${getApiBase()}/api/v2/analytics${serverEndpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(filters),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.detail || error.message || "Server request failed"
        );
      }

      const result = await response.json();
      return NextResponse.json(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      log.error(logKey, {
        message: errorMessage,
        error,
      });

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  };
}

/**
 * Creates a BFF route handler for refresh (no filters needed)
 */
export function createRefreshBFFRoute() {
  return async function POST() {
    try {
      const response = await fetch(`${getApiBase()}/api/v2/analytics/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.detail || error.message || "Server request failed"
        );
      }

      const result = await response.json();
      return NextResponse.json(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      log.error("analytics.v2.refresh.error", {
        message: errorMessage,
        error,
      });

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  };
}
