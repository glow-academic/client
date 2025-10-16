import { ParameterDetailDefaultRequestSchema } from "@/lib/api/v2/schemas/parameters";
import { fetchParameterDetailDefault } from "@/lib/api/v2/server/parameters";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = ParameterDetailDefaultRequestSchema.parse(body);

    const result = await fetchParameterDetailDefault(request.profileId);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("parameters.v2.detail-default.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
