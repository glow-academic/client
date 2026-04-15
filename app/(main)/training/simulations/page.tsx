/**
 * app/(main)/training/simulations/page.tsx
 * Simulation list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import { Simulations } from "@/components/artifacts/simulation/Simulations";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getLayoutContextData } from "@/app/(main)/layout-server";
import { loadSimulationsListSearchParams } from "@/lib/search-params/simulations";
import type { ParseCsvResult } from "@/components/common/BulkImport";

/** ---- Strong types from OpenAPI ---- */
type SimulationsListOut = OutputOf<"/simulations/search", "post">;
type DuplicateSimulationIn = InputOf<"/simulations/duplicate", "post">;
type DuplicateSimulationOut = OutputOf<"/simulations/duplicate", "post">;
type DeleteSimulationIn = InputOf<"/simulations/delete", "post">;
type DeleteSimulationOut = OutputOf<"/simulations/delete", "post">;
type CreateSimulationIn = InputOf<"/simulations/create", "post">;
type CreateSimulationOut = OutputOf<"/simulations/create", "post">;
type UpdateSimulationIn = InputOf<"/simulations/update", "post">;
type UpdateSimulationOut = OutputOf<"/simulations/update", "post">;
type GroupSimulationIn = InputOf<"/simulations/group", "post">;
type GroupSimulationOut = OutputOf<"/simulations/group", "post">;
type GenerateSimulationIn = InputOf<"/simulations/generate", "post">;
type GenerateSimulationOut = OutputOf<"/simulations/generate", "post">;
type GenerationsIn = InputOf<"/simulations/generations", "post">;
type GenerationsOut = OutputOf<"/simulations/generations", "post">;
type ProblemSimulationIn = InputOf<"/simulations/problem", "post">;
type ProblemSimulationOut = OutputOf<"/simulations/problem", "post">;
type ContextIn = InputOf<"/simulations/context", "post">;
type ContextOut = OutputOf<"/simulations/context", "post">;

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
    "/simulations/search",
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

/** ---- Strongly-typed server actions ---- */
async function duplicateSimulation(
  input: DuplicateSimulationIn,
): Promise<DuplicateSimulationOut> {
  "use server";
  return api.post("/simulations/duplicate", input);
}

async function deleteSimulation(
  input: DeleteSimulationIn,
): Promise<DeleteSimulationOut> {
  "use server";
  return api.post("/simulations/delete", input);
}

async function createSimulation(input: CreateSimulationIn): Promise<CreateSimulationOut> {
  "use server";
  return api.post("/simulations/create", input);
}

async function updateSimulation(input: UpdateSimulationIn): Promise<UpdateSimulationOut> {
  "use server";
  return api.post("/simulations/update", input);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/simulations/csv", { formData });
}

async function generateSimulation(
  input: GenerateSimulationIn
): Promise<GenerateSimulationOut> {
  "use server";
  return api.post("/simulations/generate", input);
}

async function getSimulationGroupHistory(groupId: string): Promise<GroupSimulationOut> {
  "use server";
  return api.post("/simulations/group", { body: { group_id: groupId } } as GroupSimulationIn);
}

async function searchSimulationGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/simulations/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createSimulationProblem(input: ProblemSimulationIn): Promise<ProblemSimulationOut> {
  "use server";
  return api.post("/simulations/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/simulations/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface SimulationsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SimulationsPage({ searchParams }: SimulationsPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

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

  // Fetch list data, view cookie, and group in parallel
  const [listData, initialColumnVisibility, groupResult] = await Promise.all([
    getSimulationsList(body),
    readViewCookie("simulations"),
    api.post("/simulations/group", { body: {} } as GroupSimulationIn),
  ]);

  return (
    <FullPageLayout
      profileData={profileData}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "simulation",
        createFeedback: createSimulationProblem,
      }}
      breadcrumbs={[
        { title: "Training", section: "training", url: "/training" },
        { title: "Simulations" },
      ]}
      toolbar={<NewArtifactButton label="New Simulation" href="/training/simulations/new" />}
      panelProps={{
        artifactType: "simulation",
        groupId: (groupResult as GroupSimulationOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateSimulation,
        permissions: [
          { artifact: "simulation", operation: "draft" },
          { artifact: "simulation", operation: "get" },
          { artifact: "simulation", operation: "docs" },
          { artifact: "simulation", operation: "group" },
        ],
        getGroupHistory: getSimulationGroupHistory,
        searchGroups: searchSimulationGroups,
      }}
    >
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
    </FullPageLayout>
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
