/**
 * app/(main)/analytics/dashboard/page.tsx
 * Dashboard page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SimulationHistory from "@/components/common/history/SimulationHistory";
import Dashboard from "@/components/dashboard/Dashboard";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { Suspense } from "react";
import { loadDashboardSearchParams } from "./searchParams";

/** ---- Strong types from OpenAPI ---- */
type DashboardIn = InputOf<"/api/v4/artifacts/dashboard/get", "post">;
type DashboardOut = OutputOf<"/api/v4/artifacts/dashboard/get", "post">;
// Using /attempt/list for history section
type DashboardHistoryIn = InputOf<"/api/v4/attempt/list", "post">;
type DashboardHistoryOut = OutputOf<"/api/v4/attempt/list", "post">;
type BulkArchiveAttemptsIn = InputOf<
  "/api/v4/attempts/simulation/archive",
  "post"
>;
type BulkArchiveAttemptsOut = OutputOf<
  "/api/v4/attempts/simulation/archive",
  "post"
>;

/** ---- Direct fetch (no Next.js cache) ----
 * Dashboard overview responses exceed Next.js 2MB cache limit (~12.9MB).
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getDashboardOverview = async (
  input: DashboardIn
): Promise<DashboardOut> => {
  const bypassCache = await isHardRefresh();

  // InputOf types have body property with snake_case fields
  return api.post("/artifacts/dashboard/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Direct fetch for history data ---- */
const getDashboardHistory = async (
  input: DashboardHistoryIn
): Promise<DashboardHistoryOut> => {
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
    title: "Dashboard",
    description:
      "Learning analytics dashboard for teaching assistant performance metrics. Track simulation-based practice sessions, review pedagogical assessments, analyze teaching effectiveness, and monitor professional development progress.",
  };
}

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  // Parse search params via nuqs loader
  const q = loadDashboardSearchParams(await searchParams);

  // Compute defaults and resolve filters
  const { defaults, profileContext } = await computeAnalyticsDefaults();
  const filters = resolveAnalyticsFilters(q, defaults, profileContext);

  // History params with defaults
  const historyPage = q.historyPage ?? 0;
  const historyPageSize = q.historyPageSize ?? 10;
  const historySearch = q.historySearch ?? undefined;
  const historyProfileIds = q.historyProfileIds ?? undefined;
  const historySimulationIds = q.historySimulationIds ?? undefined;
  const historyScenarioIds = q.historyScenarioIds ?? undefined;
  const historyInfiniteMode = q.historyInfiniteMode ?? undefined;
  const historySortBy = q.historySortBy ?? "date";
  const historySortOrder = q.historySortOrder ?? "desc";

  // Fetch dashboard data server-side (without history - history will be fetched separately)
  const dashboardData = await getDashboardOverview({
    body: {
      start_date: filters.startDate,
      end_date: filters.endDate,
      cohort_ids: filters.cohortIds,
      department_ids: filters.departmentIds,
      roles: filters.roles,
      simulation_filters: filters.simulationFilters,
      accessible_cohort_ids: profileContext.cohort_ids || [],
      accessible_department_ids: profileContext.department_ids || [],
    },
  });

  // Remove history from response for server-driven pagination
  const dashboardDataWithoutHistory = {
    ...dashboardData,
    history: [],
  };

  // Create historyKey for Suspense boundary to trigger re-fetch on URL param changes
  // Include _refresh param if present to force re-render after mutations (archive/unarchive)
  // Include analytics filter params so history re-fetches when filters change
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
    q._refresh || "", // Include refresh param to force re-render after archive/unarchive
    filters.startDate, // Include analytics filters to trigger re-fetch when filters change
    filters.endDate,
    filters.cohortIds.join(","),
    filters.departmentIds.join(","),
    filters.roles.join(","),
    filters.simulationFilters.join(","),
  ].join("|");

  return (
    <div className="space-y-6" data-page="dashboard-index">
      <Dashboard dashboardData={dashboardDataWithoutHistory} />

      {/* History section moved out of Dashboard, fully server-driven */}
      <div className="">
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
              showArchive={true}
              singleProfile={false}
              initialFilters={filters}
              profileOptions={[]}
              simulationOptions={[]}
              scenarioOptions={[]}
              isLoading={true}
            />
          }
        >
          <DashboardHistorySection
            defaultFilters={filters}
            historyPage={historyPage}
            historyPageSize={historyPageSize}
            historySearch={historySearch}
            historySimulationIds={historySimulationIds}
            historyScenarioIds={historyScenarioIds}
            historyInfiniteMode={historyInfiniteMode}
            historySortBy={historySortBy}
            historySortOrder={historySortOrder}
            bulkArchiveAttemptsAction={bulkArchiveAttempts}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** ---- Strongly-typed server actions for Dashboard (single source of truth) ---- */
async function bulkArchiveAttempts(
  input: BulkArchiveAttemptsIn
): Promise<BulkArchiveAttemptsOut> {
  "use server";
  // Server invalidates Redis cache with "dashboard" and "history" tags
  return api.post("/attempts/simulation/archive", input);
}

/** ---- Inline history section component (only used here) ---- */
async function DashboardHistorySection({
  defaultFilters,
  historyPage,
  historyPageSize,
  historySearch,
  historySimulationIds,
  historyScenarioIds,
  historyInfiniteMode,
  historySortBy,
  historySortOrder,
  bulkArchiveAttemptsAction,
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
  bulkArchiveAttemptsAction?: (
    input: BulkArchiveAttemptsIn
  ) => Promise<BulkArchiveAttemptsOut>;
}) {
  // Build history filters using /attempt/list endpoint
  // practice: false for dashboard (home mode)
  const historyFilters: DashboardHistoryIn = {
    body: {
      practice: false,
      start_date: defaultFilters.startDate,
      end_date: defaultFilters.endDate,
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

  const historyData = await getDashboardHistory(historyFilters);

  // Calculate archived/unarchived counts from data
  const dataArray = historyData.data || [];
  const archivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => item.is_archived).length;
  const unarchivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => !item.is_archived).length;

  // Use server-provided data directly (no transformation needed)
  // Extract options from API response and cast to expected format
  const profileOptions = (historyData.profile_options || []).map(
    (opt: {
      value?: string | null;
      label?: string | null;
      count?: number | null;
    }) => {
      const count = typeof opt.count === "number" ? opt.count : undefined;
      return {
        value: String(opt.value || ""),
        label: String(opt.label || ""),
        ...(count !== undefined && { count }),
      };
    }
  );
  const simulationOptions = (historyData.simulation_options || []).map(
    (opt: {
      value?: string | null;
      label?: string | null;
      count?: number | null;
    }) => {
      const count = typeof opt.count === "number" ? opt.count : undefined;
      return {
        value: String(opt.value || ""),
        label: String(opt.label || ""),
        ...(count !== undefined && { count }),
      };
    }
  );
  const scenarioOptions = (historyData.scenario_options || []).map(
    (opt: {
      value?: string | null;
      label?: string | null;
      count?: number | null;
    }) => {
      const count = typeof opt.count === "number" ? opt.count : undefined;
      return {
        value: String(opt.value || ""),
        label: String(opt.label || ""),
        ...(count !== undefined && { count }),
      };
    }
  );

  return (
    <SimulationHistory
      data={dataArray}
      totalCount={historyData.total_count || 0}
      archivedCount={archivedCount}
      unarchivedCount={unarchivedCount}
      pageIndex={historyPage}
      pageSize={historyPageSize}
      showExport={false}
      showArchive={!!bulkArchiveAttemptsAction}
      singleProfile={false}
      initialFilters={defaultFilters}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
      {...(bulkArchiveAttemptsAction && { bulkArchiveAttemptsAction })}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkArchiveAttemptsIn,
  BulkArchiveAttemptsOut,
  DashboardHistoryIn,
  DashboardHistoryOut,
  DashboardIn,
  DashboardOut,
};
