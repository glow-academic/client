/**
 * app/(main)/analytics/reports/page.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Reports from "@/components/artifacts/reports/Reports";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { refreshPage } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { loadReportsSearchParams } from "@/lib/search-params/reports";

/** ---- Strong types from OpenAPI ---- */
type ReportsIn = InputOf<"/reports/get", "post">;
type ReportsOut = OutputOf<"/reports/get", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Reports responses exceed Next.js 2MB cache limit (~3.2MB).
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getReports = async (input: ReportsIn): Promise<ReportsOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/reports/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/reports/docs", "post">;
type DocsOut = OutputOf<"/reports/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/reports/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

interface ReportsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReportsFullPage({
  searchParams,
}: ReportsPageProps) {
  // Parse search params via nuqs loader
  const q = loadReportsSearchParams(await searchParams);

  // Compute initial date range from search params (with 30-day fallback)
  const defaultStartDate = (() => {
    if (q.startDate) return q.startDate;
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();
  const defaultEndDate = (() => {
    if (q.endDate) return q.endDate;
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  })();

  // Build filters from search params (replaces computeAnalyticsDefaults + resolveAnalyticsFilters)
  const filters = {
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    cohortIds: q.cohortIds ?? ([] as string[]),
    departmentIds: q.departmentIds ?? ([] as string[]),
    roles: q.roles ?? ([] as string[]),
    simulationFilters: q.simulationFilters ?? (["general"] as string[]),
  };

  // Reports-specific params with defaults
  const reportsPage = q.reportsPage ?? 0;
  const reportsPageSize = q.reportsPageSize ?? 100;
  const reportsSearch = q.reportsSearch ?? undefined;
  const reportsProfileIds = q.reportsProfileIds ?? undefined;
  const reportsSimulationIds = q.reportsSimulationIds ?? undefined;
  const reportsScenarioIds = q.reportsScenarioIds ?? undefined;
  const reportsSortBy = q.reportsSortBy ?? "averageScore";
  const reportsSortOrder = q.reportsSortOrder ?? "desc";

  // Single API call returning all reports data (with inline analytics facets)
  const reportsData = await getReports({
    body: {
      start_date: filters.startDate,
      end_date: filters.endDate,
      ...(filters.cohortIds.length > 0 && { cohort_ids: filters.cohortIds }),
      ...(filters.departmentIds.length > 0 && { department_ids: filters.departmentIds }),
      ...(filters.roles.length > 0 && { roles: filters.roles }),
      ...(filters.simulationFilters.length > 0 && { simulation_filters: filters.simulationFilters }),
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
    },
  });

  // Extract inline analytics facets from response (replaces computeAnalyticsDefaults)
  const facets = reportsData.analytics;

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

  // Read view cookie for column visibility
  const initialColumnVisibility = await readViewCookie("reports");

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Analytics", section: "analytics", url: "/analytics" },
          { title: "Reports" },
        ]}
        toolbar={
          <AnalyticsFilters
            refreshPage={refreshPage}
            analyticsFilters={facets}
          />
        }
      />
      <div className="space-y-6 px-4" data-page="reports-index">
        <Reports
          reportsData={reportsData}
          filters={filters}
          isLoading={false}
          profileOptions={profileOptions}
          simulationOptions={simulationOptions}
          scenarioOptions={scenarioOptions}
          initialColumnVisibility={initialColumnVisibility}
        />
      </div>
    </>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { ReportsIn, ReportsOut };
