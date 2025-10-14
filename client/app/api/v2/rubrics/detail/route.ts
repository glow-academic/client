import { RubricDetailRequestSchema } from "@/lib/api/v2/schemas/rubrics";
import { fetchRubricDetail } from "@/lib/api/v2/server/rubrics";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = RubricDetailRequestSchema.parse(body);

    const result = await fetchRubricDetail(request.rubricId, request.profileId);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("rubrics.v2.detail.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
