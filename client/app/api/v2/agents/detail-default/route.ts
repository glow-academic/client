import { AgentDetailDefaultRequestSchema } from "@/lib/api/v2/schemas/agents";
import { fetchAgentDetailDefault } from "@/lib/api/v2/server/agents";
import { log } from "@/lib/api/v2/server/logs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = AgentDetailDefaultRequestSchema.parse(body);

    const result = await fetchAgentDetailDefault(request.profileId);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("agents.v2.detail-default.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
