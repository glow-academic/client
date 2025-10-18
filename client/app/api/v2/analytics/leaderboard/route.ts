import { AnalyticsFiltersSchema } from "@/lib/api/v2/schemas/analytics";
import { fetchAnalyticsLeaderboard } from "@/lib/api/v2/server/analytics";
import { log } from "@/lib/api/v2/server/logs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const filters = AnalyticsFiltersSchema.parse(body);

    const result = await fetchAnalyticsLeaderboard(filters);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("analytics.v2.leaderboard.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
