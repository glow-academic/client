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

  // Fetch evals list server-side
  const evalsData = await getEvalsList(evalsFilters);

  return (
    <div className="space-y-6">
      <Benchmark evalsData={evalsData} />
    </div>
  );
}

/** ---- Export types for client component ---- */
export type { EvalsListIn, EvalsListOut };
