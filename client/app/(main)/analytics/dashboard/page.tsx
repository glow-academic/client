/**
 * app/(main)/analytics/dashboard/page.tsx
 * Dashboard page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import SimulationHistory from "@/components/common/history/SimulationHistory";
import Dashboard from "@/components/dashboard/Dashboard";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata } from "next";
import { Suspense } from "react";

/** ---- Strong types from OpenAPI ---- */
type DashboardIn = InputOf<"/api/v3/dashboard/overview", "post">;
type DashboardOut = OutputOf<"/api/v3/dashboard/overview", "post">;
type DashboardHistoryIn = InputOf<"/api/v3/dashboard/history", "post">;
type DashboardHistoryOut = OutputOf<"/api/v3/dashboard/history", "post">;
type BulkArchiveAttemptsIn = InputOf<"/api/v3/attempts/bulk-archive", "post">;
type BulkArchiveAttemptsOut = OutputOf<"/api/v3/attempts/bulk-archive", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Dashboard overview responses exceed Next.js 2MB cache limit (~12.9MB).
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getDashboardOverview = async (
  input: DashboardIn,
): Promise<DashboardOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/dashboard/overview", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Direct fetch (no Next.js cache) ----
 * Dashboard history responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getDashboardHistory = async (
  input: DashboardHistoryIn,
): Promise<DashboardHistoryOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/dashboard/history", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for profileContext (permissions, role, navigation).
 */
const getProfileContext = async (input: {
  body: {
    actualProfileId: string;
    effectiveProfileId: string;
    pathname: string;
  };
}) => {
  return api.post("/profile/context", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Inline filters function for dashboard page ---- */
async function getDashboardFilters(searchParams?: URLSearchParams) {
  const session = await getSession();

  // Fetch profile context to get earliestAttemptDate
  const profileContext = await getProfileContext({
    body: {
      actualProfileId: session?.user?.profileId || "",
      effectiveProfileId: session?.effectiveProfileId || "",
      pathname: "/",
    },
  });

  // Compute startDate using same logic as analytics context
  let startDate: Date;
  if (profileContext.earliestAttemptDate) {
    startDate = new Date(profileContext.earliestAttemptDate);
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
      : profileContext.cohortIds || [];
  const departmentIds =
    filters.departmentIds && filters.departmentIds.length > 0
      ? filters.departmentIds
      : profileContext.departmentIds || [];
  const roles =
    filters.roles && filters.roles.length > 0
      ? filters.roles
      : profileContext.scopedRoles || [];

  return {
    ...filters,
    cohortIds,
    departmentIds,
    roles,
  };
}

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
  // Parse search params
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Get filters from search params or defaults
  const filters = await getDashboardFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined,
  );

  // Dashboard bundle no longer uses profileId - removed from request
  const dashboardRequestBody = {
    ...filters,
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

  // Fetch dashboard data server-side (without history - history will be fetched separately)
  const dashboardData = await getDashboardOverview({
    body: dashboardRequestBody,
  });

  // Remove history from response for server-driven pagination
  const dashboardDataWithoutHistory = {
    ...dashboardData,
    history: [],
  };

  // Create historyKey for Suspense boundary to trigger re-fetch on URL param changes
  // Include _refresh param if present to force re-render after mutations (archive/unarchive)
  // Include analytics filter params so history re-fetches when filters change
  const refreshParam = searchParamsObj.get("_refresh") || "";
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
    refreshParam, // Include refresh param to force re-render after archive/unarchive
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
            simulationFilters={filters.simulationFilters}
            historyPage={historyPage}
            historyPageSize={historyPageSize}
            historySearch={historySearch}
            historyProfileIds={historyProfileIds}
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
  input: BulkArchiveAttemptsIn,
): Promise<BulkArchiveAttemptsOut> {
  "use server";
  // Server invalidates Redis cache with "dashboard" and "history" tags
  return api.post("/attempts/bulk-archive", input);
}

/** ---- Inline history section component (only used here) ---- */
async function DashboardHistorySection({
  defaultFilters,
  simulationFilters,
  historyPage,
  historyPageSize,
  historySearch,
  historyProfileIds,
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
  simulationFilters: string[];
  historyPage: number;
  historyPageSize: number;
  historySearch?: string | undefined;
  historyProfileIds?: string[] | undefined;
  historySimulationIds?: string[] | undefined;
  historyScenarioIds?: string[] | undefined;
  historyInfiniteMode?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
  bulkArchiveAttemptsAction?: (
    input: BulkArchiveAttemptsIn,
  ) => Promise<BulkArchiveAttemptsOut>;
}) {
  // Build history filters matching logic from dashboard page
  // Use the provided simulationFilters as-is - don't override it
  // This allows filtering to specific types (e.g., ["general"] excludes archived, ["archived"] shows only archived)
  const historySimulationFilters = simulationFilters;

  const historyFilters: DashboardHistoryIn = {
    body: {
      startDate: defaultFilters.startDate,
      endDate: defaultFilters.endDate,
      cohortIds: defaultFilters.cohortIds,
      departmentIds: defaultFilters.departmentIds,
      roles: defaultFilters.roles,
      simulationFilters: historySimulationFilters,
      page: historyPage,
      pageSize: historyPageSize,
      ...(historySearch && { search: historySearch }),
      ...(historyProfileIds &&
        historyProfileIds.length > 0 && {
          profileIds: historyProfileIds,
        }),
      ...(historySimulationIds &&
        historySimulationIds.length > 0 && {
          simulationIds: historySimulationIds,
        }),
      ...(historyScenarioIds &&
        historyScenarioIds.length > 0 && {
          scenarioIds: historyScenarioIds,
        }),
      ...(historyInfiniteMode !== undefined && {
        infiniteMode: historyInfiniteMode,
      }),
      sortBy: historySortBy,
      sortOrder: historySortOrder,
    },
  };

  const historyData = await getDashboardHistory(historyFilters);

  // Use server-provided data directly (no transformation needed)
  // Extract options from API response and cast to expected format
  const profileOptions = (historyData.profileOptions || []).map((opt) => {
    const count = typeof opt["count"] === "number" ? opt["count"] : undefined;
    return {
      value: String(opt["value"] || ""),
      label: String(opt["label"] || ""),
      ...(count !== undefined && { count }),
    };
  });
  const simulationOptions = (historyData.simulationOptions || []).map((opt) => {
    const count = typeof opt["count"] === "number" ? opt["count"] : undefined;
    return {
      value: String(opt["value"] || ""),
      label: String(opt["label"] || ""),
      ...(count !== undefined && { count }),
    };
  });
  const scenarioOptions = (historyData.scenarioOptions || []).map((opt) => {
    const count = typeof opt["count"] === "number" ? opt["count"] : undefined;
    return {
      value: String(opt["value"] || ""),
      label: String(opt["label"] || ""),
      ...(count !== undefined && { count }),
    };
  });

  return (
    <SimulationHistory
      data={historyData.data}
      totalCount={historyData.totalCount}
      archivedCount={historyData.archivedCount}
      unarchivedCount={historyData.unarchivedCount}
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
