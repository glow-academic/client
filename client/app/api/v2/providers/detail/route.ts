import { ProviderDetailRequestSchema } from "@/lib/api/v2/schemas/providers";
import { fetchProviderDetail } from "@/lib/api/v2/server/providers";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = ProviderDetailRequestSchema.parse(body);

    const result = await fetchProviderDetail(request.providerId, request.profileId);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("providers.v2.detail.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
