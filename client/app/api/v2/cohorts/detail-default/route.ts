import { CohortDetailDefaultRequestSchema } from "@/lib/api/v2/schemas/cohorts";
import { fetchCohortDetailDefault } from "@/lib/api/v2/server/cohorts";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = CohortDetailDefaultRequestSchema.parse(body);

    const result = await fetchCohortDetailDefault(request.profileId);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("cohorts.v2.detail-default.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
