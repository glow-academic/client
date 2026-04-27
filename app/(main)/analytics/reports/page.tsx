/**
 * app/(main)/analytics/reports/page.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import Reports from "@/components/artifacts/reports/Reports";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadReportsSearchParams } from "@/lib/search-params/reports";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";


/** ---- Strong types from OpenAPI ---- */
type ReportsIn = InputOf<"/attempt/report/search", "post">;
type ReportsOut = OutputOf<"/attempt/report/search", "post">;

/** ---- Generation types ---- */
type ContextIn = InputOf<"/attempt/context", "post">;
type ContextOut = OutputOf<"/attempt/context", "post">;
type GenerateReportsIn = InputOf<"/attempt/generate", "post">;
type GenerateReportsOut = OutputOf<"/attempt/generate", "post">;
type GenerationsIn = InputOf<"/attempt/generations", "post">;
type GenerationsOut = OutputOf<"/attempt/generations", "post">;
type GroupReportsIn = InputOf<"/attempt/group", "post">;
type GroupReportsOut = OutputOf<"/attempt/group", "post">;
type ProblemReportsIn = InputOf<"/attempt/problem", "post">;
type ProblemReportsOut = OutputOf<"/attempt/problem", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Reports responses exceed Next.js 2MB cache limit (~3.2MB).
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getReports = async (input: ReportsIn): Promise<ReportsOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/attempt/report/search", input, {
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
  try {
    const context = await api.post("/attempt/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Reports" };
  }
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

  try {
    // Profile data for providers
    const context = await api.post("/attempt/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/analytics/reports", context.profile.role_permissions);

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
      api.post(
        "/attempt/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupReportsIn,
      ),
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
          groupName:
            (groupResult as GroupReportsOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "group"],
          prompts: context.prompts?.prompts,
          getGroupAction: getAttemptGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchAttemptGenerations as PanelProps["searchGenerationsAction"],
          runGenerateAction: runAttemptGenerate as PanelProps["runGenerateAction"],
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
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/analytics/reports"
        />
      );
    }
    throw error;
  }
}

/** ---- Strongly-typed server actions ---- */
async function refreshReports(): Promise<void> {
  "use server";
  await api.post("/attempt/report/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function createReportsProblem(input: ProblemReportsIn): Promise<ProblemReportsOut> {
  "use server";
  return api.post("/attempt/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getAttemptGroup(input: GroupReportsIn): Promise<GroupReportsOut> {
  "use server";
  return api.post("/attempt/group", input);
}

async function searchAttemptGenerations(
  input: GenerationsIn,
): Promise<GenerationsOut> {
  "use server";
  return api.post("/attempt/generations", input);
}

async function runAttemptGenerate(
  input: GenerateReportsIn,
): Promise<GenerateReportsOut> {
  "use server";
  return api.post("/attempt/generate", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type { ReportsIn, ReportsOut };
