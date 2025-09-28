import { AnalyticsFiltersSchema } from "@/lib/analytics";
import { analyticsRepo } from "@/lib/repos/analyticsRepo";
import { logError, logInfo } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const filters = AnalyticsFiltersSchema.parse(body);

    logInfo("Analytics home overview request", {
      startDate: filters.startDate,
      endDate: filters.endDate,
      profileId: filters.profileId,
      cohortIds: filters.cohortIds?.length || 0,
      roles: filters.roles?.length || 0,
      simulationFilters: filters.simulationFilters?.length || 0,
    });

    const result = await analyticsRepo.getHomeOverview(filters);

    logInfo("Analytics home overview success", {
      mode: result.mode,
      dataCount:
        result.mode === "ta"
          ? (result as any).simulations?.length || 0
          : result.mode === "instructor"
            ? (result as any).bySimulationCohort?.length || 0
            : 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    logError("Analytics home overview error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to fetch home overview analytics" },
      { status: 500 }
    );
  }
}
