import { AnalyticsFiltersSchema } from "@/lib/analytics";
import { analyticsRepo } from "@/lib/repos/analyticsRepo";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const filters = AnalyticsFiltersSchema.parse(body);

    log.info("analytics.practice", {
      message: "Fetching practice overview analytics",
      context: { filters },
    });

    const result = await analyticsRepo.getPracticeOverview(filters);

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("analytics.practice.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
