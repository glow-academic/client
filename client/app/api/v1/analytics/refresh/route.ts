import { analyticsRepo } from "@/lib/repos/analyticsRepo";
import { log } from "@/utils/logger";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await analyticsRepo.refreshMaterializedView();

    return NextResponse.json({
      success: true,
      message: "Analytics data refreshed successfully",
      status: "success",
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    log.error("analytics.refresh.failed", {
      message: errorMessage,
      error,
      context: { function: "POST", route: "/api/v1/analytics/refresh" },
    });

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        status: "error",
      },
      { status: 500 },
    );
  }
}
