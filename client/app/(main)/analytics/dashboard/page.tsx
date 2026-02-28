/**
 * app/(main)/analytics/dashboard/page.tsx
 * Dashboard page for the analytics section.
 * Uses a single /dashboard/get endpoint that returns all sections at once.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Dashboard from "@/components/artifacts/dashboard/Dashboard";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { loadDashboardSearchParams } from "@/lib/search-params/dashboard";

/** ---- Strong types from OpenAPI ---- */
type DashboardIn = InputOf<"/api/v4/artifacts/dashboard/get", "post">;
type DashboardOut = OutputOf<"/api/v4/artifacts/dashboard/get", "post">;
type DashboardHistoryOut = NonNullable<DashboardOut["history"]>;
type BulkArchiveAttemptsIn = InputOf<
  "/api/v4/attempts/simulation/archive",
  "post"
>;
type BulkArchiveAttemptsOut = OutputOf<
  "/api/v4/attempts/simulation/archive",
  "post"
>;

/** ---- Fetch function ---- */
const getDashboard = async (input: DashboardIn): Promise<DashboardOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/artifacts/dashboard/get", input, {
    cache: "no-store",
    ...(bypassCache && { headers: { "X-Bypass-Cache": "1" } }),
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/dashboard/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/dashboard/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/dashboard/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
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
  const historyProfileIds = q.historyProfileIds ?? undefined;
  const historySimulationIds = q.historySimulationIds ?? undefined;
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
      start_date: filters.startDate,
      end_date: filters.endDate,
      cohort_ids: filters.cohortIds,
      department_ids: filters.departmentIds,
      roles: filters.roles,
      simulation_filters: filters.simulationFilters,
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

  const initialHistoryVisibility = await readViewCookie("history");

  return (
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
      defaultFilters={filters}
      bulkArchiveAttemptsAction={bulkArchiveAttempts}
      historyProfileSearch={historyProfileSearch}
      historySimulationSearch={historySimulationSearch}
      historyScenarioSearch={historyScenarioSearch}
    />
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
