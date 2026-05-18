/**
 * app/(main)/analytics/dashboard/page.tsx
 * Dashboard page for the analytics section.
 * Uses a single /dashboard/get endpoint that returns all sections at once.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import Dashboard from "@/components/artifacts/dashboard/Dashboard";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadDashboardSearchParams } from "@/lib/search-params/dashboard";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";


import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type DashboardIn = InputOf<"/attempt/dashboard", "post">;
type DashboardOut = OutputOf<"/attempt/dashboard", "post">;
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
type ContextIn = InputOf<"/attempt/context", "post">;
type ContextOut = OutputOf<"/attempt/context", "post">;
type GenerationsIn = InputOf<"/attempt/generations", "post">;
type GenerationsOut = OutputOf<"/attempt/generations", "post">;
type GroupDashboardIn = InputOf<"/attempt/group", "post">;
type GroupDashboardOut = OutputOf<"/attempt/group", "post">;
type ProblemDashboardIn = InputOf<"/attempt/problem", "post">;
type ProblemDashboardOut = OutputOf<"/attempt/problem", "post">;

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getAttemptContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/attempt/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Fetch function ---- */
const getDashboard = async (input: DashboardIn): Promise<DashboardOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/attempt/dashboard", input, {
    cache: "no-store",
    ...(bypassCache && { headers: { "X-Bypass-Cache": "1" } }),
  });
};

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getAttemptContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Dashboard" };
  }
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

  try {
    // Profile data for providers
    const context = await getAttemptContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/analytics/dashboard", context.profile.role_permissions);

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
    const historyProfileIds = q.historyProfileIds ?? undefined;
    const historySimulationIds = q.historySimulationIds ?? undefined;
    const historyScenarioIds = q.historyScenarioIds ?? undefined;
    const historyInfiniteMode = q.historyInfiniteMode ?? undefined;
    const historySortBy = q.historySortBy ?? "date";
    const historySortOrder = q.historySortOrder ?? "desc";
    const historyProfileSearch = q.historyProfileSearch ?? undefined;
    const historySimulationSearch = q.historySimulationSearch ?? undefined;
    const historyScenarioSearch = q.historyScenarioSearch ?? undefined;
    const roleIds = q.role_ids ?? q.roles ?? [];
    // simulationFilters default = ["general"] (per product intent). Treat empty
    // array and missing identically so the server never has to guess and we
    // don't fragment the cache between "missing" and "explicitly cleared".
    const simulationFilters = q.simulationFilters?.length
      ? q.simulationFilters
      : ["general"];
    const hasGeneralFilter = simulationFilters.includes("general");
    const hasPracticeFilter = simulationFilters.includes("practice");
    const historyPractice =
      hasGeneralFilter === hasPracticeFilter ? undefined : hasPracticeFilter;
    const historyShowArchived = simulationFilters.includes("archived");

    // Parallel fetch: dashboard data + history search + group
    type SearchIn = InputOf<"/attempt/search", "post">;
    type SearchOut = OutputOf<"/attempt/search", "post">;
    const [data, historyResult, initialHistoryVisibility, groupResult] = await Promise.all([
      getDashboard({
        body: {
          ...(q.startDate && { start_date: q.startDate }),
          ...(q.endDate && { end_date: q.endDate }),
          ...(q.cohortIds?.length && { cohort_ids: q.cohortIds }),
          ...(q.departmentIds?.length && { department_ids: q.departmentIds }),
          ...(roleIds.length && { role_ids: roleIds }),
          ...(simulationFilters.length && { simulation_filters: simulationFilters }),
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
          // History filters omitted — fetched via /attempt/search
          // below in parallel (canonical history surface).
        },
      }),
      api.post("/attempt/search", {
        body: {
          page: historyPage,
          page_size: historyPageSize,
          sort_by: historySortBy,
          sort_order: historySortOrder,
          practice: historyPractice ?? null,
          ...(historyShowArchived && { show_archived: true }),
          // `historySearch` is the generic top-bar input ("Search by name,
          // simulation, or scenarios..."). `historySimulationSearch` is the
          // column-level facet. They share one server field (simulation_search)
          // until/unless the server gains a multi-target search; column-level
          // wins when both are set, generic falls through otherwise.
          ...(((historySimulationSearch || historySearch) && {
            simulation_search: historySimulationSearch || historySearch,
          })),
          ...(historyProfileIds?.length && { profile_ids: historyProfileIds }),
          ...(historySimulationIds?.length && { simulation_ids: historySimulationIds }),
          ...(historyScenarioIds?.length && { scenario_ids: historyScenarioIds }),
          ...(historyInfiniteMode !== undefined && { infinite_mode: historyInfiniteMode }),
          ...(historyProfileSearch && { profile_search: historyProfileSearch }),
          ...(historyScenarioSearch && { scenario_search: historyScenarioSearch }),
          ...(q.startDate && { start_date: q.startDate }),
          ...(q.endDate && { end_date: q.endDate }),
          ...(q.cohortIds?.length && { cohort_ids: q.cohortIds }),
          ...(q.departmentIds?.length && { department_ids: q.departmentIds }),
          ...(roleIds.length && { role_ids: roleIds }),
        },
      } as SearchIn) as SearchOut,
      readViewCookie("history"),
      api.post(
        "/attempt/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupDashboardIn,
      ),
    ]);
    // Inject history into data so Dashboard component can read it
    (data as Record<string, unknown>).history = historyResult;

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
      roles: roleIds,
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
            exportAction={exportDashboard}
            bffDownloadPrefix="/api/attempt/download"
          />
        }
        panelProps={{
          artifactType: "dashboard",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupDashboardOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupDashboardOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          prompts: context.prompts?.prompts,
          getGroupAction: getAttemptGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchAttemptGenerations as PanelProps["searchGenerationsAction"],
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
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 401
    ) {
      // 401 → not logged in. Analytics pages have no single-resource concept,
      // so 403 (wrong department) doesn't apply here — fall through and throw.
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/analytics/dashboard"
        />
      );
    }
    throw error;
  }
}

/** ---- Strongly-typed server actions ---- */
async function refreshDashboard(): Promise<void> {
  "use server";
  await api.post("/attempt/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function exportDashboard(): Promise<{ file_id: string; file_name?: string }> {
  "use server";
  return api.post(
    "/attempt/export" as Parameters<typeof api.post>[0],
    { body: { view: "dashboard" } as unknown as InputOf<"/attempt/export", "post"> },
  ) as Promise<{ file_id: string; file_name?: string }>;
}

async function bulkArchiveAttempts(
  input: BulkArchiveAttemptsIn
): Promise<BulkArchiveAttemptsOut> {
  "use server";
  return api.post("/attempts/simulation/archive", input);
}

async function createDashboardProblem(input: ProblemDashboardIn): Promise<ProblemDashboardOut> {
  "use server";
  return api.post("/attempt/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getAttemptGroup(input: GroupDashboardIn): Promise<GroupDashboardOut> {
  "use server";
  return api.post("/attempt/group", input);
}

async function searchAttemptGenerations(
  input: GenerationsIn,
): Promise<GenerationsOut> {
  "use server";
  return api.post("/attempt/generations", input);
}


/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkArchiveAttemptsIn,
  BulkArchiveAttemptsOut,
  DashboardHistoryOut,
  DashboardIn,
  DashboardOut,
};
