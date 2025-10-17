import { PersonaDetailRequestSchema } from "@/lib/api/v2/schemas/personas";
import { fetchPersonaDetail } from "@/lib/api/v2/server/personas";
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/api/v2/server/logs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = PersonaDetailRequestSchema.parse(body);

    const result = await fetchPersonaDetail(
      request.personaId,
      request.profileId
    );
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("personas.v2.detail.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
