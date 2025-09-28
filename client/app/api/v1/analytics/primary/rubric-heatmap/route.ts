import { AnalyticsFiltersSchema } from "@/lib/analytics";
import { analyticsRepo } from "@/lib/repos/analyticsRepo";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RubricHeatmapRequestSchema = AnalyticsFiltersSchema.extend({
  rubricId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    ),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const filters = RubricHeatmapRequestSchema.parse(body);

    log.info("analytics.primary.rubric-heatmap", {
      message: "Fetching rubric heatmap analytics",
      context: { filters },
    });

    const result = await analyticsRepo.getRubricHeatmap(filters);

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("analytics.primary.rubric-heatmap.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
