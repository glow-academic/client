/**
 * app/(main)/analytics/dashboard/page.tsx
 * Dashboard page for the analytics section.
 * Uses a single /dashboard/get endpoint that returns all sections at once.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import Dashboard from "@/components/artifacts/dashboard/Dashboard";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadDashboardSearchParams } from "@/lib/search-params/dashboard";


/** ---- Strong types from OpenAPI ---- */
type DashboardIn = InputOf<"/attempt/dashboard/get", "post">;
type DashboardOut = OutputOf<"/attempt/dashboard/get", "post">;
type DashboardHistoryOut = NonNullable<DashboardOut["history"]>;
type BulkArchiveAttemptsIn = InputOf<
  "/api/v5/attempts/simulation/archive",
  "post"
>;
type BulkArchiveAttemptsOut = OutputOf<
  "/api/v5/attempts/simulation/archive",
  "post"
>;

/** ---- Generation types ---- */
type ContextIn = InputOf<"/attempt/dashboard/context", "post">;
type ContextOut = OutputOf<"/attempt/dashboard/context", "post">;
type GenerateDashboardIn = InputOf<"/attempt/dashboard/generate", "post">;
type GenerateDashboardOut = OutputOf<"/attempt/dashboard/generate", "post">;
type GenerationsIn = InputOf<"/attempt/dashboard/generations", "post">;
type GenerationsOut = OutputOf<"/attempt/dashboard/generations", "post">;
type GroupDashboardIn = InputOf<"/attempt/dashboard/group", "post">;
type GroupDashboardOut = OutputOf<"/attempt/dashboard/group", "post">;
type ProblemDashboardIn = InputOf<"/attempt/dashboard/problem", "post">;
type ProblemDashboardOut = OutputOf<"/attempt/dashboard/problem", "post">;

/** ---- Fetch function ---- */
const getDashboard = async (input: DashboardIn): Promise<DashboardOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/attempt/dashboard/get", input, {
    cache: "no-store",
    ...(bypassCache && { headers: { "X-Bypass-Cache": "1" } }),
  });
};

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/attempt/dashboard/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/attempt/dashboard/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

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

  // Single API call returning all dashboard data + group in parallel
  const [data, initialHistoryVisibility, groupResult] = await Promise.all([
    getDashboard({
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
    }),
    readViewCookie("history"),
    api.post("/attempt/dashboard/group", { body: {} } as GroupDashboardIn),
  ]);

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

  return (
    <FullPageLayout
      profileData={context.profile}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "dashboard",
        createFeedback: createDashboardProblem,
      }}
      breadcrumbs={[
        { title: "Analytics", section: "analytics", url: "/analytics" },
        { title: "Dashboard" },
      ]}
      toolbar={
        <AnalyticsFilters
          refreshAction={refreshDashboard}
          analyticsFilters={facets}
        />
      }
      panelProps={{
        artifactType: "dashboard",
        groupId: (groupResult as GroupDashboardOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateDashboard,
        operations: ["draft", "get", "group"],
        getGroupHistory: getDashboardGroupHistory,
        searchGroups: searchDashboardGroups,
        prompts: context.prompts?.prompts,
      }}
    >
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
    </FullPageLayout>
  );
}

/** ---- Strongly-typed server actions ---- */
async function refreshDashboard(): Promise<void> {
  "use server";
  await api.post("/attempt/dashboard/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function bulkArchiveAttempts(
  input: BulkArchiveAttemptsIn
): Promise<BulkArchiveAttemptsOut> {
  "use server";
  return api.post("/attempts/simulation/archive", input);
}

async function generateDashboard(
  input: GenerateDashboardIn
): Promise<GenerateDashboardOut> {
  "use server";
  return api.post("/attempt/dashboard/generate", input);
}

async function getDashboardGroupHistory(groupId: string): Promise<GroupDashboardOut> {
  "use server";
  return api.post("/attempt/dashboard/group", { body: { group_id: groupId } } as GroupDashboardIn);
}

async function searchDashboardGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/attempt/dashboard/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createDashboardProblem(input: ProblemDashboardIn): Promise<ProblemDashboardOut> {
  "use server";
  return api.post("/attempt/dashboard/problem", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkArchiveAttemptsIn,
  BulkArchiveAttemptsOut,
  DashboardHistoryOut,
  DashboardIn,
  DashboardOut,
};
