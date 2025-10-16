import { RubricDetailDefaultRequestSchema } from "@/lib/api/v2/schemas/rubrics";
import { fetchRubricDetailDefault } from "@/lib/api/v2/server/rubrics";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = RubricDetailDefaultRequestSchema.parse(body);

    const result = await fetchRubricDetailDefault(request.profileId);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("rubrics.v2.detail-default.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
