/**
 * app/(main)/analytics/dashboard/page.tsx
 * Dashboard page for the analytics section.
 * Uses a single /dashboard/get endpoint that returns all sections at once.
 * Components share a single data promise for efficient streaming.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SimulationHistory from "@/components/artifacts/attempt/history/SimulationHistory";
import DashboardFooter from "@/components/artifacts/dashboard/DashboardFooter";
import DashboardHeader from "@/components/artifacts/dashboard/DashboardHeader";
import DashboardPrimary from "@/components/artifacts/dashboard/DashboardPrimary";
import DashboardSecondary from "@/components/artifacts/dashboard/DashboardSecondary";
import FooterSkeleton from "@/components/artifacts/dashboard/skeletons/FooterSkeleton";
import HeaderSkeleton from "@/components/artifacts/dashboard/skeletons/HeaderSkeleton";
import PrimarySkeleton from "@/components/artifacts/dashboard/skeletons/PrimarySkeleton";
import SecondarySkeleton from "@/components/artifacts/dashboard/skeletons/SecondarySkeleton";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { Suspense } from "react";
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

  // Suspense key — includes all params that affect the data
  const dataKey = [
    filters.startDate,
    filters.endDate,
    filters.cohortIds.join(","),
    filters.departmentIds.join(","),
    filters.roles.join(","),
    filters.simulationFilters.join(","),
    q._refresh || "",
    // Section pickers (canonical)
    (rubricIds || []).join(","),
    rubricSearch || "",
    rubricIndex,
    (simulationPickerIds || []).join(","),
    simulationPickerSearch || "",
    simulationIndex,
    (parameterIds || []).join(","),
    parameterSearch || "",
    parameterIndex,
    (scenarioIds || []).join(","),
    scenarioSearch || "",
    scenarioIndex,
    // History
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
    historyProfileSearch || "",
    historySimulationSearch || "",
    historyScenarioSearch || "",
  ].join("|");

  // Single API call returning all dashboard data
  const dashboardPromise = getDashboard({
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

  return (
    <div className="space-y-6" data-page="dashboard-index">
      {/* Header - full width */}
      <Suspense key={`header|${dataKey}`} fallback={<HeaderSkeleton />}>
        <DashboardHeaderSection dashboardPromise={dashboardPromise} />
      </Suspense>

      {/* Primary + Secondary in side-by-side grid */}
      <div
        className="grid gap-6 grid-cols-1 lg:grid-cols-[3fr_2fr] pb-2 items-stretch"
        style={{ gridAutoRows: "1fr" }}
      >
        <Suspense key={`primary|${dataKey}`} fallback={<PrimarySkeleton />}>
          <DashboardPrimarySection
            dashboardPromise={dashboardPromise}
            rubricIds={rubricIds}
            rubricSearch={rubricSearch}
            rubricIndex={rubricIndex}
          />
        </Suspense>
        <Suspense key={`secondary|${dataKey}`} fallback={<SecondarySkeleton />}>
          <DashboardSecondarySection
            dashboardPromise={dashboardPromise}
            simulationPickerIds={simulationPickerIds}
            simulationPickerSearch={simulationPickerSearch}
            simulationIndex={simulationIndex}
          />
        </Suspense>
      </div>

      {/* Footer - single boundary, internal 2-col grid */}
      <Suspense key={`footer|${dataKey}`} fallback={<FooterSkeleton />}>
        <DashboardFooterSection
          dashboardPromise={dashboardPromise}
          parameterIds={parameterIds}
          parameterSearch={parameterSearch}
          parameterIndex={parameterIndex}
          scenarioIds={scenarioIds}
          scenarioSearch={scenarioSearch}
          scenarioIndex={scenarioIndex}
        />
      </Suspense>

      {/* History - below all graphs */}
      <Suspense key={`history|${dataKey}`} fallback={null}>
        <DashboardHistorySection
          dashboardPromise={dashboardPromise}
          historyPage={historyPage}
          historyPageSize={historyPageSize}
          defaultFilters={filters}
          bulkArchiveAttemptsAction={bulkArchiveAttempts}
          historyProfileSearch={historyProfileSearch}
          historySimulationSearch={historySimulationSearch}
          historyScenarioSearch={historyScenarioSearch}
        />
      </Suspense>
    </div>
  );
}

/** ---- Strongly-typed server actions for Dashboard (single source of truth) ---- */
async function bulkArchiveAttempts(
  input: BulkArchiveAttemptsIn
): Promise<BulkArchiveAttemptsOut> {
  "use server";
  return api.post("/attempts/simulation/archive", input);
}

/** ---- Inline async server components per section ---- */

async function DashboardHeaderSection({
  dashboardPromise,
}: {
  dashboardPromise: Promise<DashboardOut>;
}) {
  const data = await dashboardPromise;
  return <DashboardHeader data={data} />;
}

async function DashboardHistorySection({
  dashboardPromise,
  historyPage,
  historyPageSize,
  defaultFilters,
  bulkArchiveAttemptsAction,
  historyProfileSearch,
  historySimulationSearch,
  historyScenarioSearch,
}: {
  dashboardPromise: Promise<DashboardOut>;
  historyPage: number;
  historyPageSize: number;
  defaultFilters: {
    startDate: string;
    endDate: string;
    cohortIds: string[];
    departmentIds: string[];
    roles: string[];
  };
  bulkArchiveAttemptsAction?: (
    input: BulkArchiveAttemptsIn
  ) => Promise<BulkArchiveAttemptsOut>;
  historyProfileSearch?: string | undefined;
  historySimulationSearch?: string | undefined;
  historyScenarioSearch?: string | undefined;
}) {
  const data = await dashboardPromise;

  // Extract history from embedded response
  const historyData: DashboardHistoryOut = data.history || {
    data: [],
    total_count: 0,
    page: 0,
    page_size: historyPageSize,
    total_pages: 0,
  };

  const dataArray = historyData.data || [];
  const archivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => item.is_archived).length;
  const unarchivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => !item.is_archived).length;

  const profileOptions = (historyData.profile_options || []).map(
    (opt: { value?: string | null; label?: string | null; count?: number | null }) => {
      const count = typeof opt.count === "number" ? opt.count : undefined;
      return {
        value: String(opt.value || ""),
        label: String(opt.label || ""),
        ...(count !== undefined && { count }),
      };
    }
  );
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
    <div className="">
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
        profileSearch={historyProfileSearch || ""}
        simulationSearch={historySimulationSearch || ""}
        scenarioSearch={historyScenarioSearch || ""}
        {...(bulkArchiveAttemptsAction && { bulkArchiveAttemptsAction })}
      />
    </div>
  );
}

async function DashboardPrimarySection({
  dashboardPromise,
  rubricIds,
  rubricSearch,
  rubricIndex,
}: {
  dashboardPromise: Promise<DashboardOut>;
  rubricIds?: string[] | undefined;
  rubricSearch?: string | undefined;
  rubricIndex: number;
}) {
  const data = await dashboardPromise;
  return (
    <DashboardPrimary
      data={data}
      initialRubricIds={rubricIds}
      rubricSearch={rubricSearch}
      initialIndex={rubricIndex}
    />
  );
}

async function DashboardSecondarySection({
  dashboardPromise,
  simulationPickerIds,
  simulationPickerSearch,
  simulationIndex,
}: {
  dashboardPromise: Promise<DashboardOut>;
  simulationPickerIds?: string[] | undefined;
  simulationPickerSearch?: string | undefined;
  simulationIndex: number;
}) {
  const data = await dashboardPromise;
  return (
    <DashboardSecondary
      data={data}
      initialSimulationIds={simulationPickerIds}
      simulationSearch={simulationPickerSearch}
      initialIndex={simulationIndex}
    />
  );
}

async function DashboardFooterSection({
  dashboardPromise,
  parameterIds,
  parameterSearch,
  parameterIndex,
  scenarioIds,
  scenarioSearch,
  scenarioIndex,
}: {
  dashboardPromise: Promise<DashboardOut>;
  parameterIds?: string[] | undefined;
  parameterSearch?: string | undefined;
  parameterIndex: number;
  scenarioIds?: string[] | undefined;
  scenarioSearch?: string | undefined;
  scenarioIndex: number;
}) {
  const data = await dashboardPromise;
  return (
    <DashboardFooter
      data={data}
      initialParameterIds={parameterIds}
      parameterSearch={parameterSearch}
      initialParameterIndex={parameterIndex}
      initialScenarioIds={scenarioIds}
      scenarioSearch={scenarioSearch}
      initialScenarioIndex={scenarioIndex}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkArchiveAttemptsIn,
  BulkArchiveAttemptsOut,
  DashboardHistoryOut,
  DashboardIn,
  DashboardOut,
};
