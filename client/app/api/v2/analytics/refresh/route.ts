import { getApiBase } from "@/lib/api/v2/api-base";
import { log } from "@/lib/api/v2/server/logs";
import { NextResponse } from "next/server";

export async function POST() {
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
      throw new Error(error.detail || error.message || "Server request failed");
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
}
