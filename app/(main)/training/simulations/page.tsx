/**
 * app/(main)/training/simulations/page.tsx
 * Simulation list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import { Simulations } from "@/components/artifacts/simulation/Simulations";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { loadSimulationsListSearchParams } from "@/lib/search-params/simulations";
import type { ParseCsvResult } from "@/components/common/BulkImport";

/** ---- Strong types from OpenAPI ---- */
type SimulationsListOut = OutputOf<"/simulation/search", "post">;
type DuplicateSimulationIn = InputOf<"/simulation/duplicate", "post">;
type DuplicateSimulationOut = OutputOf<"/simulation/duplicate", "post">;
type DeleteSimulationIn = InputOf<"/simulation/delete", "post">;
type DeleteSimulationOut = OutputOf<"/simulation/delete", "post">;
type CreateSimulationIn = InputOf<"/simulation/create", "post">;
type CreateSimulationOut = OutputOf<"/simulation/create", "post">;
type UpdateSimulationIn = InputOf<"/simulation/update", "post">;
type UpdateSimulationOut = OutputOf<"/simulation/update", "post">;
type GroupSimulationIn = InputOf<"/simulation/group", "post">;
type GroupSimulationOut = OutputOf<"/simulation/group", "post">;
type GenerateSimulationIn = InputOf<"/simulation/generate", "post">;
type GenerateSimulationOut = OutputOf<"/simulation/generate", "post">;
type GenerationsIn = InputOf<"/simulation/generations", "post">;
type GenerationsOut = OutputOf<"/simulation/generations", "post">;
type ProblemSimulationIn = InputOf<"/simulation/problem", "post">;
type ProblemSimulationOut = OutputOf<"/simulation/problem", "post">;
type ContextIn = InputOf<"/simulation/context", "post">;
type ContextOut = OutputOf<"/simulation/context", "post">;

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
    "/simulation/search",
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
  return api.post("/simulation/duplicate", input);
}

async function deleteSimulation(
  input: DeleteSimulationIn,
): Promise<DeleteSimulationOut> {
  "use server";
  return api.post("/simulation/delete", input);
}

async function createSimulation(input: CreateSimulationIn): Promise<CreateSimulationOut> {
  "use server";
  return api.post("/simulation/create", input);
}

async function updateSimulation(input: UpdateSimulationIn): Promise<UpdateSimulationOut> {
  "use server";
  return api.post("/simulation/update", input);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/simulation/csv", { formData });
}

async function generateSimulation(
  input: GenerateSimulationIn
): Promise<GenerateSimulationOut> {
  "use server";
  return api.post("/simulation/generate", input);
}

async function getSimulationGroupHistory(groupId: string): Promise<GroupSimulationOut> {
  "use server";
  return api.post("/simulation/group", { body: { group_id: groupId } } as GroupSimulationIn);
}

async function searchSimulationGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/simulation/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createSimulationProblem(input: ProblemSimulationIn): Promise<ProblemSimulationOut> {
  "use server";
  return api.post("/simulation/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/simulation/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Simulations" };
  }
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

  try {
    // Profile data for providers
    const context = await api.post("/simulation/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/training/simulations", context.profile.role_permissions);

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
      api.post("/simulation/group", { body: {} } as GroupSimulationIn),
    ]);

    return (
      <FullPageLayout
        profileData={context.profile}
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
          operations: ["draft", "get", "group"],
          getGroupHistory: getSimulationGroupHistory,
          searchGroups: searchSimulationGroups,
          prompts: context.prompts?.prompts,
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
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/training/simulations"
        />
      );
    }
    throw error;
  }
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
