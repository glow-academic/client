import { CohortDetailRequestSchema } from "@/lib/api/v2/schemas/cohorts";
import { fetchCohortDetail } from "@/lib/api/v2/server/cohorts";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = CohortDetailRequestSchema.parse(body);

    const result = await fetchCohortDetail(request.cohortId, request.profileId);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("cohorts.v2.detail.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
