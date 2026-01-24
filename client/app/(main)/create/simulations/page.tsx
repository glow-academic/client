/**
 * app/(main)/create/simulations/page.tsx
 * Simulation list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import { Simulations } from "@/components/simulations/Simulations";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

import { loadSimulationsListSearchParams } from "./listSearchParams";

/** ---- Strong types from OpenAPI ---- */
type SimulationsListOut = OutputOf<"/api/v4/simulations/list", "post">;
type DuplicateSimulationIn = InputOf<"/api/v4/simulations/duplicate", "post">;
type DuplicateSimulationOut = OutputOf<"/api/v4/simulations/duplicate", "post">;
type DeleteSimulationIn = InputOf<"/api/v4/simulations/delete", "post">;
type DeleteSimulationOut = OutputOf<"/api/v4/simulations/delete", "post">;

/** ---- Body type for simulations list request ---- */
type SimulationsListBody = {
  search?: string | null;
  filter_scenario_ids?: string[] | null;
  filter_cohort_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  scenario_search?: string | null;
  cohort_search?: string | null;
  department_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getSimulationsList = async (body: SimulationsListBody): Promise<SimulationsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/simulations/list",
    { body },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateSimulation(
  input: DuplicateSimulationIn,
): Promise<DuplicateSimulationOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/simulations/duplicate", input);
}

async function deleteSimulation(
  input: DeleteSimulationIn,
): Promise<DeleteSimulationOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/simulations/delete", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Simulations",
    description:
      "Manage teaching practice simulations for graduate teaching assistant training. Create and organize realistic student interaction scenarios to practice pedagogical techniques, improve communication skills, and enhance teaching effectiveness through simulation-based learning.",
  };
}

interface SimulationsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SimulationsPage({ searchParams }: SimulationsPageProps) {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)

  // Parse search params using nuqs
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  const q = loadSimulationsListSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: SimulationsListBody = {
    search: q.search || null,
    filter_scenario_ids: q.scenarioIds && q.scenarioIds.length > 0 ? q.scenarioIds : null,
    filter_cohort_ids: q.cohortIds && q.cohortIds.length > 0 ? q.cohortIds : null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    scenario_search: q.scenarioSearch || null,
    cohort_search: q.cohortSearch || null,
    department_search: q.departmentSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data server-side with filters
  const listData = await getSimulationsList(body);

  return (
    <div className="space-y-6" data-page="simulations-index">
      <Simulations
        listData={listData}
        duplicateSimulationAction={duplicateSimulation}
        deleteSimulationAction={deleteSimulation}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={listData.total_count ?? 0}
        scenarioSearch={q.scenarioSearch ?? ""}
        cohortSearch={q.cohortSearch ?? ""}
        departmentSearch={q.departmentSearch ?? ""}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteSimulationIn,
  DeleteSimulationOut,
  DuplicateSimulationIn,
  DuplicateSimulationOut,
  SimulationsListOut,
};
