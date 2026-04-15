/**
 * app/(main)/system/rubrics/page.tsx
 * Rubric list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Rubrics from "@/components/artifacts/rubric/Rubrics";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { loadRubricsSearchParams } from "@/lib/search-params/rubrics";

/** ---- Strong types from OpenAPI ---- */
type RubricsListOut = OutputOf<"/rubric/search", "post">;
type DuplicateRubricIn = InputOf<"/rubric/duplicate", "post">;
type DuplicateRubricOut = OutputOf<"/rubric/duplicate", "post">;
type DeleteRubricIn = InputOf<"/rubric/delete", "post">;
type DeleteRubricOut = OutputOf<"/rubric/delete", "post">;
type GroupRubricIn = InputOf<"/rubric/group", "post">;
type GroupRubricOut = OutputOf<"/rubric/group", "post">;
type GenerateRubricIn = InputOf<"/rubric/generate", "post">;
type GenerateRubricOut = OutputOf<"/rubric/generate", "post">;
type GenerationsIn = InputOf<"/rubric/generations", "post">;
type GenerationsOut = OutputOf<"/rubric/generations", "post">;
type ProblemRubricIn = InputOf<"/rubric/problem", "post">;
type ProblemRubricOut = OutputOf<"/rubric/problem", "post">;
type ContextIn = InputOf<"/rubric/context", "post">;
type ContextOut = OutputOf<"/rubric/context", "post">;

/** ---- Body type for rubrics list request ---- */
type RubricsListBody = {
  search?: string | null;
  filter_department_ids?: string[] | null;
  filter_simulation_ids?: string[] | null;
  department_search?: string | null;
  simulation_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ---- */
const getRubricsList = async (body: RubricsListBody): Promise<RubricsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/rubric/search",
    { body },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: { "X-Bypass-Cache": "1" },
      }),
    }
  );
};

/** ---- Strongly-typed server actions ---- */
async function duplicateRubric(
  input: DuplicateRubricIn
): Promise<DuplicateRubricOut> {
  "use server";
  return api.post("/rubric/duplicate", input);
}

async function deleteRubric(
  input: DeleteRubricIn
): Promise<DeleteRubricOut> {
  "use server";
  return api.post("/rubric/delete", input);
}

async function generateRubric(
  input: GenerateRubricIn
): Promise<GenerateRubricOut> {
  "use server";
  return api.post("/rubric/generate", input);
}

async function getRubricGroupHistory(groupId: string): Promise<GroupRubricOut> {
  "use server";
  return api.post("/rubric/group", { body: { group_id: groupId } } as GroupRubricIn);
}

async function searchRubricGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/rubric/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createRubricProblem(input: ProblemRubricIn): Promise<ProblemRubricOut> {
  "use server";
  return api.post("/rubric/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/rubric/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface RubricsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RubricsPage({ searchParams }: RubricsPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/rubric/context", { body: {} } as ContextIn) as ContextOut;
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

  const q = loadRubricsSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: RubricsListBody = {
    search: q.search || null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    filter_simulation_ids: q.simulationIds && q.simulationIds.length > 0 ? q.simulationIds : null,
    department_search: q.departmentSearch || null,
    simulation_search: q.simulationSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data and group in parallel
  const [listData, groupResult] = await Promise.all([
    getRubricsList(body),
    api.post("/rubric/group", { body: {} } as GroupRubricIn),
  ]);

  return (
    <FullPageLayout
      profileData={context.profile}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "rubric",
        createFeedback: createRubricProblem,
      }}
      breadcrumbs={[
        { title: "System", section: "system", url: "/system" },
        { title: "Rubrics" },
      ]}
      toolbar={<NewArtifactButton label="New Rubric" href="/system/rubrics/new" />}
      panelProps={{
        artifactType: "rubric",
        groupId: (groupResult as GroupRubricOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateRubric,
        operations: ["draft", "get", "group"],
        getGroupHistory: getRubricGroupHistory,
        searchGroups: searchRubricGroups,
        prompts: context.prompts?.prompts,
      }}
    >
      <div className="space-y-6 px-4" data-page="rubrics-index">
        <Rubrics
          listData={listData}
          duplicateRubricAction={duplicateRubric}
          deleteRubricAction={deleteRubric}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={listData.total_count ?? 0}
          departmentSearch={q.departmentSearch ?? ""}
          simulationSearch={q.simulationSearch ?? ""}
        />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteRubricIn,
  DeleteRubricOut,
  DuplicateRubricIn,
  DuplicateRubricOut,
  RubricsListOut,
};
