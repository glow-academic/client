import { SimulationDetailRequestSchema } from "@/lib/api/v2/schemas/simulations";
import { fetchSimulationDetail } from "@/lib/api/v2/server/simulations";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = SimulationDetailRequestSchema.parse(body);

    const result = await fetchSimulationDetail(
      request.simulationId,
      request.profileId
    );
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("simulations.v2.detail.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
