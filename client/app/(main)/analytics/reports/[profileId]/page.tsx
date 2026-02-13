/**
 * app/(main)/analytics/reports/[profileId]/page.tsx
 * Reports page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SimulationHistory from "@/components/artifacts/attempt/history/SimulationHistory";
import Report from "@/components/artifacts/reports/Report";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { Suspense } from "react";
import { loadProfileReportSearchParams } from "@/lib/search-params/profile-report";

/** ---- Strong types from OpenAPI ---- */
type ReportsOverviewIn = InputOf<"/api/v4/artifacts/dashboard/get", "post">;
type ReportsOverviewOut = OutputOf<"/api/v4/artifacts/dashboard/get", "post">;
// Using /attempt/list for history section
type ReportHistoryIn = InputOf<"/api/v4/artifacts/attempt/list", "post">;
type ReportHistoryOut = OutputOf<"/api/v4/artifacts/attempt/list", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Reports overview responses exceed Next.js 2MB cache limit (~12.9MB).
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getReportsOverview = async (
  input: ReportsOverviewIn
): Promise<ReportsOverviewOut> => {
  const bypassCache = await isHardRefresh();

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
const getReportHistory = async (
  input: ReportHistoryIn
): Promise<ReportHistoryOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/attempt/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/reports/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/reports/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/reports/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ profileId: string }>;
}): Promise<Metadata> {
  const { profileId } = await params;
  const docs = await getDocs({ body: { entity_id: profileId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

interface ProfileReportsPageProps {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReportsPage({
  params,
  searchParams,
}: ProfileReportsPageProps) {
  const { profileId } = await params;

  // Parse search params via nuqs loader
  const q = loadProfileReportSearchParams(await searchParams);

  // Compute defaults and resolve filters
  const { defaults, profileContext } = await computeAnalyticsDefaults();
  const filters = resolveAnalyticsFilters(q, defaults, profileContext);

  // Build reports filters with target_profile_id from URL path
  const reportsFilters: ReportsOverviewIn["body"] = {
    start_date: filters.startDate,
    end_date: filters.endDate,
    cohort_ids: filters.cohortIds,
    department_ids: filters.departmentIds,
    roles: filters.roles,
    simulation_filters: filters.simulationFilters,
    actor_profile_id: profileContext.id || profileId,
    target_profile_id: profileId,
  };

  // History params with defaults
  const historyPage = q.historyPage ?? 0;
  const historyPageSize = q.historyPageSize ?? 10;
  const historySearch = q.historySearch ?? undefined;
  const historySimulationIds = q.historySimulationIds ?? undefined;
  const historyScenarioIds = q.historyScenarioIds ?? undefined;
  const historyInfiniteMode = q.historyInfiniteMode ?? undefined;
  const historySortBy = q.historySortBy ?? "date";
  const historySortOrder = q.historySortOrder ?? "desc";

  // Create historyKey for Suspense boundary to trigger re-fetch on URL param changes
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
    filters.startDate,
    filters.endDate,
    filters.cohortIds.join(","),
    filters.departmentIds.join(","),
    filters.roles.join(","),
    filters.simulationFilters.join(","),
  ].join("|");

  // Fetch reports overview data server-side (includes profile data)
  const reportsData = await getReportsOverview({
    body: reportsFilters,
  });

  // Extract profile data from reports response (Report component only needs name, emails, role)
  const profileData = {
    name: reportsData.profile_name || null,
    emails: reportsData.profile_emails || null,
    primary_email: reportsData.profile_primary_email || null,
    role: reportsData.profile_role || null,
  };

  return (
    <div className="space-y-6">
      <Report
        profileId={profileId}
        profileData={profileData}
        dashboardData={reportsData}
      />

      {/* History section - filtered by profileId */}
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
              showArchive={false}
              singleProfile={true}
              initialFilters={{
                startDate: filters.startDate,
                endDate: filters.endDate,
                cohortIds: filters.cohortIds,
                departmentIds: filters.departmentIds,
                roles: filters.roles,
              }}
              profileOptions={[]}
              simulationOptions={[]}
              scenarioOptions={[]}
              isLoading={true}
            />
          }
        >
          <ReportHistorySection
            profileId={profileId}
            defaultFilters={filters}
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
async function ReportHistorySection({
  profileId,
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
  profileId: string;
  defaultFilters: {
    startDate: string;
    endDate: string;
    cohortIds: string[];
    departmentIds: string[];
    roles: string[];
    simulationFilters: string[];
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
  // Build history filters using /attempt/list endpoint
  // practice: false for reports (home mode)
  const historyFilters: ReportHistoryIn = {
    body: {
      practice: false,
      target_profile_id: profileId,
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

  const historyData = await getReportHistory(historyFilters);

  // Calculate archived/unarchived counts from data
  const dataArray = historyData.data || [];
  const archivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => item.is_archived).length;
  const unarchivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => !item.is_archived).length;

  // Extract options from API response
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
  const scenarioOptions = (historyData.scenario_options || []).map(
    (opt: { value?: string | null; label?: string | null; count?: number | null }) => {
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
      showArchive={false}
      singleProfile={true}
      initialFilters={{
        startDate: defaultFilters.startDate,
        endDate: defaultFilters.endDate,
        cohortIds: defaultFilters.cohortIds,
        departmentIds: defaultFilters.departmentIds,
        roles: defaultFilters.roles,
      }}
      profileOptions={[]}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type GetProfileOut = {
  name: string | null;
  emails: string[] | null;
  primary_email: string | null;
  role: string | null;
};
export type { ReportHistoryIn, ReportHistoryOut, ReportsOverviewIn, ReportsOverviewOut };
