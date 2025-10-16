import { SimulationDetailDefaultRequestSchema } from "@/lib/api/v2/schemas/simulations";
import { fetchSimulationDetailDefault } from "@/lib/api/v2/server/simulations";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = SimulationDetailDefaultRequestSchema.parse(body);

    const result = await fetchSimulationDetailDefault(request.profileId);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("simulations.v2.detail-default.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
