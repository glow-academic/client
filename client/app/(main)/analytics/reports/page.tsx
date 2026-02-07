/**
 * app/(main)/analytics/reports/page.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Reports from "@/components/reports/Reports";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  type AnalyticsFilters,
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { Suspense } from "react";
import { loadReportsSearchParams } from "./searchParams";

/** ---- Strong types from OpenAPI ---- */
type ReportsIn = InputOf<"/api/v4/artifacts/reports/get", "post">;
type ReportsOut = OutputOf<"/api/v4/artifacts/reports/get", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Reports responses exceed Next.js 2MB cache limit (~3.2MB).
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getReports = async (input: ReportsIn): Promise<ReportsOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/reports/get", input, {
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
    title: "Reports",
    description:
      "Comprehensive assessment reports and evaluation data for teaching assistant training. Generate detailed performance analytics, pedagogical assessment summaries, and learning progress reports to track teaching effectiveness and professional development.",
  };
}

interface ReportsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReportsFullPage({
  searchParams,
}: ReportsPageProps) {
  // Parse search params via nuqs loader
  const q = loadReportsSearchParams(await searchParams);

  // Compute defaults and resolve filters
  const { defaults, profileContext } = await computeAnalyticsDefaults();
  const resolved = resolveAnalyticsFilters(q, defaults, profileContext);

  // Build AnalyticsFilters for Reports component (optional arrays)
  const filters: AnalyticsFilters = {
    startDate: resolved.startDate,
    endDate: resolved.endDate,
  };
  if (resolved.cohortIds.length > 0) filters.cohortIds = resolved.cohortIds;
  if (resolved.departmentIds.length > 0) filters.departmentIds = resolved.departmentIds;
  if (resolved.roles.length > 0) filters.roles = resolved.roles;
  if (resolved.simulationFilters.length > 0)
    filters.simulationFilters = resolved.simulationFilters;

  // Reports-specific params with defaults
  const reportsPage = q.reportsPage ?? 0;
  const reportsPageSize = q.reportsPageSize ?? 100;
  const reportsSearch = q.reportsSearch ?? undefined;
  const reportsProfileIds = q.reportsProfileIds ?? undefined;
  const reportsSimulationIds = q.reportsSimulationIds ?? undefined;
  const reportsScenarioIds = q.reportsScenarioIds ?? undefined;
  const reportsSortBy = q.reportsSortBy ?? "averageScore";
  const reportsSortOrder = q.reportsSortOrder ?? "desc";

  // Create reportsKey for Suspense boundary to trigger re-fetch on URL param changes
  // Include analytics filter params so reports re-fetch when filters change
  const reportsKey = [
    reportsPage,
    reportsPageSize,
    reportsSearch || "",
    (reportsProfileIds || []).join(","),
    (reportsSimulationIds || []).join(","),
    (reportsScenarioIds || []).join(","),
    reportsSortBy,
    reportsSortOrder,
    filters.startDate,
    filters.endDate,
    (filters.cohortIds || []).join(","),
    (filters.departmentIds || []).join(","),
    (filters.roles || []).join(","),
    (filters.simulationFilters || []).join(","),
  ].join("|");

  // Create empty reports data for loading state
  const emptyReportsData = {
    sections: {
      header_metrics: {
        total_attempts: { current_value: null, has_data: false, method: null, data_points: [], hover: null, status: "neutral" },
        average_score: { current_value: null, has_data: false, method: null, data_points: [], hover: null, status: "neutral" },
        completion_percentage: { current_value: null, has_data: false, method: null, data_points: [], hover: null, status: "neutral" },
        first_attempt_pass_rate: { current_value: null, has_data: false, method: null, data_points: [], hover: null, status: "neutral" },
      },
      overview: { status: { has_data: false, status: "neutral" }, rows: [] },
      leaderboard: { status: { has_data: false, status: "neutral" }, rows: [] },
      trends: { status: { has_data: false, status: "neutral" }, chart_data: [] },
      history: { status: { has_data: false, status: "neutral" }, rows: [] },
    },
    views: { attempt_facts: [], chat_facts: [], daily_metrics: [], profile_metrics: [] },
    resources: { simulations: {}, profiles: {}, scenarios: {}, cohorts: {}, personas: {}, rubrics: {} },
    total_count: 0,
    simulation_options: [],
    profile_options: [],
    scenario_options: [],
  } as ReportsOut;

  return (
    <div className="space-y-6" data-page="reports-index">
      <Suspense
        key={reportsKey}
        fallback={
          <Reports
            reportsData={emptyReportsData}
            filters={filters}
            isLoading={true}
            profileOptions={[]}
            simulationOptions={[]}
            scenarioOptions={[]}
          />
        }
      >
        <ReportsSection
          filters={filters}
          reportsPage={reportsPage}
          reportsPageSize={reportsPageSize}
          reportsSearch={reportsSearch}
          reportsProfileIds={reportsProfileIds}
          reportsSimulationIds={reportsSimulationIds}
          reportsScenarioIds={reportsScenarioIds}
          reportsSortBy={reportsSortBy}
          reportsSortOrder={reportsSortOrder}
        />
      </Suspense>
    </div>
  );
}

/** ---- Inline reports section component (only used here) ---- */
async function ReportsSection({
  filters,
  reportsPage,
  reportsPageSize,
  reportsSearch,
  reportsProfileIds,
  reportsSimulationIds,
  reportsScenarioIds,
  reportsSortBy,
  reportsSortOrder,
}: {
  filters: AnalyticsFilters;
  reportsPage: number;
  reportsPageSize: number;
  reportsSearch?: string | undefined;
  reportsProfileIds?: string[] | undefined;
  reportsSimulationIds?: string[] | undefined;
  reportsScenarioIds?: string[] | undefined;
  reportsSortBy: string;
  reportsSortOrder: string;
}) {
  // Build reports filters with pagination/search/sorting/filtering params (snake_case for API)
  const reportsFilters = {
    start_date: filters.startDate,
    end_date: filters.endDate,
    cohort_ids: filters.cohortIds || [],
    department_ids: filters.departmentIds || [],
    roles: filters.roles || [],
    simulation_filters: filters.simulationFilters || [],
    page_limit: reportsPageSize,
    page_offset: reportsPage * reportsPageSize,
    ...(reportsSearch && { search: reportsSearch }),
    sort_by: reportsSortBy,
    sort_order: reportsSortOrder,
    ...(reportsProfileIds &&
      reportsProfileIds.length > 0 && {
        profile_ids: reportsProfileIds,
      }),
    ...(reportsSimulationIds &&
      reportsSimulationIds.length > 0 && {
        simulation_ids: reportsSimulationIds,
      }),
    ...(reportsScenarioIds &&
      reportsScenarioIds.length > 0 && {
        scenario_ids: reportsScenarioIds,
      }),
  };

  // Fetch reports data server-side
  const reportsData = await getReports({
    body: reportsFilters,
  });

  // Extract filter options from API response (snake_case from server)
  const profileOptions =
    reportsData && "profile_options" in reportsData
      ? (reportsData.profile_options || []).map(
          (opt: {
            value?: string | null;
            label?: string | null;
            count?: number | null;
          }) => ({
            value: String(opt.value || ""),
            label: String(opt.label || ""),
            count: typeof opt.count === "number" ? opt.count : 0,
          })
        )
      : [];
  const simulationOptions =
    reportsData && "simulation_options" in reportsData
      ? (reportsData.simulation_options || []).map(
          (opt: {
            value?: string | null;
            label?: string | null;
            count?: number | null;
          }) => ({
            value: String(opt.value || ""),
            label: String(opt.label || ""),
            count: typeof opt.count === "number" ? opt.count : 0,
          })
        )
      : [];
  const scenarioOptions =
    reportsData && "scenario_options" in reportsData
      ? (reportsData.scenario_options || []).map(
          (opt: {
            value?: string | null;
            label?: string | null;
            count?: number | null;
          }) => ({
            value: String(opt.value || ""),
            label: String(opt.label || ""),
            count: typeof opt.count === "number" ? opt.count : 0,
          })
        )
      : [];

  return (
    <Reports
      reportsData={reportsData}
      filters={filters}
      isLoading={false}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { ReportsIn, ReportsOut };
