import { auth } from "@/auth";
import { getApiBase } from "@/lib/api/v2/api-base";
import { SimulationsFiltersSchema } from "@/lib/api/v2/schemas/simulations";
import { log } from "@/lib/api/v2/server/logs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Get session to derive the actual user's profile ID
    const session = await auth();
    if (!session?.user?.profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    // Override profileId from session (security)
    const filters = SimulationsFiltersSchema.parse({
      ...body,
      profileId: session.user.profileId,
    });

    const response = await fetch(`${getApiBase()}/api/v2/simulations/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(filters),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.message || "Server request failed");
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("simulations.v2.list.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
