import { PersonaDetailDefaultRequestSchema } from "@/lib/api/v2/schemas/personas";
import { fetchPersonaDetailDefault } from "@/lib/api/v2/server/personas";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = PersonaDetailDefaultRequestSchema.parse(body);

    const result = await fetchPersonaDetailDefault(request.profileId);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("personas.v2.detail-default.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
