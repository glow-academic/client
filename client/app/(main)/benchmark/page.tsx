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
type BenchmarkBundleIn = InputOf<"/api/v3/benchmark/bundle", "post">;
type BenchmarkBundleOut = OutputOf<"/api/v3/benchmark/bundle", "post">;
// For backward compatibility, extract evals list structure from bundle
type EvalsListOut = {
  evals: BenchmarkBundleOut["evals"];
  rubric_mapping: BenchmarkBundleOut["rubric_mapping"];
  department_mapping: BenchmarkBundleOut["department_mapping"];
  agent_mapping: BenchmarkBundleOut["agent_mapping"];
  standard_groups_mapping: BenchmarkBundleOut["standard_groups_mapping"];
  standards_mapping: BenchmarkBundleOut["standards_mapping"];
  rubric_standard_groups_mapping: BenchmarkBundleOut["rubric_standard_groups_mapping"];
  rubric_options: BenchmarkBundleOut["rubric_options"];
  department_options: BenchmarkBundleOut["department_options"];
  agent_options: BenchmarkBundleOut["agent_options"];
};

/** ---- Direct fetch (no Next.js cache) ----
 * Benchmark bundle responses can get large. Using cache: 'no-store' to disable Next.js default fetch caching.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getBenchmarkBundle = async (
  input: BenchmarkBundleIn,
): Promise<BenchmarkBundleOut> => {
  "use server";
  const bypassCache = await isHardRefresh();

  return api.post("/benchmark/bundle", input, {
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
  // Build benchmark bundle filters (empty body - profileId comes from header)
  const bundleFilters: BenchmarkBundleIn = {
    body: {},
  };

  // Fetch benchmark bundle server-side (includes evals list and attempts)
  const bundleData = await getBenchmarkBundle(bundleFilters);

  // Extract evals list structure from bundle for Benchmark component
  const evalsData: EvalsListOut = {
    evals: bundleData.evals,
    rubric_mapping: bundleData.rubric_mapping,
    department_mapping: bundleData.department_mapping,
    agent_mapping: bundleData.agent_mapping,
    standard_groups_mapping: bundleData.standard_groups_mapping,
    standards_mapping: bundleData.standards_mapping,
    rubric_standard_groups_mapping: bundleData.rubric_standard_groups_mapping,
    rubric_options: bundleData.rubric_options,
    department_options: bundleData.department_options,
    agent_options: bundleData.agent_options,
  };

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
export type { BenchmarkBundleIn, BenchmarkBundleOut, EvalsListOut };
