import {
  analyticsRepo,
} from "@/lib/repos/analyticsRepo";
import { AnalyticsFiltersSchema } from "@/lib/analytics";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const filters = AnalyticsFiltersSchema.parse(body);

    log.info("analytics.leaderboard.improvement-per-day", {
      message: "Fetching improvement per day analytics",
      context: { filters },
    });

    const result = await analyticsRepo.getImprovementPerDay(filters);

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("analytics.leaderboard.improvement-per-day.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
