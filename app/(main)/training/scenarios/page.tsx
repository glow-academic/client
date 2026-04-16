/**
 * app/(main)/training/scenarios/page.tsx
 * Scenario list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import { Scenarios } from "@/components/artifacts/scenario/Scenarios";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { loadScenariosListSearchParams } from "@/lib/search-params/scenarios-list";
import type { ParseCsvResult } from "@/components/common/BulkImport";

/** ---- Strong types from OpenAPI ---- */
type ScenariosListOut = OutputOf<"/scenario/search", "post">;
type DuplicateScenarioIn = InputOf<"/scenario/duplicate", "post">;
type DuplicateScenarioOut = OutputOf<"/scenario/duplicate", "post">;
type DeleteScenarioIn = InputOf<"/scenario/delete", "post">;
type DeleteScenarioOut = OutputOf<"/scenario/delete", "post">;
type CreateScenarioIn = InputOf<"/scenario/create", "post">;
type CreateScenarioOut = OutputOf<"/scenario/create", "post">;
type UpdateScenarioIn = InputOf<"/scenario/update", "post">;
type UpdateScenarioOut = OutputOf<"/scenario/update", "post">;
type GroupScenarioIn = InputOf<"/scenario/group", "post">;
type GroupScenarioOut = OutputOf<"/scenario/group", "post">;
type GenerateScenarioIn = InputOf<"/scenario/generate", "post">;
type GenerateScenarioOut = OutputOf<"/scenario/generate", "post">;
type GenerationsIn = InputOf<"/scenario/generations", "post">;
type GenerationsOut = OutputOf<"/scenario/generations", "post">;
type ProblemScenarioIn = InputOf<"/scenario/problem", "post">;
type ProblemScenarioOut = OutputOf<"/scenario/problem", "post">;
type ContextIn = InputOf<"/scenario/context", "post">;
type ContextOut = OutputOf<"/scenario/context", "post">;

/** ---- Body type for scenarios list request ---- */
type ScenariosListBody = {
  search?: string | null;
  persona_ids?: string[] | null;
  simulation_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  persona_search?: string | null;
  simulation_search?: string | null;
  department_search?: string | null;
  flag_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getScenariosList = async (body: ScenariosListBody): Promise<ScenariosListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/scenario/search",
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
async function duplicateScenario(
  input: DuplicateScenarioIn,
): Promise<DuplicateScenarioOut> {
  "use server";
  return api.post("/scenario/duplicate", input);
}

async function deleteScenario(
  input: DeleteScenarioIn,
): Promise<DeleteScenarioOut> {
  "use server";
  return api.post("/scenario/delete", input);
}

async function createScenario(input: CreateScenarioIn): Promise<CreateScenarioOut> {
  "use server";
  return api.post("/scenario/create", input);
}

async function updateScenario(input: UpdateScenarioIn): Promise<UpdateScenarioOut> {
  "use server";
  return api.post("/scenario/update", input);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/scenario/csv", { formData });
}

async function generateScenario(
  input: GenerateScenarioIn
): Promise<GenerateScenarioOut> {
  "use server";
  return api.post("/scenario/generate", input);
}

async function getScenarioGroupHistory(groupId: string): Promise<GroupScenarioOut> {
  "use server";
  return api.post("/scenario/group", { body: { group_id: groupId } } as GroupScenarioIn);
}

async function searchScenarioGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/scenario/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createScenarioProblem(input: ProblemScenarioIn): Promise<ProblemScenarioOut> {
  "use server";
  return api.post("/scenario/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/scenario/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Scenarios" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface ScenariosPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ScenariosPage({ searchParams }: ScenariosPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const context = await api.post("/scenario/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);

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

    const q = loadScenariosListSearchParams(searchParamsObj);

    // Compute pagination
    const pageIndex = q.page ?? 0;
    const pageSize = q.pageSize ?? 10;
    const offset = pageIndex * pageSize;

    // Build request body with filter values from URL
    const body: ScenariosListBody = {
      search: q.search || null,
      persona_ids: q.personaIds && q.personaIds.length > 0 ? q.personaIds : null,
      simulation_ids: q.simulationIds && q.simulationIds.length > 0 ? q.simulationIds : null,
      filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
      persona_search: q.personaSearch || null,
      simulation_search: q.simulationSearch || null,
      department_search: q.departmentSearch || null,
      flag_search: q.flagSearch || null,
      page_size: pageSize,
      page_offset: offset,
    };

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getScenariosList(body),
      readViewCookie("scenarios"),
      api.post("/scenario/group", { body: {} } as GroupScenarioIn),
    ]);

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "scenario",
          createFeedback: createScenarioProblem,
        }}
        breadcrumbs={[
          { title: "Training", section: "training", url: "/training" },
          { title: "Scenarios" },
        ]}
        toolbar={<NewArtifactButton label="New Scenario" href="/training/scenarios/new" />}
        panelProps={{
          artifactType: "scenario",
          groupId: (groupResult as GroupScenarioOut & { group_id?: string })?.group_id ?? null,
          generateAction: generateScenario,
          operations: ["draft", "get", "group"],
          getGroupHistory: getScenarioGroupHistory,
          searchGroups: searchScenarioGroups,
          prompts: context.prompts?.prompts,
        }}
      >
        <div className="space-y-6 px-4" data-page="scenarios-index">
          <Scenarios
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            duplicateScenarioAction={duplicateScenario}
            deleteScenarioAction={deleteScenario}
            createScenarioAction={createScenario}
            updateScenarioAction={updateScenario}
            parseCsvAction={parseCsv}
            importFields={listData.import_fields ?? undefined}
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalCount={listData.total_count ?? 0}
            personaSearch={q.personaSearch ?? ""}
            simulationSearch={q.simulationSearch ?? ""}
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
          pathname="/training/scenarios"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteScenarioIn,
  DeleteScenarioOut,
  DuplicateScenarioIn,
  DuplicateScenarioOut,
  CreateScenarioIn,
  CreateScenarioOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
  ScenariosListOut,
};
