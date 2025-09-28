import { AnalyticsFiltersSchema } from "@/lib/analytics";
import { analyticsRepo } from "@/lib/repos/analyticsRepo";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const filters = AnalyticsFiltersSchema.parse(body);

    log.info("analytics.secondary.cohort-performance", {
      message: "Fetching cohort performance analytics",
      context: { filters },
    });

    const result = await analyticsRepo.getCohortPerformance(filters);

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("analytics.secondary.cohort-performance.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
