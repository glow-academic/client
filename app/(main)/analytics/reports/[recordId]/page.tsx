/**
 * app/(main)/analytics/reports/[recordId]/page.tsx
 * Record (profile) detail page — full SSR rendering with FullPageLayout.
 * Uses a single /dashboard/get endpoint that returns all sections at once.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import Record from "@/components/artifacts/record/Record";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { buildSnapshot } from "@/lib/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadProfileReportSearchParams } from "@/lib/search-params/profile-report";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";


import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type DashboardIn = InputOf<"/attempt/dashboard/get", "post">;
type DashboardOut = OutputOf<"/attempt/dashboard/get", "post">;
type ReportHistoryOut = NonNullable<DashboardOut["history"]>;
type ContextIn = InputOf<"/attempt/context", "post">;
type ContextOut = OutputOf<"/attempt/context", "post">;
type GenerationsIn = InputOf<"/attempt/generations", "post">;
type GenerationsOut = OutputOf<"/attempt/generations", "post">;
type GroupRecordIn = InputOf<"/attempt/group", "post">;
type GroupRecordOut = OutputOf<"/attempt/group", "post">;
type ProblemRecordIn = InputOf<"/attempt/problem", "post">;
type ProblemRecordOut = OutputOf<"/attempt/problem", "post">;

/** ---- Fetch function ---- */
const getDashboard = async (input: DashboardIn): Promise<DashboardOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/attempt/dashboard/get", input, {
    cache: "no-store",
    ...(bypassCache && { headers: { "X-Bypass-Cache": "1" } }),
  });
};

/** ---- Strongly-typed server actions ---- */
async function refreshReports(): Promise<void> {
  "use server";
  await api.post("/attempt/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function getAttemptGroup(input: GroupRecordIn): Promise<GroupRecordOut> {
  "use server";
  return api.post("/attempt/group", input);
}

async function searchAttemptGenerations(
  input: GenerationsIn,
): Promise<GenerationsOut> {
  "use server";
  return api.post("/attempt/generations", input);
}


async function createRecordProblem(input: ProblemRecordIn): Promise<ProblemRecordOut> {
  "use server";
  return api.post("/attempt/problem", input);
}

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getAttemptContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/attempt/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ recordId: string }>;
}): Promise<Metadata> {
  try {
    const { recordId } = await params;
    const context = await getAttemptContextById(recordId);
    return { title: context.page_metadata?.detail.title, description: context.page_metadata?.detail.description };
  } catch {
    return { title: "Profile Report" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface RecordPageProps {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RecordPage({
  params,
  searchParams,
}: RecordPageProps) {
  const { recordId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const pageContext = await api.post("/attempt/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, pageContext.profile);

    // Parse search params via nuqs loader
    const q = loadProfileReportSearchParams(await searchParams);

    // actor_profile_id comes from the context call above

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
    const _historySimulationIds = q.historySimulationIds ?? undefined;
    const historyScenarioIds = q.historyScenarioIds ?? undefined;
    const historyInfiniteMode = q.historyInfiniteMode ?? undefined;
    const historySortBy = q.historySortBy ?? "date";
    const historySortOrder = q.historySortOrder ?? "desc";
    const roleIds = q.role_ids ?? q.roles ?? [];

    // Single API call returning all dashboard data
    const [data, context, groupResult] = await Promise.all([
      getDashboard({
        body: {
          start_date: defaultStartDate,
          end_date: defaultEndDate,
          ...(q.cohortIds && q.cohortIds.length > 0 && { cohort_ids: q.cohortIds }),
          ...(q.departmentIds && q.departmentIds.length > 0 && { department_ids: q.departmentIds }),
          ...(roleIds.length > 0 && { role_ids: roleIds }),
          ...(q.simulationFilters && q.simulationFilters.length > 0 && { simulation_filters: q.simulationFilters }),
          target_profile_id: recordId,
          actor_profile_id: pageContext.profile.id || recordId,
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
          history_practice: false,
          history_show_archived: false,
          history_page: historyPage,
          history_page_size: historyPageSize,
          history_sort_by: historySortBy,
          history_sort_order: historySortOrder,
          ...(historySearch && { history_simulation_search: historySearch }),
          ...(historyScenarioIds?.length && { history_scenario_ids: historyScenarioIds }),
          ...(historyInfiniteMode !== undefined && { history_infinite_mode: historyInfiniteMode }),
        },
      }),
      getAttemptContextById(recordId) as Promise<ContextOut>,
      api.post(
        "/attempt/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupRecordIn,
      ),
    ]);

    const _entityName = context.page_metadata?.detail.title;

    // Compute initial filters from inline facets (replaces computeAnalyticsDefaults)
    const facets = data.analytics;
    const initialFilters = {
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      cohortIds: q.cohortIds ?? [],
      departmentIds: q.departmentIds ?? [],
      roles: roleIds,
      simulationFilters: q.simulationFilters ?? ["general"],
    };

    const recordProfileData = {
      name: data.profile_name || null,
      emails: data.profile_emails || null,
      primary_email: data.profile_primary_email || null,
      role: data.profile_role || null,
    };

    return (
      <FullPageLayout
        profileData={pageContext.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "reports",
          createFeedback: createRecordProblem,
        }}
        breadcrumbs={[
          { title: "Analytics", section: "analytics", url: "/analytics" },
          { title: "Reports", section: "reports", url: "/analytics/reports" },
          { title: "Profile" },
        ]}
        toolbar={
          <AnalyticsFilters
            refreshAction={refreshReports}
            analyticsFilters={facets}
          />
        }
        panelProps={{
          artifactType: "record",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupRecordOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupRecordOut & { name?: string | null })?.name ?? null,
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
          <Record
            data={data}
            profileData={recordProfileData}
            profileId={recordId}
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
            defaultFilters={initialFilters}
            initialColumnVisibility={await readViewCookie("history")}
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
          pathname={`/analytics/reports/${recordId}`}
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type GetProfileOut = {
  name: string | null;
  emails: string[] | null;
  primary_email: string | null;
  role: string | null;
};
export type { ReportHistoryOut, DashboardIn as ReportsOverviewIn, DashboardOut as ReportsOverviewOut };
