/**
 * app/(main)/home/page.tsx
 * Home page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SimulationHistory from "@/components/common/history/SimulationHistory";
import Home from "@/components/home/Home";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getLayoutContext } from "../layout-server";

/** ---- Strong types from OpenAPI ---- */
// Using unified training endpoints with practice: false for home
// GET endpoint: operational data (scenario_ids for starting simulations)
type HomeOperationalIn = InputOf<"/api/v4/training/get", "post">;
type HomeOperationalOut = OutputOf<"/api/v4/training/get", "post">;
// LIST endpoint: analytical data (stats, scores, history)
type HomeAnalyticalIn = InputOf<"/api/v4/training/list", "post">;
type HomeAnalyticalOut = OutputOf<"/api/v4/training/list", "post">;

// Merged type for Home component - combines operational + analytical data
type HomeOut = Omit<HomeAnalyticalOut, "items"> & {
  items: Array<
    NonNullable<HomeAnalyticalOut["items"]>[number] & {
      scenario_ids?: string[] | null;
    }
  > | null;
};

/** ---- Direct fetch for operational data (scenario_ids) ---- */
const getHomeOperational = async (
  input: HomeOperationalIn
): Promise<HomeOperationalOut> => {
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
const getHomeAnalytical = async (
  input: HomeAnalyticalIn
): Promise<HomeAnalyticalOut> => {
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
function mergeHomeData(
  operational: HomeOperationalOut,
  analytical: HomeAnalyticalOut
): HomeOut {
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

/** ---- Inline filters function for home page ---- */
async function getHomeFilters(searchParams: URLSearchParams | undefined) {
  // Use cached layout context (reuses data already fetched by layout)
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts)
  const profileContext = await getLayoutContext({
    body: {},
  });

  // Compute startDate using same logic as analytics context
  let startDate: Date;
  if (profileContext.earliest_attempt_date) {
    startDate = new Date(profileContext.earliest_attempt_date);
    startDate.setHours(0, 0, 0, 0);
  } else {
    // Fallback to 30 days ago (matching analytics context)
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  }

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const defaults = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    cohortIds: [] as string[],
    roles: [] as string[],
    simulationFilters: ["general" as const],
    departmentIds: [] as string[],
  };

  // If search params are provided, merge them with defaults
  let filters = defaults;
  if (searchParams) {
    const parsedFilters = searchParamsToFilters(searchParams, defaults);
    filters = {
      startDate: parsedFilters.startDate || defaults.startDate,
      endDate: parsedFilters.endDate || defaults.endDate,
      cohortIds: parsedFilters.cohortIds || defaults.cohortIds,
      roles: parsedFilters.roles || defaults.roles,
      simulationFilters: (parsedFilters.simulationFilters ||
        defaults.simulationFilters) as typeof defaults.simulationFilters,
      departmentIds: parsedFilters.departmentIds || defaults.departmentIds,
    };
  }

  // Always use non-empty arrays: if selected filters are empty, use all IDs from profile context
  const cohortIds =
    filters.cohortIds && filters.cohortIds.length > 0
      ? filters.cohortIds
      : profileContext.cohort_ids || [];
  const departmentIds =
    filters.departmentIds && filters.departmentIds.length > 0
      ? filters.departmentIds
      : profileContext.department_ids || [];
  const roles =
    filters.roles && filters.roles.length > 0
      ? filters.roles
      : profileContext.scoped_roles || [];

  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    cohortIds,
    departmentIds,
    roles,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Home",
    description:
      "Comprehensive learning and development dashboard for graduate teaching assistants. Track simulation-based practice sessions, review pedagogical assessments, and monitor teaching performance metrics.",
  };
}

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  // Access control handled server-side in layout
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts)
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

  // Get filters from search params or defaults, then subset to Home fields
  // Note: getHomeFilters uses getLayoutContext which reuses cached data from layout
  const defaultFilters = await getHomeFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
  );

  // Extract subset for Home: startDate, endDate
  // Always include cohortIds and departmentIds (they are guaranteed to be non-empty from getHomeFilters)
  // profileId removed - comes from X-Profile-Id header automatically
  // Convert camelCase to snake_case for API
  // practice: false for home mode (uses unified training endpoint)

  // Operational endpoint (for scenario_ids)
  const operationalFilters: HomeOperationalIn = {
    body: {
      practice: false,
    },
  };

  // Analytical endpoint (for stats - fetching cards only, not history which is separate)
  const analyticalFilters: HomeAnalyticalIn = {
    body: {
      practice: false,
      start_date: defaultFilters.startDate,
      end_date: defaultFilters.endDate,
      cohort_ids: defaultFilters.cohortIds, // Always non-empty
      department_ids: defaultFilters.departmentIds, // Always non-empty
      page: 0,
      page_size: 1, // We only need the items (cards), not history data
      show_archived: false,
    },
  };

  // Extract pagination and filter params from search params
  // Note: historyProfileIds removed - home history is single-user (uses auth header)
  const historyPage = searchParamsObj.get("historyPage")
    ? parseInt(searchParamsObj.get("historyPage") || "0", 10)
    : 0;
  const historyPageSize = searchParamsObj.get("historyPageSize")
    ? parseInt(searchParamsObj.get("historyPageSize") || "10", 10)
    : 10;
  const historySearch = searchParamsObj.get("historySearch") || undefined;
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
    getHomeOperational(operationalFilters),
    getHomeAnalytical(analyticalFilters),
  ]);

  // Merge operational (scenario_ids) + analytical (stats) data
  const homeData = mergeHomeData(operationalData, analyticalData);

  // Remove history from response for server-driven pagination (history is fetched separately)
  const homeDataWithoutHistory = {
    ...homeData,
    data: [], // history is in 'data' field from list endpoint
  };

  // Create historyKey for Suspense boundary to trigger re-fetch on URL param changes
  // Include analytics filter params so history re-fetches when filters change
  // Note: historyProfileIds removed - home history is single-user
  const historyKey = [
    historyPage,
    historyPageSize,
    historySearch || "",
    (historySimulationIds || []).join(","),
    (historyScenarioIds || []).join(","),
    historyInfiniteMode === undefined
      ? "all"
      : historyInfiniteMode
        ? "inf"
        : "std",
    historySortBy,
    historySortOrder,
    defaultFilters.startDate, // Include analytics filters to trigger re-fetch when filters change
    defaultFilters.endDate,
    defaultFilters.cohortIds.join(","),
    defaultFilters.departmentIds.join(","),
    defaultFilters.roles.join(","),
    (
      defaultFilters as typeof defaultFilters & { simulationFilters?: string[] }
    ).simulationFilters?.join(",") || "general",
  ].join("|");

  return (
    <div className="space-y-6">
      <Home homeData={homeDataWithoutHistory} />

      {/* History section moved out of Home, fully server-driven */}
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
              showExport={true}
              showArchive={false}
              singleProfile={true}
              initialFilters={defaultFilters}
              profileOptions={[]}
              simulationOptions={[]}
              scenarioOptions={[]}
              isLoading={true}
            />
          }
        >
          <HomeHistorySection
            defaultFilters={defaultFilters}
            historyPage={historyPage}
            historyPageSize={historyPageSize}
            historySearch={historySearch}
            historySimulationIds={historySimulationIds}
            historyScenarioIds={historyScenarioIds}
            historyInfiniteMode={historyInfiniteMode}
            historySortBy={historySortBy}
            historySortOrder={historySortOrder}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** ---- Inline history section component (only used here) ---- */
async function HomeHistorySection({
  defaultFilters,
  historyPage,
  historyPageSize,
  historySearch,
  historySimulationIds,
  historyScenarioIds,
  historyInfiniteMode,
  historySortBy,
  historySortOrder,
}: {
  defaultFilters: {
    startDate: string;
    endDate: string;
    cohortIds: string[];
    departmentIds: string[];
    roles: string[];
  };
  historyPage: number;
  historyPageSize: number;
  historySearch?: string | undefined;
  historySimulationIds?: string[] | undefined;
  historyScenarioIds?: string[] | undefined;
  historyInfiniteMode?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
}) {
  // Build history filters matching logic from page.tsx
  // profileId removed - comes from X-Profile-Id header automatically
  // roles and profile_ids removed - home history is single-user
  // Convert camelCase to snake_case for API
  // practice: false for home mode (uses unified training endpoint)
  const historyFilters: HomeAnalyticalIn = {
    body: {
      practice: false,
      start_date: defaultFilters.startDate,
      end_date: defaultFilters.endDate,
      cohort_ids: defaultFilters.cohortIds,
      department_ids: defaultFilters.departmentIds,
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

  const historyData = await getHomeAnalytical(historyFilters);

  // Home history data is never archived (MV filters out archived)
  const dataArray = historyData.data || [];
  const archivedCount = 0;
  const unarchivedCount = dataArray.length;

  // Use server-provided data directly (no transformation needed)
  // Extract options from API response and cast to expected format
  // Note: profile_options removed - home history is single-user
  const profileOptions: { value: string; label: string; count?: number }[] = [];
  const simulationOptions = (historyData.simulation_options || []).map(
    (opt) => {
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
      showExport={true}
      showArchive={false}
      singleProfile={true}
      initialFilters={defaultFilters}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { HomeAnalyticalIn as HomeHistoryIn, HomeAnalyticalOut as HomeHistoryOut, HomeOut };
