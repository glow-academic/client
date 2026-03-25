/**
 * app/(main)/create/simulations/page.tsx
 * Simulation list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import { Simulations } from "@/components/artifacts/simulation/Simulations";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";

import { loadSimulationsListSearchParams } from "@/lib/search-params/simulations";

/** ---- Strong types from OpenAPI ---- */
type SimulationsListOut = OutputOf<"/api/v5/artifacts/simulations/search", "post">;
type DuplicateSimulationIn = InputOf<"/api/v5/artifacts/simulations/duplicate", "post">;
type DuplicateSimulationOut = OutputOf<"/api/v5/artifacts/simulations/duplicate", "post">;
type DeleteSimulationIn = InputOf<"/api/v5/artifacts/simulations/delete", "post">;
type DeleteSimulationOut = OutputOf<"/api/v5/artifacts/simulations/delete", "post">;
type CreateSimulationIn = InputOf<"/api/v5/artifacts/simulations/create", "post">;
type CreateSimulationOut = OutputOf<"/api/v5/artifacts/simulations/create", "post">;
type UpdateSimulationIn = InputOf<"/api/v5/artifacts/simulations/update", "post">;
type UpdateSimulationOut = OutputOf<"/api/v5/artifacts/simulations/update", "post">;
import type { ParseCsvResult } from "@/components/common/BulkImport";

/** ---- Body type for simulations list request ---- */
type SimulationsListBody = {
  search?: string | null;
  filter_scenario_ids?: string[] | null;
  filter_cohort_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  scenario_search?: string | null;
  cohort_search?: string | null;
  department_search?: string | null;
  flag_search?: string | null;
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
    "/artifacts/simulations/search",
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
  return api.post("/artifacts/simulations/duplicate", input);
}

async function deleteSimulation(
  input: DeleteSimulationIn,
): Promise<DeleteSimulationOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/simulations/delete", input);
}

async function createSimulation(input: CreateSimulationIn): Promise<CreateSimulationOut> {
  "use server";
  return api.post("/artifacts/simulations/create", input);
}

async function updateSimulation(input: UpdateSimulationIn): Promise<UpdateSimulationOut> {
  "use server";
  return api.post("/artifacts/simulations/update", input);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/artifacts/simulations/csv", { formData });
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/simulations/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/simulations/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/simulations/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
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
    flag_search: q.flagSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data and view cookie in parallel
  const [listData, initialColumnVisibility] = await Promise.all([
    getSimulationsList(body),
    readViewCookie("simulations"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Training", section: "training", url: "/training" },
          { title: "Simulations" },
        ]}
        toolbar={<NewArtifactButton label="New Simulation" href="/training/simulations/new" />}
      />
      <div className="space-y-6 px-4" data-page="simulations-index">
        <Simulations
          listData={listData}
          initialColumnVisibility={initialColumnVisibility}
          duplicateSimulationAction={duplicateSimulation}
          deleteSimulationAction={deleteSimulation}
          createSimulationAction={createSimulation}
          updateSimulationAction={updateSimulation}
          parseCsvAction={parseCsv}
          importFields={listData.import_fields as import("@/components/common/BulkImport").ImportFieldDef[] | undefined}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={listData.total_count ?? 0}
          scenarioSearch={q.scenarioSearch ?? ""}
          cohortSearch={q.cohortSearch ?? ""}
          departmentSearch={q.departmentSearch ?? ""}
          flagSearch={q.flagSearch ?? ""}
        />
      </div>
    </>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteSimulationIn,
  DeleteSimulationOut,
  DuplicateSimulationIn,
  DuplicateSimulationOut,
  CreateSimulationIn,
  CreateSimulationOut,
  UpdateSimulationIn,
  UpdateSimulationOut,
  SimulationsListOut,
};
