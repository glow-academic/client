/**
 * app/(main)/analytics/dashboard/page.tsx
 * Dashboard page for the analytics section.
 * Uses a single /dashboard/get endpoint that returns all sections at once.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Dashboard from "@/components/artifacts/dashboard/Dashboard";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { refreshPage } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { loadDashboardSearchParams } from "@/lib/search-params/dashboard";

/** ---- Strong types from OpenAPI ---- */
type DashboardIn = InputOf<"/dashboard/get", "post">;
type DashboardOut = OutputOf<"/dashboard/get", "post">;
type DashboardHistoryOut = NonNullable<DashboardOut["history"]>;
type BulkArchiveAttemptsIn = InputOf<
  "/api/v5/attempts/simulation/archive",
  "post"
>;
type BulkArchiveAttemptsOut = OutputOf<
  "/api/v5/attempts/simulation/archive",
  "post"
>;

/** ---- Fetch function ---- */
const getDashboard = async (input: DashboardIn): Promise<DashboardOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/dashboard/get", input, {
    cache: "no-store",
    ...(bypassCache && { headers: { "X-Bypass-Cache": "1" } }),
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/dashboard/docs", "post">;
type DocsOut = OutputOf<"/dashboard/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/dashboard/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.page_metadata?.list.title, description: docs.page_metadata?.list.description };
}

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  // Parse search params via nuqs loader
  const q = loadDashboardSearchParams(await searchParams);

  // Section picker params (canonical — shared across charts in each section)
  const rubricIds = q.rubricIds ?? undefined;
  const rubricSearch = q.rubricSearch ?? undefined;
  const rubricIndex = q.rubricIndex ?? 0;
  const simulationPickerIds = q.simulationPickerIds ?? undefined;
  const simulationPickerSearch = q.simulationPickerSearch ?? undefined;
  const simulationIndex = q.simulationIndex ?? 0;
  const parameterIds = q.parameterIds ?? undefined;
  const parameterSearch = q.parameterSearch ?? undefined;
  const parameterIndex = q.parameterIndex ?? 0;
  const scenarioIds = q.scenarioIds ?? undefined;
  const scenarioSearch = q.scenarioSearch ?? undefined;
  const scenarioIndex = q.scenarioIndex ?? 0;

  // History params with defaults
  const historyPage = q.historyPage ?? 0;
  const historyPageSize = q.historyPageSize ?? 10;
  const historySearch = q.historySearch ?? undefined;
  const _historyProfileIds = q.historyProfileIds ?? undefined;
  const _historySimulationIds = q.historySimulationIds ?? undefined;
  const historyScenarioIds = q.historyScenarioIds ?? undefined;
  const historyInfiniteMode = q.historyInfiniteMode ?? undefined;
  const historySortBy = q.historySortBy ?? "date";
  const historySortOrder = q.historySortOrder ?? "desc";
  const historyProfileSearch = q.historyProfileSearch ?? undefined;
  const historySimulationSearch = q.historySimulationSearch ?? undefined;
  const historyScenarioSearch = q.historyScenarioSearch ?? undefined;

  // Single API call returning all dashboard data
  const data = await getDashboard({
    body: {
      ...(q.startDate && { start_date: q.startDate }),
      ...(q.endDate && { end_date: q.endDate }),
      ...(q.cohortIds?.length && { cohort_ids: q.cohortIds }),
      ...(q.departmentIds?.length && { department_ids: q.departmentIds }),
      ...(q.roles?.length && { roles: q.roles }),
      ...(q.simulationFilters?.length && { simulation_filters: q.simulationFilters }),
      page_limit: 50,
      page_offset: 0,
      // Section pickers (canonical)
      ...(rubricIds?.length && { rubric_ids: rubricIds }),
      ...(rubricSearch && { rubric_search: rubricSearch }),
      ...(simulationPickerIds?.length && { simulation_picker_ids: simulationPickerIds }),
      ...(simulationPickerSearch && { simulation_picker_search: simulationPickerSearch }),
      ...(parameterIds?.length && { parameter_ids: parameterIds }),
      ...(parameterSearch && { parameter_search: parameterSearch }),
      ...(scenarioIds?.length && { scenario_ids: scenarioIds }),
      ...(scenarioSearch && { scenario_search: scenarioSearch }),
      // History
      history_page: historyPage,
      history_page_size: historyPageSize,
      history_sort_by: historySortBy,
      history_sort_order: historySortOrder,
      ...(historySearch && { history_simulation_search: historySearch }),
      ...(historyScenarioIds?.length && { history_scenario_ids: historyScenarioIds }),
      ...(historyInfiniteMode !== undefined && { history_infinite_mode: historyInfiniteMode }),
      ...(historyProfileSearch && { history_profile_search: historyProfileSearch }),
      ...(historySimulationSearch && { history_simulation_search: historySimulationSearch }),
      ...(historyScenarioSearch && { history_scenario_search: historyScenarioSearch }),
    },
  });

  // Compute initial filters from inline facets (replaces computeAnalyticsDefaults)
  const facets = data.analytics;
  const defaultStartDate = (() => {
    if (q.startDate) return q.startDate;
    if (facets?.date_range_earliest) {
      const d = new Date(facets.date_range_earliest);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
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
  const defaultFilters = {
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    cohortIds: q.cohortIds ?? [],
    departmentIds: q.departmentIds ?? [],
    roles: q.roles ?? [],
  };

  const initialHistoryVisibility = await readViewCookie("history");

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Analytics", section: "analytics", url: "/analytics" },
          { title: "Dashboard" },
        ]}
        toolbar={
          <AnalyticsFilters
            refreshPage={refreshPage}
            analyticsFilters={facets}
          />
        }
      />
      <div className="px-4">
        <Dashboard
          data={data}
          initialColumnVisibility={initialHistoryVisibility}
          rubricIds={rubricIds}
          rubricSearch={rubricSearch}
          rubricIndex={rubricIndex}
          simulationPickerIds={simulationPickerIds}
          simulationPickerSearch={simulationPickerSearch}
          simulationIndex={simulationIndex}
          parameterIds={parameterIds}
          parameterSearch={parameterSearch}
          parameterIndex={parameterIndex}
          scenarioIds={scenarioIds}
          scenarioSearch={scenarioSearch}
          scenarioIndex={scenarioIndex}
          historyPage={historyPage}
          historyPageSize={historyPageSize}
          defaultFilters={defaultFilters}
          bulkArchiveAttemptsAction={bulkArchiveAttempts}
          historyProfileSearch={historyProfileSearch}
          historySimulationSearch={historySimulationSearch}
          historyScenarioSearch={historyScenarioSearch}
        />
      </div>
    </>
  );
}

/** ---- Strongly-typed server actions for Dashboard (single source of truth) ---- */
async function bulkArchiveAttempts(
  input: BulkArchiveAttemptsIn
): Promise<BulkArchiveAttemptsOut> {
  "use server";
  return api.post("/attempts/simulation/archive", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkArchiveAttemptsIn,
  BulkArchiveAttemptsOut,
  DashboardHistoryOut,
  DashboardIn,
  DashboardOut,
};
