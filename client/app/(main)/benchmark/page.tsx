/**
 * app/(main)/benchmark/page.tsx
 * Benchmark page for running evaluations.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import Benchmark from "@/components/benchmark/Benchmark";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type EvalsListIn = InputOf<"/api/v3/evals/list", "post">;
type EvalsListOut = OutputOf<"/api/v3/evals/list", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Eval list responses can get large. Using cache: 'no-store' to disable Next.js default fetch caching.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getEvalsList = async (input: EvalsListIn): Promise<EvalsListOut> => {
  "use server";
  const bypassCache = await isHardRefresh();

  return api.post("/evals/list", input, {
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

export default async function BenchmarkPage() {
  // Build evals filters (empty body - profileId comes from header)
  const evalsFilters: EvalsListIn = {
    body: {},
  };

  // Fetch evals list server-side (now includes rubric mappings)
  const evalsData = await getEvalsList(evalsFilters);

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
    new Set(evalsData.evals.map((evalItem) => evalItem.rubric_id))
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

    rubricMappings[rubricId] = {
      standard_groups,
      standardGroupsMapping,
      standardsMapping: evalsData.standards_mapping || {},
    };
  }

  return (
    <div className="space-y-6">
      <Benchmark evalsData={evalsData} rubricMappings={rubricMappings} />
    </div>
  );
}

/** ---- Export types for client component ---- */
export type { EvalsListIn, EvalsListOut };
