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
type RubricDetailIn = InputOf<"/api/v3/rubrics/detail", "post">;
type RubricDetailOut = OutputOf<"/api/v3/rubrics/detail", "post">;

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

/** ---- Fetch rubric detail ---- */
const getRubricDetail = async (
  input: RubricDetailIn
): Promise<RubricDetailOut> => {
  "use server";
  const bypassCache = await isHardRefresh();

  return api.post("/rubrics/detail", input, {
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

  // Fetch evals list server-side
  const evalsData = await getEvalsList(evalsFilters);

  // Extract unique rubric IDs from evals
  const uniqueRubricIds = Array.from(
    new Set(evalsData.evals.map((evalItem) => evalItem.rubric_id))
  );

  // Fetch rubric details for all unique rubric IDs
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

  // Fetch rubric details in parallel
  await Promise.all(
    uniqueRubricIds.map(async (rubricId) => {
      try {
        const rubricDetail = await getRubricDetail({
          body: { rubricId },
        });

        // Transform rubric detail to match TableRubric format
        const standard_groups: Record<string, string[]> = {};
        rubricDetail.standard_group_ids.forEach((groupId) => {
          const groupDetail = rubricDetail.standard_groups_detail[groupId];
          if (groupDetail) {
            standard_groups[groupId] = groupDetail.standard_ids;
          }
        });

        // Transform standardGroupsMapping
        const standardGroupsMapping: Record<
          string,
          {
            name: string;
            description: string;
            points: number;
            passPoints: number;
          }
        > = {};
        Object.entries(rubricDetail.standard_groups_mapping).forEach(
          ([groupId, mapping]) => {
            const groupDetail = rubricDetail.standard_groups_detail[groupId];
            standardGroupsMapping[groupId] = {
              name: mapping["name"] || "",
              description: mapping["description"] || "",
              points: groupDetail?.points || 0,
              passPoints: groupDetail?.passPoints || 0,
            };
          }
        );

        rubricMappings[rubricId] = {
          standard_groups,
          standardGroupsMapping,
          standardsMapping: rubricDetail.standards_mapping,
        };
      } catch {
        // Silently fail for individual rubric fetches - card will just not show rubric dialog
        // console.error(`Failed to fetch rubric ${rubricId}:`, error);
      }
    })
  );

  return (
    <div className="space-y-6">
      <Benchmark evalsData={evalsData} rubricMappings={rubricMappings} />
    </div>
  );
}

/** ---- Export types for client component ---- */
export type { EvalsListIn, EvalsListOut };
