/**
 * app/(main)/benchmark/page.tsx
 * Benchmark page for running evaluations.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import Benchmark from "@/components/benchmark/Benchmark";
import EvalHistory from "@/components/benchmark/EvalHistory";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getLayoutContext } from "../layout-server";

/** ---- Strong types from OpenAPI ---- */
type BenchmarkOverviewIn = InputOf<"/api/v4/analytics/benchmark/get", "post">;
type BenchmarkOverviewOut = OutputOf<"/api/v4/analytics/benchmark/get", "post">;
type BenchmarkHistoryIn = InputOf<"/api/v4/analytics/benchmark/list", "post">;
type BenchmarkHistoryOut = OutputOf<"/api/v4/analytics/benchmark/list", "post">;
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
};

/** ---- Direct fetch (no Next.js cache) ----
 * Benchmark overview responses can get large. Using cache: 'no-store' to disable Next.js default fetch caching.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getBenchmarkOverview = async (
  input: BenchmarkOverviewIn
): Promise<BenchmarkOverviewOut> => {
  "use server";
  const bypassCache = await isHardRefresh();

  return api.post("/analytics/benchmark/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Direct fetch (no Next.js cache) ----
 * Benchmark history responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getBenchmarkHistory = async (
  input: BenchmarkHistoryIn
): Promise<BenchmarkHistoryOut> => {
  "use server";
  const bypassCache = await isHardRefresh();

  return api.post("/analytics/benchmark/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Benchmark",
    description:
      "Run and manage evaluations for teaching assistant training platform. Execute benchmark tests, analyze performance metrics, and evaluate system effectiveness for educational institutions and L&D programs.",
  };
}

interface BenchmarkPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BenchmarkPage({
  searchParams,
}: BenchmarkPageProps) {
  // Access control handled server-side in layout
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Get profileId and departmentIds from profile context with resolved UUIDs
  // Use cached layout context (reuses data already fetched by layout)
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts) or cookies
  let profileContext;
  try {
    profileContext = await getLayoutContext({
      body: {},
    });
  } catch (error) {
    // Handle 401 Unauthorized (invalid session - profile doesn't exist)
    // This can happen if the database was reset but the session still has old profile IDs
    // The layout's getLayoutContextData will also fail with the same 401 error,
    // and the layout will show access denied UI. Re-throw the error so the layout handles it.
    if (
      error instanceof Error &&
      "status" in error &&
      (error as { status: number }).status === 401
    ) {
      // Re-throw the error - the layout's getLayoutContextData will also fail with 401,
      // and the updated layout code will show access denied UI
      throw error;
    }
    // Re-throw other errors
    throw error;
  }

  // Build benchmark overview filters (department_ids only) - convert to snake_case
  // profile_id removed - comes from X-Profile-Id header automatically
  // Always pass department_ids (never empty array) - use all IDs from profile context
  const overviewFilters: BenchmarkOverviewIn = {
    body: {
      department_ids: profileContext.department_ids || [], // Always pass (non-empty from profile context)
    },
  };

  // Extract pagination and filter params from search params
  const historyPage = searchParamsObj.get("historyPage")
    ? parseInt(searchParamsObj.get("historyPage") || "0", 10)
    : 0;
  const historyPageSize = searchParamsObj.get("historyPageSize")
    ? parseInt(searchParamsObj.get("historyPageSize") || "10", 10)
    : 10;
  const historySearch = searchParamsObj.get("historySearch") || undefined;
  const historyEvalIds = searchParamsObj.get("historyEvalIds")
    ? searchParamsObj.get("historyEvalIds")?.split(",").filter(Boolean)
    : undefined;
  const historyStatus = searchParamsObj.get("historyStatus") || undefined;
  const historyArchived =
    searchParamsObj.get("historyArchived") === "true"
      ? true
      : searchParamsObj.get("historyArchived") === "false"
        ? false
        : undefined;
  const historySortBy = searchParamsObj.get("historySortBy") || "created_at";
  const historySortOrder = searchParamsObj.get("historySortOrder") || "desc";

  // Fetch benchmark overview server-side (evals only - history is separate endpoint)
  const overviewData = await getBenchmarkOverview(overviewFilters);

  // Convert arrays to dicts for backward compatibility with Benchmark component
  // API now returns arrays instead of dicts (composite types)
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
      const rubricMapping = rubricStandardGroupsMapping[rsg.rubric_id];
      if (rubricMapping) {
        rubricMapping[rsg.standard_group_id] = standardIds.map((id) =>
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
  };

  // Create historyKey for Suspense boundary to trigger re-fetch on URL param changes
  const historyKey = [
    historyPage,
    historyPageSize,
    historySearch || "",
    (historyEvalIds || []).join(","),
    historyStatus || "",
    historyArchived === undefined ? "all" : historyArchived ? "true" : "false",
    historySortBy,
    historySortOrder,
  ].join("|");

  // Build rubric mappings from evals list response (similar to practice page)
  // Transform standard_groups_mapping and standards_mapping into rubric-specific mappings
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

  // Build rubric mappings for each unique rubric_id
  const uniqueRubricIds = Array.from(
    new Set(
      (evalsData.evals || [])
        .map((evalItem) => evalItem.rubric_id)
        .filter((id): id is string => id !== null)
    )
  );

  for (const rubricId of uniqueRubricIds) {
    // Get standard_group_ids map for this rubric (groupId -> standard_ids[])
    const rubricStandardGroupsMap =
      evalsData.rubric_standard_groups_mapping?.[rubricId] || {};

    // Build standard_groups mapping (groupId -> standard_ids[])
    // The map already contains standard_ids arrays per group
    const standard_groups: Record<string, string[]> = {};
    for (const [groupId, standardIds] of Object.entries(
      rubricStandardGroupsMap
    )) {
      // standardIds is already an array from the SQL query
      if (Array.isArray(standardIds)) {
        standard_groups[groupId] = standardIds;
      }
    }

    // Build standardGroupsMapping from standard_groups_mapping
    const standardGroupsMapping: Record<
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
        standardGroupsMapping[groupId] = {
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
        standardGroupsMapping,
        standardsMapping: evalsData.standards_mapping || {},
      };
    }
  }

  return (
    <div className="space-y-6">
      <Benchmark evalsData={evalsData} rubricMappings={rubricMappings} />

      {/* History section moved out of Benchmark, fully server-driven */}
      <div className="mt-12">
        <Suspense
          key={historyKey}
          fallback={
            <div className="text-muted-foreground">Loading history...</div>
          }
        >
          <BenchmarkHistorySection
            historyPage={historyPage}
            historyPageSize={historyPageSize}
            historySearch={historySearch}
            historyEvalIds={historyEvalIds}
            historyStatus={historyStatus}
            historyArchived={historyArchived}
            historySortBy={historySortBy}
            historySortOrder={historySortOrder}
            departmentIds={profileContext.department_ids || []}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** ---- Inline history section component (only used here) ---- */
async function BenchmarkHistorySection({
  historyPage,
  historyPageSize,
  historySearch,
  historyEvalIds,
  historyStatus,
  historyArchived,
  historySortBy,
  historySortOrder,
  departmentIds,
}: {
  historyPage: number;
  historyPageSize: number;
  historySearch?: string | undefined;
  historyEvalIds?: string[] | undefined;
  historyStatus?: string | undefined;
  historyArchived?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
  departmentIds: string[];
}) {
  // Build history filters for benchmark (department_ids, eval_ids, status, archived, search)
  // profile_id removed - comes from X-Profile-Id header automatically
  // Convert camelCase to snake_case for API
  const historyFilters: BenchmarkHistoryIn = {
    body: {
      department_ids: departmentIds,
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

  // Calculate archived/unarchived counts from data
  const dataArray = historyData.data || [];
  const archivedCount = dataArray.filter((item) => item.archived).length;
  const unarchivedCount = dataArray.filter((item) => !item.archived).length;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">History</h2>
      <EvalHistory
        data={dataArray}
        totalCount={historyData.total_count || 0}
        pageIndex={historyPage}
        pageSize={historyPageSize}
        isLoading={false}
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
  EvalsListOut,
};
