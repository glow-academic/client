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
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata } from "next";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
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
 * Sending X-Bypass-Cache header to also bypass Redis cache on hard refresh.
 */
const getDashboardOverview = async (
  input: DashboardIn
): Promise<DashboardOut> => {
  return api.post("/dashboard/overview", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

const getDashboardHistory = unstable_cache(
  async (input: DashboardHistoryIn): Promise<DashboardHistoryOut> => {
    // Note: X-Bypass-Cache header not needed here since unstable_cache handles Next.js cache
    // Redis cache will still work for performance, but can be invalidated via revalidateTag
    return api.post("/dashboard/history", input);
  },
  ["dashboard", "dashboard:history"],
  { tags: ["dashboard", "dashboard:history"] }
);

const getProfileContext = unstable_cache(
  async (input: {
    body: {
      actualProfileId: string;
      effectiveProfileId: string;
      pathname: string;
    };
  }) => {
    return api.post("/profile/context", input);
  },
  ["profile:context"],
  { tags: ["profile:context"] }
);

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

export const metadata: Metadata = {
  title: "Dashboard",
  description: `Dashboard in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const session = await getSession();

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
    searchParamsObj.toString() ? searchParamsObj : undefined
  );

  // Add historyProfileId from session to request body (not search params)
  // profileId is left null for main dashboard metrics (not used for filtering)
  // historyProfileId is used only for history showRetry calculation
  const dashboardRequestBody = {
    ...filters,
    profileId: null, // Not used for main dashboard metrics
    ...(session?.effectiveProfileId && {
      historyProfileId: session.effectiveProfileId,
    }),
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
  ].join("|");

  return (
    <div className="space-y-6" data-page="dashboard-index">
      <Dashboard dashboardData={dashboardDataWithoutHistory} />

      {/* History section moved out of Dashboard, fully server-driven */}
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
              showArchive={true}
              singleProfile={false}
              revalidateAttemptAction={revalidateAttempt}
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
            historyProfileIds={historyProfileIds}
            historySimulationIds={historySimulationIds}
            historyScenarioIds={historyScenarioIds}
            historyInfiniteMode={historyInfiniteMode}
            historySortBy={historySortBy}
            historySortOrder={historySortOrder}
            effectiveProfileId={session?.effectiveProfileId ?? null}
            revalidateAttemptAction={revalidateAttempt}
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
  const result = await api.post("/attempts/bulk-archive", input);
  // Revalidate the dashboard page to refetch data with updated archive status
  revalidateTag("dashboard");
  revalidateTag("dashboard:overview");
  revalidateTag("dashboard:history");
  revalidatePath("/analytics/dashboard");
  return result;
}

/** ---- Server action to revalidate attempt cache when simulation starts ---- */
async function revalidateAttempt(attemptId: string): Promise<void> {
  "use server";
  // Invalidate attempt-level cache
  revalidateTag("attempts");
  revalidateTag(`attempt:${attemptId}`);
  // Invalidate dashboard page cache so data refreshes when user returns
  revalidateTag("dashboard");
  revalidateTag("dashboard:overview");
  revalidateTag("dashboard:history");
  revalidatePath("/analytics/dashboard");
  // Note: Chat-specific tags can be added here if chat IDs are known
  // For now, invalidating attempt-level cache ensures all chats refresh
}

/** ---- Inline history section component (only used here) ---- */
async function DashboardHistorySection({
  defaultFilters,
  historyPage,
  historyPageSize,
  historySearch,
  historyProfileIds,
  historySimulationIds,
  historyScenarioIds,
  historyInfiniteMode,
  historySortBy,
  historySortOrder,
  effectiveProfileId,
  revalidateAttemptAction,
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
  historyProfileIds?: string[] | undefined;
  historySimulationIds?: string[] | undefined;
  historyScenarioIds?: string[] | undefined;
  historyInfiniteMode?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
  effectiveProfileId?: string | null;
  revalidateAttemptAction: (attemptId: string) => Promise<void>;
  bulkArchiveAttemptsAction?: (
    input: BulkArchiveAttemptsIn
  ) => Promise<BulkArchiveAttemptsOut>;
}) {
  // Build history filters matching logic from dashboard page
  const historyFilters: DashboardHistoryIn = {
    body: {
      profileId: effectiveProfileId || null,
      startDate: defaultFilters.startDate,
      endDate: defaultFilters.endDate,
      cohortIds: defaultFilters.cohortIds,
      departmentIds: defaultFilters.departmentIds,
      roles: defaultFilters.roles,
      simulationFilters: ["general", "practice", "archived"], // Dashboard shows all types
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
      revalidateAttemptAction={revalidateAttemptAction}
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
