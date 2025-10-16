import { ModelDetailRequestSchema } from "@/lib/api/v2/schemas/providers";
import { fetchModelDetail } from "@/lib/api/v2/server/models";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = ModelDetailRequestSchema.parse(body);

    const result = await fetchModelDetail(
      request.modelId,
      request.providerId,
      request.profileId
    );
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("providers.models.v2.detail.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
