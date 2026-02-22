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

  // Section picker params
  // Primary: all rubric pickers
  const heatmapRubricIds = q.heatmapRubricIds ?? undefined;
  const heatmapRubricSearch = q.heatmapRubricSearch ?? undefined;
  const trendRubricIds = q.trendRubricIds ?? undefined;
  const trendRubricSearch = q.trendRubricSearch ?? undefined;
  const skillRubricIds = q.skillRubricIds ?? undefined;
  const skillRubricSearch = q.skillRubricSearch ?? undefined;
  // Secondary: all simulation pickers
  const personaSimulationIds = q.personaSimulationIds ?? undefined;
  const personaSimulationsSearch = q.personaSimulationsSearch ?? undefined;
  const cohortSimulationIds = q.cohortSimulationIds ?? undefined;
  const cohortSimulationsSearch = q.cohortSimulationsSearch ?? undefined;
  const improvementSimulationIds = q.improvementSimulationIds ?? undefined;
  const improvementSimulationsSearch = q.improvementSimulationsSearch ?? undefined;
  const scenarioPerfParameterIds = q.scenarioPerfParameterIds ?? undefined;
  const scenarioPerfParamSearch = q.scenarioPerfParamSearch ?? undefined;
  const scenarioStatsParameterIds = q.scenarioStatsParameterIds ?? undefined;
  const scenarioStatsParamSearch = q.scenarioStatsParamSearch ?? undefined;
  const scenarioSimPerfScenarioIds = q.scenarioSimPerfScenarioIds ?? undefined;
  const scenarioSimPerfScenarioSearch = q.scenarioSimPerfScenarioSearch ?? undefined;
  const scenarioCompScenarioIds = q.scenarioCompScenarioIds ?? undefined;
  const scenarioCompScenarioSearch = q.scenarioCompScenarioSearch ?? undefined;

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
    // Primary pickers
    (heatmapRubricIds || []).join(","),
    heatmapRubricSearch || "",
    (trendRubricIds || []).join(","),
    trendRubricSearch || "",
    (skillRubricIds || []).join(","),
    skillRubricSearch || "",
    // Secondary pickers
    (personaSimulationIds || []).join(","),
    personaSimulationsSearch || "",
    (cohortSimulationIds || []).join(","),
    cohortSimulationsSearch || "",
    (improvementSimulationIds || []).join(","),
    improvementSimulationsSearch || "",
    // Footer pickers
    (scenarioPerfParameterIds || []).join(","),
    scenarioPerfParamSearch || "",
    (scenarioStatsParameterIds || []).join(","),
    scenarioStatsParamSearch || "",
    (scenarioSimPerfScenarioIds || []).join(","),
    scenarioSimPerfScenarioSearch || "",
    (scenarioCompScenarioIds || []).join(","),
    scenarioCompScenarioSearch || "",
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
      // Primary pickers
      ...(heatmapRubricIds?.length && { heatmap_rubric_ids: heatmapRubricIds }),
      ...(heatmapRubricSearch && { heatmap_rubric_search: heatmapRubricSearch }),
      ...(trendRubricIds?.length && { trend_rubric_ids: trendRubricIds }),
      ...(trendRubricSearch && { trend_rubric_search: trendRubricSearch }),
      ...(skillRubricIds?.length && { skill_rubric_ids: skillRubricIds }),
      ...(skillRubricSearch && { skill_rubric_search: skillRubricSearch }),
      // Secondary pickers
      ...(personaSimulationIds?.length && { persona_simulation_ids: personaSimulationIds }),
      ...(personaSimulationsSearch && { persona_simulations_search: personaSimulationsSearch }),
      ...(cohortSimulationIds?.length && { cohort_simulation_ids: cohortSimulationIds }),
      ...(cohortSimulationsSearch && { cohort_simulations_search: cohortSimulationsSearch }),
      ...(improvementSimulationIds?.length && { improvement_simulation_ids: improvementSimulationIds }),
      ...(improvementSimulationsSearch && { improvement_simulations_search: improvementSimulationsSearch }),
      // Footer pickers
      ...(scenarioPerfParameterIds?.length && { scenario_perf_parameter_ids: scenarioPerfParameterIds }),
      ...(scenarioPerfParamSearch && { scenario_perf_param_search: scenarioPerfParamSearch }),
      ...(scenarioStatsParameterIds?.length && { scenario_stats_parameter_ids: scenarioStatsParameterIds }),
      ...(scenarioStatsParamSearch && { scenario_stats_param_search: scenarioStatsParamSearch }),
      ...(scenarioSimPerfScenarioIds?.length && { scenario_sim_perf_scenario_ids: scenarioSimPerfScenarioIds }),
      ...(scenarioSimPerfScenarioSearch && { scenario_sim_perf_scenario_search: scenarioSimPerfScenarioSearch }),
      ...(scenarioCompScenarioIds?.length && { scenario_comp_scenario_ids: scenarioCompScenarioIds }),
      ...(scenarioCompScenarioSearch && { scenario_comp_scenario_search: scenarioCompScenarioSearch }),
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
            heatmapRubricIds={heatmapRubricIds}
            heatmapRubricSearch={heatmapRubricSearch}
            trendRubricIds={trendRubricIds}
            trendRubricSearch={trendRubricSearch}
            skillRubricIds={skillRubricIds}
            skillRubricSearch={skillRubricSearch}
          />
        </Suspense>
        <Suspense key={`secondary|${dataKey}`} fallback={<SecondarySkeleton />}>
          <DashboardSecondarySection
            dashboardPromise={dashboardPromise}
            personaSimulationIds={personaSimulationIds}
            personaSimulationsSearch={personaSimulationsSearch}
            cohortSimulationIds={cohortSimulationIds}
            cohortSimulationsSearch={cohortSimulationsSearch}
            improvementSimulationIds={improvementSimulationIds}
            improvementSimulationsSearch={improvementSimulationsSearch}
          />
        </Suspense>
      </div>

      {/* Footer - single boundary, internal 2-col grid */}
      <Suspense key={`footer|${dataKey}`} fallback={<FooterSkeleton />}>
        <DashboardFooterSection
          dashboardPromise={dashboardPromise}
          scenarioPerfParameterIds={scenarioPerfParameterIds}
          scenarioPerfParamSearch={scenarioPerfParamSearch}
          scenarioStatsParameterIds={scenarioStatsParameterIds}
          scenarioStatsParamSearch={scenarioStatsParamSearch}
          scenarioSimPerfScenarioIds={scenarioSimPerfScenarioIds}
          scenarioSimPerfScenarioSearch={scenarioSimPerfScenarioSearch}
          scenarioCompScenarioIds={scenarioCompScenarioIds}
          scenarioCompScenarioSearch={scenarioCompScenarioSearch}
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
  heatmapRubricIds,
  heatmapRubricSearch,
  trendRubricIds,
  trendRubricSearch,
  skillRubricIds,
  skillRubricSearch,
}: {
  dashboardPromise: Promise<DashboardOut>;
  heatmapRubricIds?: string[] | undefined;
  heatmapRubricSearch?: string | undefined;
  trendRubricIds?: string[] | undefined;
  trendRubricSearch?: string | undefined;
  skillRubricIds?: string[] | undefined;
  skillRubricSearch?: string | undefined;
}) {
  const data = await dashboardPromise;
  return (
    <DashboardPrimary
      data={data}
      initialHeatmapRubrics={heatmapRubricIds}
      heatmapRubricSearch={heatmapRubricSearch}
      initialTrendRubrics={trendRubricIds}
      trendRubricSearch={trendRubricSearch}
      initialSkillRubrics={skillRubricIds}
      skillRubricSearch={skillRubricSearch}
    />
  );
}

async function DashboardSecondarySection({
  dashboardPromise,
  personaSimulationIds,
  personaSimulationsSearch,
  cohortSimulationIds,
  cohortSimulationsSearch,
  improvementSimulationIds,
  improvementSimulationsSearch,
}: {
  dashboardPromise: Promise<DashboardOut>;
  personaSimulationIds?: string[] | undefined;
  personaSimulationsSearch?: string | undefined;
  cohortSimulationIds?: string[] | undefined;
  cohortSimulationsSearch?: string | undefined;
  improvementSimulationIds?: string[] | undefined;
  improvementSimulationsSearch?: string | undefined;
}) {
  const data = await dashboardPromise;
  return (
    <DashboardSecondary
      data={data}
      initialPersonaSimulations={personaSimulationIds}
      personaSimulationsSearch={personaSimulationsSearch}
      initialCohortSimulations={cohortSimulationIds}
      cohortSimulationsSearch={cohortSimulationsSearch}
      initialImprovementSimulations={improvementSimulationIds}
      improvementSimulationsSearch={improvementSimulationsSearch}
    />
  );
}

async function DashboardFooterSection({
  dashboardPromise,
  scenarioPerfParameterIds,
  scenarioPerfParamSearch,
  scenarioStatsParameterIds,
  scenarioStatsParamSearch,
  scenarioSimPerfScenarioIds,
  scenarioSimPerfScenarioSearch,
  scenarioCompScenarioIds,
  scenarioCompScenarioSearch,
}: {
  dashboardPromise: Promise<DashboardOut>;
  scenarioPerfParameterIds?: string[] | undefined;
  scenarioPerfParamSearch?: string | undefined;
  scenarioStatsParameterIds?: string[] | undefined;
  scenarioStatsParamSearch?: string | undefined;
  scenarioSimPerfScenarioIds?: string[] | undefined;
  scenarioSimPerfScenarioSearch?: string | undefined;
  scenarioCompScenarioIds?: string[] | undefined;
  scenarioCompScenarioSearch?: string | undefined;
}) {
  const data = await dashboardPromise;
  return (
    <DashboardFooter
      data={data}
      initialScenarioPerfParameters={scenarioPerfParameterIds}
      scenarioPerfParamSearch={scenarioPerfParamSearch}
      initialScenarioStatsParameters={scenarioStatsParameterIds}
      scenarioStatsParamSearch={scenarioStatsParamSearch}
      initialScenarioSimPerfScenarios={scenarioSimPerfScenarioIds}
      scenarioSimPerfScenarioSearch={scenarioSimPerfScenarioSearch}
      initialScenarioCompScenarios={scenarioCompScenarioIds}
      scenarioCompScenarioSearch={scenarioCompScenarioSearch}
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
