/**
 * app/(main)/analytics/reports/page.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import Reports from "@/components/artifacts/reports/Reports";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadReportsSearchParams } from "@/lib/search-params/reports";


/** ---- Strong types from OpenAPI ---- */
type ReportsIn = InputOf<"/report/search", "post">;
type ReportsOut = OutputOf<"/report/search", "post">;

/** ---- Generation types ---- */
type ContextIn = InputOf<"/report/context", "post">;
type ContextOut = OutputOf<"/report/context", "post">;
type GenerateReportsIn = InputOf<"/report/generate", "post">;
type GenerateReportsOut = OutputOf<"/report/generate", "post">;
type GenerationsIn = InputOf<"/report/generations", "post">;
type GenerationsOut = OutputOf<"/report/generations", "post">;
type GroupReportsIn = InputOf<"/report/group", "post">;
type GroupReportsOut = OutputOf<"/report/group", "post">;
type ProblemReportsIn = InputOf<"/report/problem", "post">;
type ProblemReportsOut = OutputOf<"/report/problem", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Reports responses exceed Next.js 2MB cache limit (~3.2MB).
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getReports = async (input: ReportsIn): Promise<ReportsOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/report/search", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/report/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface ReportsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReportsFullPage({
  searchParams,
}: ReportsPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/report/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

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

  // Fetch reports data, view cookie, and group in parallel
  const [reportsData, initialColumnVisibility, groupResult] = await Promise.all([
    getReports({
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
    }),
    readViewCookie("reports"),
    api.post("/report/group", { body: {} } as GroupReportsIn),
  ]);

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

  return (
    <FullPageLayout
      profileData={context.profile}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "reports",
        createFeedback: createReportsProblem,
      }}
      breadcrumbs={[
        { title: "Analytics", section: "analytics", url: "/analytics" },
        { title: "Reports" },
      ]}
      toolbar={
        <AnalyticsFilters
          refreshAction={refreshReports}
          analyticsFilters={facets}
        />
      }
      panelProps={{
        artifactType: "reports",
        groupId: (groupResult as GroupReportsOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateReports,
        permissions: [
          { artifact: "reports", operation: "draft" },
          { artifact: "reports", operation: "get" },
          { artifact: "reports", operation: "docs" },
          { artifact: "reports", operation: "group" },
        ],
        getGroupHistory: getReportsGroupHistory,
        searchGroups: searchReportsGroups,
      }}
    >
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
    </FullPageLayout>
  );
}

/** ---- Strongly-typed server actions ---- */
async function refreshReports(): Promise<void> {
  "use server";
  await api.post("/report/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function generateReports(
  input: GenerateReportsIn
): Promise<GenerateReportsOut> {
  "use server";
  return api.post("/report/generate", input);
}

async function getReportsGroupHistory(groupId: string): Promise<GroupReportsOut> {
  "use server";
  return api.post("/report/group", { body: { group_id: groupId } } as GroupReportsIn);
}

async function searchReportsGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/report/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createReportsProblem(input: ProblemReportsIn): Promise<ProblemReportsOut> {
  "use server";
  return api.post("/report/problem", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type { ReportsIn, ReportsOut };
