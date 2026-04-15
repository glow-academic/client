/**
 * app/(main)/benchmark/page.tsx
 * Benchmark page for running evaluations — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import Benchmark from "@/components/artifacts/benchmark/Benchmark";
import EvalHistory from "@/components/artifacts/benchmark/EvalHistory";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";

import { buildSnapshot } from "@/lib/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadBenchmarkSearchParams } from "@/lib/search-params/benchmark";

/** ---- Strong types from OpenAPI ---- */
type BenchmarkOverviewIn = InputOf<"/benchmark/get", "post">;
type BenchmarkOverviewOut = OutputOf<"/benchmark/get", "post">;
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
type ContextIn = InputOf<"/benchmark/context", "post">;
type ContextOut = OutputOf<"/benchmark/context", "post">;
type GenerateBenchmarkIn = InputOf<"/benchmark/generate", "post">;
type GenerateBenchmarkOut = OutputOf<"/benchmark/generate", "post">;
type GenerationsIn = InputOf<"/benchmark/generations", "post">;
type GenerationsOut = OutputOf<"/benchmark/generations", "post">;
type GroupBenchmarkIn = InputOf<"/benchmark/group", "post">;
type GroupBenchmarkOut = OutputOf<"/benchmark/group", "post">;
type ProblemBenchmarkIn = InputOf<"/benchmark/problem", "post">;
type ProblemBenchmarkOut = OutputOf<"/benchmark/problem", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getBenchmarkOverview = async (
  input: BenchmarkOverviewIn
): Promise<BenchmarkOverviewOut> => {
  "use server";
  const bypassCache = await isHardRefresh();

  return api.post("/benchmark/get", input, {
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
  await api.post("/benchmark/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function generateBenchmark(
  input: GenerateBenchmarkIn
): Promise<GenerateBenchmarkOut> {
  "use server";
  return api.post("/benchmark/generate", input);
}

async function getBenchmarkGroupHistory(groupId: string): Promise<GroupBenchmarkOut> {
  "use server";
  return api.post("/benchmark/group", { body: { group_id: groupId } } as GroupBenchmarkIn);
}

async function searchBenchmarkGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/benchmark/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createBenchmarkProblem(input: ProblemBenchmarkIn): Promise<ProblemBenchmarkOut> {
  "use server";
  return api.post("/benchmark/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/benchmark/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

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

  // Profile data for providers
  const context = await api.post("/benchmark/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

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
    api.post("/benchmark/group", { body: {} } as GroupBenchmarkIn),
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
        />
      }
      panelProps={{
        artifactType: "benchmark",
        groupId: (groupResult as GroupBenchmarkOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateBenchmark,
        permissions: [
          { artifact: "benchmark", operation: "draft" },
          { artifact: "benchmark", operation: "get" },
          { artifact: "benchmark", operation: "docs" },
          { artifact: "benchmark", operation: "group" },
        ],
        getGroupHistory: getBenchmarkGroupHistory,
        searchGroups: searchBenchmarkGroups,
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
              showCustomize={true}
            />
          </div>
        </div>
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component ---- */
export type {
  BenchmarkOverviewIn,
  BenchmarkOverviewOut,
  EvalsListOut,
};
