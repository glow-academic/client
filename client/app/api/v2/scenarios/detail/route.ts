import { ScenarioDetailRequestSchema } from "@/lib/api/v2/schemas/scenarios";
import { fetchScenarioDetail } from "@/lib/api/v2/server/scenarios";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = ScenarioDetailRequestSchema.parse(body);

    const result = await fetchScenarioDetail(request.scenarioId, request.profileId);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("scenarios.v2.detail.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
