/**
 * Health check BFF endpoint
 * Proxies to server health endpoint for comprehensive system health
 */

import { getApiBase } from "@/lib/api-base";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Call server health endpoint
    const serverHealth = await fetch(`${getApiBase()}/api/v2/logs/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!serverHealth.ok) {
      return NextResponse.json(
        {
          status: "unhealthy",
          error: `Server health endpoint returned ${serverHealth.status}`,
        },
        { status: serverHealth.status }
      );
    }

    const healthData = await serverHealth.json();

    // Return server health data directly (client checks are done server-side now)
    return NextResponse.json(healthData);
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error:
          error instanceof Error ? error.message : "Failed to fetch health",
      },
      { status: 500 }
    );
  }
}
