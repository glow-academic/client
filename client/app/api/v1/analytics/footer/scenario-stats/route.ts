import { AnalyticsFiltersSchema } from "@/lib/analytics";
import { analyticsRepo } from "@/lib/repos/analyticsRepo";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ScenarioStatsFiltersSchema = AnalyticsFiltersSchema.extend({
  parameterId: z.string().uuid().optional(),
  simulationIds: z.array(z.string().uuid()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const filters = ScenarioStatsFiltersSchema.parse(body);

    log.info("analytics.footer.scenario-stats", {
      message: "Fetching scenario stats analytics",
      context: { filters },
    });

    const result = await analyticsRepo.getScenarioStats(
      filters,
      filters.parameterId,
      filters.simulationIds
    );

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("analytics.footer.scenario-stats.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
