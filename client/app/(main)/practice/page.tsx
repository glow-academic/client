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
// Using /training/get for simulation cards (enhanced with stats)
type PracticeCardsIn = InputOf<"/api/v4/training/get", "post">;
type PracticeCardsOut = OutputOf<"/api/v4/training/get", "post">;
// Using /attempt/list for history section
type PracticeHistoryIn = InputOf<"/api/v4/attempt/list", "post">;
type PracticeHistoryOut = OutputOf<"/api/v4/attempt/list", "post">;

// Practice component uses cards data directly (no merge needed)
type PracticeOut = PracticeCardsOut;

/** ---- Direct fetch for simulation cards (enhanced with stats) ---- */
const getPracticeCards = async (
  input: PracticeCardsIn
): Promise<PracticeCardsOut> => {
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

/** ---- Direct fetch for history data ---- */
const getPracticeHistory = async (
  input: PracticeHistoryIn
): Promise<PracticeHistoryOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/attempt/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

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
  // practice: true for practice mode

  // Cards endpoint (now includes all stats needed for simulation cards)
  const cardsFilters: PracticeCardsIn = {
    body: {
      practice: true,
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

  // Fetch cards data (now includes all stats needed for simulation cards)
  const practiceData = await getPracticeCards(cardsFilters);

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
      <Practice practiceData={practiceData} isGuest={isGuest} />

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
  historySimulationIds?: string[] | undefined;
  historyScenarioIds?: string[] | undefined;
  historyInfiniteMode?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
  departmentIds: string[];
}) {
  // Build history filters using /attempt/list endpoint
  // profile_id removed - comes from X-Profile-Id header automatically
  // Convert camelCase to snake_case for API
  // Default date range: last year
  // practice: true for practice mode
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const historyFilters: PracticeHistoryIn = {
    body: {
      practice: true,
      start_date: oneYearAgo.toISOString(),
      end_date: now.toISOString(),
      department_ids: departmentIds,
      page: historyPage,
      page_size: historyPageSize,
      show_archived: false,
      ...(historySearch && { search: historySearch }),
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

  const historyData = await getPracticeHistory(historyFilters);

  // Calculate archived/unarchived counts from data (practice history API doesn't provide these)
  const dataArray = historyData.data || [];
  const archivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => item.is_archived).length;
  const unarchivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => !item.is_archived).length;

  // Use server-provided data directly (no transformation needed)
  // Extract options from API response and cast to expected format
  const profileOptions = (historyData.profile_options || []).map((opt: { value?: string | null; label?: string | null; count?: number | null }) => {
    const count = typeof opt.count === "number" ? opt.count : undefined;
    return {
      value: String(opt.value || ""),
      label: String(opt.label || ""),
      ...(count !== undefined && { count }),
    };
  });
  const simulationOptions = (historyData.simulation_options || []).map(
    (opt: { value?: string | null; label?: string | null; count?: number | null }) => {
      const count = typeof opt.count === "number" ? opt.count : undefined;
      return {
        value: String(opt.value || ""),
        label: String(opt.label || ""),
        ...(count !== undefined && { count }),
      };
    }
  );
  const scenarioOptions = (historyData.scenario_options || []).map((opt: { value?: string | null; label?: string | null; count?: number | null }) => {
    const count = typeof opt.count === "number" ? opt.count : undefined;
    return {
      value: String(opt.value || ""),
      label: String(opt.label || ""),
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
export type { PracticeHistoryIn, PracticeHistoryOut, PracticeOut };
