import { AgentDetailRequestSchema } from "@/lib/api/v2/schemas/agents";
import { fetchAgentDetail } from "@/lib/api/v2/server/agents";
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/api/v2/server/logs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = AgentDetailRequestSchema.parse(body);

    const result = await fetchAgentDetail(request.agentId, request.profileId);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("agents.v2.detail.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
