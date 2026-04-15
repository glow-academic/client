/**
 * app/(main)/training/cohorts/page.tsx
 * Cohorts list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Cohorts from "@/components/artifacts/cohort/Cohorts";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { loadCohortsListSearchParams } from "@/lib/search-params/cohorts";
import type { ParseCsvResult } from "@/components/common/BulkImport";

/** ---- Strong types from OpenAPI ---- */
type CohortsListOut = OutputOf<"/cohort/search", "post">;
type DuplicateCohortIn = InputOf<"/cohort/duplicate", "post">;
type DuplicateCohortOut = OutputOf<"/cohort/duplicate", "post">;
type DeleteCohortIn = InputOf<"/cohort/delete", "post">;
type DeleteCohortOut = OutputOf<"/cohort/delete", "post">;
type CreateCohortIn = InputOf<"/cohort/create", "post">;
type CreateCohortOut = OutputOf<"/cohort/create", "post">;
type UpdateCohortIn = InputOf<"/cohort/update", "post">;
type UpdateCohortOut = OutputOf<"/cohort/update", "post">;
type GroupCohortIn = InputOf<"/cohort/group", "post">;
type GroupCohortOut = OutputOf<"/cohort/group", "post">;
type GenerateCohortIn = InputOf<"/cohort/generate", "post">;
type GenerateCohortOut = OutputOf<"/cohort/generate", "post">;
type GenerationsIn = InputOf<"/cohort/generations", "post">;
type GenerationsOut = OutputOf<"/cohort/generations", "post">;
type ProblemCohortIn = InputOf<"/cohort/problem", "post">;
type ProblemCohortOut = OutputOf<"/cohort/problem", "post">;
type ContextIn = InputOf<"/cohort/context", "post">;
type ContextOut = OutputOf<"/cohort/context", "post">;

/** ---- Body type for cohorts list request ---- */
type CohortsListBody = {
  search?: string | null;
  filter_simulation_ids?: string[] | null;
  filter_profile_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  simulation_search?: string | null;
  profile_search?: string | null;
  department_search?: string | null;
  flag_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getCohortsList = async (body: CohortsListBody): Promise<CohortsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/cohort/search",
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
async function duplicateCohort(
  input: DuplicateCohortIn,
): Promise<DuplicateCohortOut> {
  "use server";
  return api.post("/cohort/duplicate", input);
}

async function deleteCohort(input: DeleteCohortIn): Promise<DeleteCohortOut> {
  "use server";
  return api.post("/cohort/delete", input);
}

async function createCohort(input: CreateCohortIn): Promise<CreateCohortOut> {
  "use server";
  return api.post("/cohort/create", input);
}

async function updateCohort(input: UpdateCohortIn): Promise<UpdateCohortOut> {
  "use server";
  return api.post("/cohort/update", input);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/cohort/csv", { formData });
}

async function generateCohort(
  input: GenerateCohortIn
): Promise<GenerateCohortOut> {
  "use server";
  return api.post("/cohort/generate", input);
}

async function getCohortGroupHistory(groupId: string): Promise<GroupCohortOut> {
  "use server";
  return api.post("/cohort/group", { body: { group_id: groupId } } as GroupCohortIn);
}

async function searchCohortGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/cohort/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createCohortProblem(input: ProblemCohortIn): Promise<ProblemCohortOut> {
  "use server";
  return api.post("/cohort/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/cohort/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface CohortsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CohortsPage({ searchParams }: CohortsPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/cohort/context", { body: {} } as ContextIn) as ContextOut;
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

  const q = loadCohortsListSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: CohortsListBody = {
    search: q.search || null,
    filter_simulation_ids: q.simulationIds && q.simulationIds.length > 0 ? q.simulationIds : null,
    filter_profile_ids: q.profileIds && q.profileIds.length > 0 ? q.profileIds : null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    simulation_search: q.simulationSearch || null,
    profile_search: q.profileSearch || null,
    department_search: q.departmentSearch || null,
    flag_search: q.flagSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data, view cookie, and group in parallel
  const [listData, initialColumnVisibility, groupResult] = await Promise.all([
    getCohortsList(body),
    readViewCookie("cohorts"),
    api.post("/cohort/group", { body: {} } as GroupCohortIn),
  ]);

  return (
    <FullPageLayout
      profileData={context.profile}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "cohort",
        createFeedback: createCohortProblem,
      }}
      breadcrumbs={[
        { title: "Training", section: "training", url: "/training" },
        { title: "Cohorts" },
      ]}
      toolbar={<NewArtifactButton label="New Cohort" href="/training/cohorts/new" />}
      panelProps={{
        artifactType: "cohort",
        groupId: (groupResult as GroupCohortOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateCohort,
        operations: ["draft", "get", "group"],
        getGroupHistory: getCohortGroupHistory,
        searchGroups: searchCohortGroups,
        prompts: context.prompts?.prompts,
      }}
    >
      <div className="space-y-6 px-4" data-page="cohorts-index">
        <Cohorts
          listData={listData}
          initialColumnVisibility={initialColumnVisibility}
          duplicateCohortAction={duplicateCohort}
          deleteCohortAction={deleteCohort}
          createCohortAction={createCohort}
          updateCohortAction={updateCohort}
          parseCsvAction={parseCsv}
          importFields={listData.import_fields as import("@/components/common/BulkImport").ImportFieldDef[] | undefined}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={listData.total_count ?? 0}
          simulationSearch={q.simulationSearch ?? ""}
          profileSearch={q.profileSearch ?? ""}
          departmentSearch={q.departmentSearch ?? ""}
          flagSearch={q.flagSearch ?? ""}
        />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CohortsListOut,
  DeleteCohortIn,
  DeleteCohortOut,
  DuplicateCohortIn,
  DuplicateCohortOut,
  CreateCohortIn,
  CreateCohortOut,
  UpdateCohortIn,
  UpdateCohortOut,
};
