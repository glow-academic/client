/**
 * app/(main)/benchmark/page.tsx
 * Benchmark page for running evaluations.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import Benchmark from "@/components/artifacts/benchmark/Benchmark";
import EvalHistory from "@/components/artifacts/benchmark/EvalHistory";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { Suspense } from "react";
import { loadBenchmarkSearchParams } from "@/lib/search-params/benchmark";

/** ---- Strong types from OpenAPI ---- */
type BenchmarkOverviewIn = InputOf<"/api/v4/artifacts/benchmark/list", "post">;
type BenchmarkOverviewOut = OutputOf<"/api/v4/artifacts/benchmark/list", "post">;
type BenchmarkHistoryIn = InputOf<"/api/v4/artifacts/test/list", "post">;
type BenchmarkHistoryOut = OutputOf<"/api/v4/artifacts/test/list", "post">;
type CreateTestIn = InputOf<"/api/v4/artifacts/test/create", "post">;
type CreateTestOut = OutputOf<"/api/v4/artifacts/test/create", "post">;
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

/** ---- Direct fetch (no Next.js cache) ---- */
const getBenchmarkOverview = async (
  input: BenchmarkOverviewIn
): Promise<BenchmarkOverviewOut> => {
  "use server";
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/benchmark/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

const getBenchmarkHistory = async (
  input: BenchmarkHistoryIn
): Promise<BenchmarkHistoryOut> => {
  "use server";
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/test/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

async function createTestAction(
  input: CreateTestIn,
): Promise<CreateTestOut> {
  "use server";
  return api.post("/artifacts/test/create", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/benchmark/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/benchmark/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/benchmark/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

interface BenchmarkPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BenchmarkPage({
  searchParams,
}: BenchmarkPageProps) {
  // Parse search params via nuqs loader
  const q = loadBenchmarkSearchParams(await searchParams);

  // Compute defaults and resolve filters (departments, date range)
  const { defaults, profileContext } = await computeAnalyticsDefaults();
  const defaultFilters = resolveAnalyticsFilters(q, defaults, profileContext);

  // Build benchmark overview filters
  const overviewFilters: BenchmarkOverviewIn = {
    body: {
      start_date: defaultFilters.startDate,
      end_date: defaultFilters.endDate,
      department_ids: defaultFilters.departmentIds,
    },
  };

  // History params with defaults
  const historyPage = q.historyPage ?? 0;
  const historyPageSize = q.historyPageSize ?? 10;
  const historySearch = q.historySearch ?? undefined;
  const historyEvalIds = q.historyEvalIds ?? undefined;
  const historyStatus = q.historyStatus ?? undefined;
  const historyArchived = q.historyArchived ?? undefined;
  const historySortBy = q.historySortBy ?? "created_at";
  const historySortOrder = q.historySortOrder ?? "desc";

  // Fetch benchmark overview server-side
  const overviewData = await getBenchmarkOverview(overviewFilters);

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

  // Create historyKey for Suspense boundary
  const historyKey = [
    historyPage,
    historyPageSize,
    historySearch || "",
    (historyEvalIds || []).join(","),
    historyStatus || "",
    historyArchived === undefined ? "all" : historyArchived ? "true" : "false",
    historySortBy,
    historySortOrder,
    defaultFilters.startDate,
    defaultFilters.endDate,
    defaultFilters.departmentIds.join(","),
  ].join("|");

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

  return (
    <div className="space-y-6">
      <Benchmark
        evalsData={evalsData}
        rubricMappings={rubricMappings}
        createTestAction={createTestAction}
      />

      {/* History section moved out of Benchmark, fully server-driven */}
      <div className="mt-12">
        <Suspense
          key={historyKey}
          fallback={
            <div className="text-muted-foreground">Loading history...</div>
          }
        >
          <BenchmarkHistorySection
            defaultFilters={defaultFilters}
            historyPage={historyPage}
            historyPageSize={historyPageSize}
            historySearch={historySearch}
            historyEvalIds={historyEvalIds}
            historyStatus={historyStatus}
            historyArchived={historyArchived}
            historySortBy={historySortBy}
            historySortOrder={historySortOrder}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** ---- Inline history section component (only used here) ---- */
async function BenchmarkHistorySection({
  defaultFilters,
  historyPage,
  historyPageSize,
  historySearch,
  historyEvalIds,
  historyStatus,
  historyArchived,
  historySortBy,
  historySortOrder,
}: {
  defaultFilters: {
    startDate: string;
    endDate: string;
    departmentIds: string[];
  };
  historyPage: number;
  historyPageSize: number;
  historySearch?: string | undefined;
  historyEvalIds?: string[] | undefined;
  historyStatus?: string | undefined;
  historyArchived?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
}) {
  const historyFilters: BenchmarkHistoryIn = {
    body: {
      start_date: defaultFilters.startDate,
      end_date: defaultFilters.endDate,
      department_ids: defaultFilters.departmentIds,
      page: historyPage,
      page_size: historyPageSize,
      ...(historySearch && { search: historySearch }),
      ...(historyEvalIds &&
        historyEvalIds.length > 0 && {
          eval_ids: historyEvalIds,
        }),
      ...(historyStatus && { status: historyStatus }),
      ...(historyArchived !== undefined && { archived: historyArchived }),
      sort_by: historySortBy,
      sort_order: historySortOrder,
    },
  };

  const historyData = await getBenchmarkHistory(historyFilters);

  const dataArray = historyData.data || [];

  return (
    <div className="space-y-4">
      <EvalHistory
        data={dataArray}
        totalCount={historyData.total_count || 0}
        pageIndex={historyPage}
        pageSize={historyPageSize}
        isLoading={false}
        showCustomize={true}
      />
    </div>
  );
}

/** ---- Export types for client component ---- */
export type {
  BenchmarkHistoryIn,
  BenchmarkHistoryOut,
  BenchmarkOverviewIn,
  BenchmarkOverviewOut,
  CreateTestIn,
  CreateTestOut,
  EvalsListOut,
};
