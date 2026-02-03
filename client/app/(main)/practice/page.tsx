/**
 * app/(main)/practice/page.tsx
 * Practice page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SimulationHistory from "@/components/common/history/SimulationHistory";
import Practice from "@/components/practice/Practice";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getLayoutContext } from "../layout-server";

/** ---- Strong types from OpenAPI ---- */
// Using unified training endpoints with practice: true for practice mode
// GET endpoint: operational data (scenario_ids for starting simulations)
type PracticeOperationalIn = InputOf<"/api/v4/training/get", "post">;
type PracticeOperationalOut = OutputOf<"/api/v4/training/get", "post">;
// LIST endpoint: analytical data (stats, scores, history)
type PracticeAnalyticalIn = InputOf<"/api/v4/training/list", "post">;
type PracticeAnalyticalOut = OutputOf<"/api/v4/training/list", "post">;

// Merged type for Practice component - combines operational + analytical data
type PracticeOut = Omit<PracticeAnalyticalOut, "items"> & {
  items: Array<
    NonNullable<PracticeAnalyticalOut["items"]>[number] & {
      scenario_ids?: string[] | null;
    }
  > | null;
};

/** ---- Direct fetch for operational data (scenario_ids) ---- */
const getPracticeOperational = async (
  input: PracticeOperationalIn
): Promise<PracticeOperationalOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/training/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Direct fetch for analytical data (stats, history) ---- */
const getPracticeAnalytical = async (
  input: PracticeAnalyticalIn
): Promise<PracticeAnalyticalOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/training/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Merge operational + analytical data by simulation_id ---- */
function mergePracticeData(
  operational: PracticeOperationalOut,
  analytical: PracticeAnalyticalOut
): PracticeOut {
  // Build lookup map for scenario_ids by simulation_id
  const scenarioIdsMap = new Map<string, string[]>();
  if (operational.items) {
    for (const item of operational.items) {
      if (item.simulation_id && item.scenario_ids) {
        scenarioIdsMap.set(
          String(item.simulation_id),
          item.scenario_ids.map(String)
        );
      }
    }
  }

  // Merge scenario_ids into analytical items
  const mergedItems = analytical.items?.map((item) => ({
    ...item,
    scenario_ids: item.simulation_id
      ? scenarioIdsMap.get(String(item.simulation_id)) || null
      : null,
  })) || null;

  return {
    ...analytical,
    items: mergedItems,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Practice",
    description:
      "Simulation-based practice sessions for teaching assistant training. Engage in realistic student interaction scenarios to practice pedagogical techniques, improve communication skills, and enhance teaching effectiveness through hands-on learning experiences.",
  };
}

interface PracticePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PracticePage({
  searchParams,
}: PracticePageProps) {
  // Access control handled server-side in layout
  // Practice page allows guest role users (authenticated users with guest role)
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts) or cookies
  // Parse search params
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Get profileId and departmentIds from profile context with resolved UUIDs
  // Use cached layout context (reuses data already fetched by layout)
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts) or cookies
  let profileContext;
  try {
    profileContext = await getLayoutContext({
      body: {},
    });
  } catch (error) {
    // Handle 401 Unauthorized (invalid session - profile doesn't exist)
    // This can happen if the database was reset but the session still has old profile IDs
    // The layout's getLayoutContextData will also fail with the same 401 error,
    // and the layout will show access denied UI. Re-throw the error so the layout handles it.
    if (
      error instanceof Error &&
      "status" in error &&
      (error as { status: number }).status === 401
    ) {
      // Re-throw the error - the layout's getLayoutContextData will also fail with 401,
      // and the updated layout code will show access denied UI
      throw error;
    }
    // Re-throw other errors
    throw error;
  }

  // Build practice filters - convert to snake_case
  // profile_id removed - comes from X-Profile-Id header automatically
  // Always pass department_ids (never empty array) - use all IDs from profile context
  // practice: true for practice mode (uses unified training endpoint)

  // Operational endpoint (for scenario_ids)
  const operationalFilters: PracticeOperationalIn = {
    body: {
      practice: true,
    },
  };

  // Analytical endpoint (for stats - fetching cards only, not history which is separate)
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const analyticalFilters: PracticeAnalyticalIn = {
    body: {
      practice: true,
      start_date: oneYearAgo.toISOString(),
      end_date: now.toISOString(),
      department_ids: profileContext.department_ids || [],
      page: 0,
      page_size: 1, // We only need the items (cards), not history data
      show_archived: false,
    },
  };

  // Extract pagination and filter params from search params
  const historyPage = searchParamsObj.get("historyPage")
    ? parseInt(searchParamsObj.get("historyPage") || "0", 10)
    : 0;
  const historyPageSize = searchParamsObj.get("historyPageSize")
    ? parseInt(searchParamsObj.get("historyPageSize") || "10", 10)
    : 10;
  const historySearch = searchParamsObj.get("historySearch") || undefined;
  const historyProfileIds = searchParamsObj.get("historyProfileIds")
    ? searchParamsObj.get("historyProfileIds")?.split(",").filter(Boolean)
    : undefined;
  const historySimulationIds = searchParamsObj.get("historySimulationIds")
    ? searchParamsObj.get("historySimulationIds")?.split(",").filter(Boolean)
    : undefined;
  const historyScenarioIds = searchParamsObj.get("historyScenarioIds")
    ? searchParamsObj.get("historyScenarioIds")?.split(",").filter(Boolean)
    : undefined;
  const historyInfiniteMode =
    searchParamsObj.get("historyInfiniteMode") === "true"
      ? true
      : searchParamsObj.get("historyInfiniteMode") === "false"
        ? false
        : undefined;
  const historySortBy = searchParamsObj.get("historySortBy") || "date";
  const historySortOrder = searchParamsObj.get("historySortOrder") || "desc";

  // Fetch both operational + analytical data in parallel, then merge
  const [operationalData, analyticalData] = await Promise.all([
    getPracticeOperational(operationalFilters),
    getPracticeAnalytical(analyticalFilters),
  ]);

  // Merge operational (scenario_ids) + analytical (stats) data
  const practiceData = mergePracticeData(operationalData, analyticalData);

  // Remove history from response for server-driven pagination (history is fetched separately)
  const practiceDataWithoutHistory = {
    ...practiceData,
    data: [], // history is in 'data' field from list endpoint
  };

  // Get profileId from profile context
  const profileId = profileContext.id;

  // Check if user is a guest
  const isGuest = !profileId || profileContext.role === "guest";

  // Create historyKey for Suspense boundary to trigger re-fetch on URL param changes
  // Include analytics filter params so history re-fetches when filters change
  const analyticsStartDate = searchParamsObj.get("startDate") || "";
  const analyticsEndDate = searchParamsObj.get("endDate") || "";
  const analyticsCohortIds = searchParamsObj.get("cohortIds") || "";
  const analyticsDepartmentIds = searchParamsObj.get("departmentIds") || "";
  const analyticsRoles = searchParamsObj.get("roles") || "";
  const analyticsSimulationFilters =
    searchParamsObj.get("simulationFilters") || "general";
  const historyKey = [
    historyPage,
    historyPageSize,
    historySearch || "",
    (historyProfileIds || []).join(","),
    (historySimulationIds || []).join(","),
    (historyScenarioIds || []).join(","),
    historyInfiniteMode === undefined
      ? "all"
      : historyInfiniteMode
        ? "inf"
        : "std",
    historySortBy,
    historySortOrder,
    analyticsStartDate, // Include analytics filters to trigger re-fetch when filters change
    analyticsEndDate,
    analyticsCohortIds,
    analyticsDepartmentIds,
    analyticsRoles,
    analyticsSimulationFilters,
  ].join("|");

  return (
    <div className="space-y-6">
      <Practice practiceData={practiceDataWithoutHistory} isGuest={isGuest} />

      {/* History section moved out of Practice, fully server-driven - only show for non-guests */}
      {!isGuest && (
        <div className="mt-12">
          <Suspense
            key={historyKey}
            fallback={
              <SimulationHistory
                data={[]}
                totalCount={0}
                archivedCount={0}
                unarchivedCount={0}
                pageIndex={historyPage}
                pageSize={historyPageSize}
                showExport={false}
                showArchive={false}
                singleProfile={true}
                profileOptions={[]}
                simulationOptions={[]}
                scenarioOptions={[]}
                isLoading={true}
                showModeFilter={true}
              />
            }
          >
            <PracticeHistorySection
              historyPage={historyPage}
              historyPageSize={historyPageSize}
              historySearch={historySearch}
              historyProfileIds={historyProfileIds}
              historySimulationIds={historySimulationIds}
              historyScenarioIds={historyScenarioIds}
              historyInfiniteMode={historyInfiniteMode}
              historySortBy={historySortBy}
              historySortOrder={historySortOrder}
              departmentIds={profileContext.department_ids || []}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

/** ---- Inline history section component (only used here) ---- */
async function PracticeHistorySection({
  historyPage,
  historyPageSize,
  historySearch,
  historyProfileIds,
  historySimulationIds,
  historyScenarioIds,
  historyInfiniteMode,
  historySortBy,
  historySortOrder,
  departmentIds,
}: {
  historyPage: number;
  historyPageSize: number;
  historySearch?: string | undefined;
  historyProfileIds?: string[] | undefined;
  historySimulationIds?: string[] | undefined;
  historyScenarioIds?: string[] | undefined;
  historyInfiniteMode?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
  departmentIds: string[];
}) {
  // Build history filters for practice (uses unified training endpoint)
  // profile_id removed - comes from X-Profile-Id header automatically
  // Convert camelCase to snake_case for API
  // Default date range: last year
  // practice: true for practice mode
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const historyFilters: PracticeAnalyticalIn = {
    body: {
      practice: true,
      start_date: oneYearAgo.toISOString(),
      end_date: now.toISOString(),
      department_ids: departmentIds,
      page: historyPage,
      page_size: historyPageSize,
      show_archived: false,
      ...(historySearch && { search: historySearch }),
      ...(historyProfileIds &&
        historyProfileIds.length > 0 && {
          profile_ids: historyProfileIds,
        }),
      ...(historySimulationIds &&
        historySimulationIds.length > 0 && {
          simulation_ids: historySimulationIds,
        }),
      ...(historyScenarioIds &&
        historyScenarioIds.length > 0 && {
          scenario_ids: historyScenarioIds,
        }),
      ...(historyInfiniteMode !== undefined && {
        infinite_mode: historyInfiniteMode,
      }),
      sort_by: historySortBy,
      sort_order: historySortOrder,
    },
  };

  const historyData = await getPracticeAnalytical(historyFilters);

  // Calculate archived/unarchived counts from data (practice history API doesn't provide these)
  const dataArray = historyData.data || [];
  const archivedCount = dataArray.filter((item) => item.is_archived).length;
  const unarchivedCount = dataArray.filter((item) => !item.is_archived).length;

  // Use server-provided data directly (no transformation needed)
  // Extract options from API response and cast to expected format
  const profileOptions = (historyData.profile_options || []).map((opt) => {
    const count = typeof opt["count"] === "number" ? opt["count"] : undefined;
    return {
      value: String(opt["value"] || ""),
      label: String(opt["label"] || ""),
      ...(count !== undefined && { count }),
    };
  });
  const simulationOptions = (historyData.simulation_options || []).map(
    (opt) => {
      const count = typeof opt["count"] === "number" ? opt["count"] : undefined;
      return {
        value: String(opt["value"] || ""),
        label: String(opt["label"] || ""),
        ...(count !== undefined && { count }),
      };
    }
  );
  const scenarioOptions = (historyData.scenario_options || []).map((opt) => {
    const count = typeof opt["count"] === "number" ? opt["count"] : undefined;
    return {
      value: String(opt["value"] || ""),
      label: String(opt["label"] || ""),
      ...(count !== undefined && { count }),
    };
  });

  return (
    <SimulationHistory
      data={dataArray}
      totalCount={historyData.total_count || 0}
      archivedCount={archivedCount}
      unarchivedCount={unarchivedCount}
      pageIndex={historyPage}
      pageSize={historyPageSize}
      showExport={false}
      showArchive={false}
      singleProfile={true}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
      showModeFilter={true}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PracticeAnalyticalIn as PracticeHistoryIn, PracticeAnalyticalOut as PracticeHistoryOut, PracticeOut };
