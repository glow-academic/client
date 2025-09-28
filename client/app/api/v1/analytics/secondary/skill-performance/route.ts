import { AnalyticsFiltersSchema } from "@/lib/analytics";
import { analyticsRepo } from "@/lib/repos/analyticsRepo";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SkillPerformanceFiltersSchema = AnalyticsFiltersSchema.extend({
  rubricId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const filters = SkillPerformanceFiltersSchema.parse(body);

    log.info("analytics.secondary.skill-performance", {
      message: "Fetching skill performance analytics",
      context: { filters },
    });

    const result = await analyticsRepo.getSkillPerformance(filters);

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("analytics.secondary.skill-performance.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
