/**
 * app/(main)/benchmark/page.tsx
 * Benchmark page for running evaluations — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import Benchmark from "@/components/artifacts/benchmark/Benchmark";
import EvalHistory from "@/components/artifacts/benchmark/EvalHistory";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadBenchmarkSearchParams } from "@/lib/search-params/benchmark";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type BenchmarkOverviewIn = InputOf<"/test/benchmark/get", "post">;
type BenchmarkOverviewOut = OutputOf<"/test/benchmark/get", "post">;
// For backward compatibility, extract evals list structure from overview
type EvalsListOut = {
  evals: BenchmarkOverviewOut["evals"];
  rubric_mapping: Record<string, Record<string, unknown>>;
  department_mapping: Record<string, { name: string; description: string }>;
  agent_mapping: Record<string, Record<string, unknown>>;
  standard_groups_mapping: Record<
    string,
    { name: string; description: string; points: number; passPoints: number }
  >;
  standards_mapping: Record<
    string,
    { name: string; description: string; points: number }
  >;
  rubric_standard_groups_mapping: Record<string, Record<string, string[]>>;
  rubric_options: BenchmarkOverviewOut["rubric_options"];
  department_options: BenchmarkOverviewOut["department_options"];
  agent_options: BenchmarkOverviewOut["agent_options"];
  date_range_earliest: string | null;
  date_range_latest: string | null;
};

/** ---- Generation types from OpenAPI ---- */
type ContextIn = InputOf<"/test/context", "post">;
type ContextOut = OutputOf<"/test/context", "post">;
type TestGenerationsIn = InputOf<"/test/generations", "post">;
type TestGenerationsOut = OutputOf<"/test/generations", "post">;
type TestGroupIn = InputOf<"/test/group", "post">;
type TestGroupOut = OutputOf<"/test/group", "post">;
type ProblemBenchmarkIn = InputOf<"/test/problem", "post">;
type ProblemBenchmarkOut = OutputOf<"/test/problem", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getBenchmarkOverview = async (
  input: BenchmarkOverviewIn
): Promise<BenchmarkOverviewOut> => {
  "use server";
  const bypassCache = await isHardRefresh();

  return api.post("/test/benchmark/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Strongly-typed server actions ---- */
async function refreshBenchmark(): Promise<void> {
  "use server";
  await api.post("/test/benchmark/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function exportBenchmark(): Promise<{ file_id: string; file_name?: string }> {
  "use server";
  return api.post(
    "/test/export" as Parameters<typeof api.post>[0],
    { body: { view: "benchmark" } as unknown as InputOf<"/test/export", "post"> },
  ) as Promise<{ file_id: string; file_name?: string }>;
}

/** Bulk archive/unarchive benchmark tests by IDs. */
type BulkArchiveTestsIn = InputOf<"/test/archive", "post">;
type BulkArchiveTestsOut = OutputOf<"/test/archive", "post">;
async function bulkArchiveTestsAction(
  input: BulkArchiveTestsIn,
): Promise<BulkArchiveTestsOut> {
  "use server";
  return api.post("/test/archive", input);
}

async function createBenchmarkProblem(input: ProblemBenchmarkIn): Promise<ProblemBenchmarkOut> {
  "use server";
  return api.post("/test/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getTestGroup(input: TestGroupIn): Promise<TestGroupOut> {
  "use server";
  return api.post("/test/group", input);
}

async function searchTestGenerations(
  input: TestGenerationsIn,
): Promise<TestGenerationsOut> {
  "use server";
  return api.post("/test/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getTestContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/test/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getTestContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Benchmark" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";
const EVAL_HISTORY_VIEW_COOKIE = "glow_view_eval-history-columns";

function readEvalHistoryViewCookie(
  raw: string | undefined,
): Record<string, boolean> | undefined {
  if (!raw) return undefined;
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, boolean>;
    }
  } catch {
    /* ignore malformed cookie */
  }
  return undefined;
}

interface BenchmarkPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BenchmarkPage({
  searchParams,
}: BenchmarkPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;
  const evalHistoryViewCookie = cookieStore.get(EVAL_HISTORY_VIEW_COOKIE);
  const initialEvalHistoryColumnVisibility = readEvalHistoryViewCookie(
    evalHistoryViewCookie?.value,
  );

  try {
    // Profile data for providers
    const context = await getTestContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/benchmark", context.profile.role_permissions);

    // Parse search params via nuqs loader
    const q = loadBenchmarkSearchParams(await searchParams);

    // History params with defaults
    const historyPage = q.historyPage ?? 0;
    const historyPageSize = q.historyPageSize ?? 10;
    const historySearch = q.historySearch ?? undefined;
    const historyEvalIds = q.historyEvalIds ?? undefined;
    const historyStatus = q.historyStatus ?? undefined;
    const historyArchived = q.historyArchived ?? undefined;
    const historySortBy = q.historySortBy ?? "created_at";
    const historySortOrder = q.historySortOrder ?? "desc";

    // Build benchmark overview filters with embedded history
    const overviewFilters: BenchmarkOverviewIn = {
      body: {
        start_date: q.startDate ?? undefined,
        end_date: q.endDate ?? undefined,
        department_ids: q.departmentIds ?? [],
        history_page: historyPage,
        history_page_size: historyPageSize,
        ...(historySearch && { history_search: historySearch }),
        ...(historyEvalIds &&
          historyEvalIds.length > 0 && {
            history_eval_ids: historyEvalIds,
          }),
        ...(historyStatus && { history_status: historyStatus }),
        ...(historyArchived !== undefined && { history_archived: historyArchived }),
        history_sort_by: historySortBy,
        history_sort_order: historySortOrder,
      },
    };

    // Fetch benchmark overview and group in parallel
    const [overviewData, groupResult] = await Promise.all([
      getBenchmarkOverview(overviewFilters),
      api.post(
        "/test/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as TestGroupIn,
      ),
    ]);

    // Extract inline analytics facets
    const facets = overviewData.analytics;

    // Convert arrays to dicts for backward compatibility with Benchmark component
    const rubricMapping: Record<string, Record<string, unknown>> = {};
    for (const rubric of overviewData.rubrics || []) {
      if (rubric.rubric_id) {
        rubricMapping[rubric.rubric_id] = {
          name: rubric.name || "",
          description: rubric.description || "",
          points: rubric.points || 0,
          pass_points: rubric.pass_points || 0,
        };
      }
    }

    const departmentMapping: Record<
      string,
      { name: string; description: string }
    > = {};
    for (const dept of overviewData.departments || []) {
      if (dept.department_id) {
        departmentMapping[dept.department_id] = {
          name: dept.name || "",
          description: dept.description || "",
        };
      }
    }

    const agentMapping: Record<string, Record<string, unknown>> = {};
    for (const agent of overviewData.agents || []) {
      if (agent.agent_id) {
        agentMapping[agent.agent_id] = {
          name: agent.name || "",
          description: agent.description || "",
        };
      }
    }

    const standardGroupsMapping: Record<
      string,
      { name: string; description: string; points: number; passPoints: number }
    > = {};
    for (const sg of overviewData.standard_groups || []) {
      if (sg.standard_group_id) {
        standardGroupsMapping[sg.standard_group_id] = {
          name: sg.name || "",
          description: sg.description || "",
          points: sg.points || 0,
          passPoints: sg.pass_points || 0,
        };
      }
    }

    const standardsMapping: Record<
      string,
      { name: string; description: string; points: number }
    > = {};
    for (const std of overviewData.standards || []) {
      if (std.standard_id) {
        standardsMapping[std.standard_id] = {
          name: std.name || "",
          description: std.description || "",
          points: std.points || 0,
        };
      }
    }

    // Build rubric_standard_groups_mapping from array
    const rubricStandardGroupsMapping: Record<
      string,
      Record<string, string[]>
    > = {};
    for (const rsg of overviewData.rubric_standard_groups || []) {
      if (rsg.rubric_id && rsg.standard_group_id) {
        if (!rubricStandardGroupsMapping[rsg.rubric_id]) {
          rubricStandardGroupsMapping[rsg.rubric_id] = {};
        }
        const standardIds = rsg.standard_ids || [];
        const rubricMap = rubricStandardGroupsMapping[rsg.rubric_id];
        if (rubricMap) {
          rubricMap[rsg.standard_group_id] = standardIds.map((id) =>
            id.toString()
          );
        }
      }
    }

    // Extract evals list structure from overview for Benchmark component
    const evalsData: EvalsListOut = {
      evals: overviewData.evals,
      rubric_mapping: rubricMapping,
      department_mapping: departmentMapping,
      agent_mapping: agentMapping,
      standard_groups_mapping: standardGroupsMapping,
      standards_mapping: standardsMapping,
      rubric_standard_groups_mapping: rubricStandardGroupsMapping,
      rubric_options: overviewData.rubric_options || [],
      department_options: overviewData.department_options || [],
      agent_options: overviewData.agent_options || [],
      date_range_earliest: overviewData.date_range_earliest ?? null,
      date_range_latest: overviewData.date_range_latest ?? null,
    };

    // Build rubric mappings from evals list response
    const rubricMappings: Record<
      string,
      {
        standard_groups: Record<string, string[]>;
        standardGroupsMapping: Record<
          string,
          {
            name: string;
            description: string;
            points: number;
            passPoints: number;
          }
        >;
        standardsMapping: Record<
          string,
          { name: string; description: string; points: number }
        >;
      }
    > = {};

    const uniqueRubricIds = Array.from(
      new Set(
        (evalsData.evals || [])
          .map((evalItem) => evalItem.rubric_id)
          .filter((id): id is string => id !== null)
      )
    );

    for (const rubricId of uniqueRubricIds) {
      const rubricStandardGroupsMap =
        evalsData.rubric_standard_groups_mapping?.[rubricId] || {};

      const standard_groups: Record<string, string[]> = {};
      for (const [groupId, standardIds] of Object.entries(
        rubricStandardGroupsMap
      )) {
        if (Array.isArray(standardIds)) {
          standard_groups[groupId] = standardIds;
        }
      }

      const sgMapping: Record<
        string,
        {
          name: string;
          description: string;
          points: number;
          passPoints: number;
        }
      > = {};
      for (const groupId of Object.keys(standard_groups)) {
        const groupData = evalsData.standard_groups_mapping?.[groupId];
        if (groupData) {
          sgMapping[groupId] = {
            name: groupData.name || "",
            description: groupData.description || "",
            points: groupData.points || 0,
            passPoints: groupData.passPoints || 0,
          };
        }
      }

      if (rubricId) {
        rubricMappings[rubricId] = {
          standard_groups,
          standardGroupsMapping: sgMapping,
          standardsMapping: evalsData.standards_mapping || {},
        };
      }
    }

    // Extract history from embedded response
    const historyData = overviewData.history;
    const dataArray = historyData?.data || [];

    // Faceted filter search terms from URL (server-driven)
    const sp = await searchParams;
    const readStr = (k: string): string => {
      const v = sp[k];
      if (typeof v === "string") return v;
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string")
        return v[0];
      return "";
    };
    const evalSearchTerm = readStr("historyEvalSearch");
    const modelSearchTerm = readStr("historyModelSearch");
    const profileSearchTerm = readStr("historyProfileSearch");
    const rubricSearchTerm = readStr("historyRubricSearch");

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "benchmark",
          createFeedback: createBenchmarkProblem,
        }}
        breadcrumbs={[
          { title: "Benchmark", section: "benchmark", url: "/benchmark" },
        ]}
        toolbar={
          <AnalyticsFilters
            refreshAction={refreshBenchmark}
            analyticsFilters={facets}
            exportAction={exportBenchmark}
            bffDownloadPrefix="/api/test/download"
          />
        }
        panelProps={{
          artifactType: "test",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as TestGroupOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as TestGroupOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          prompts: context.prompts?.prompts,
          getGroupAction: getTestGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchTestGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="space-y-6 px-4">
          <Benchmark
            evalsData={evalsData}
            rubricMappings={rubricMappings}
          />

          {/* History section — data embedded in benchmark/get response */}
          <div className="mt-12">
            <div className="space-y-4">
              <EvalHistory
                data={dataArray}
                totalCount={historyData?.total_count || 0}
                pageIndex={historyPage}
                pageSize={historyPageSize}
                isLoading={false}
                showArchive={true}
                evalOptions={historyData?.eval_options || []}
                modelOptions={historyData?.model_options || []}
                profileOptions={historyData?.profile_options || []}
                rubricOptions={historyData?.rubric_options || []}
                evalSearch={evalSearchTerm}
                modelSearch={modelSearchTerm}
                profileSearch={profileSearchTerm}
                rubricSearch={rubricSearchTerm}
                initialColumnVisibility={initialEvalHistoryColumnVisibility}
                bulkArchiveTestsAction={bulkArchiveTestsAction}
              />
            </div>
          </div>
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
      // 401 → not logged in. /benchmark has no single-resource concept,
      // so 403 (wrong department) doesn't apply here — fall through and throw.
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/benchmark"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component ---- */
export type {
  BenchmarkOverviewIn,
  BenchmarkOverviewOut,
  EvalsListOut,
};
