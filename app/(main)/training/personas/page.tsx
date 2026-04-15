/**
 * app/(main)/training/personas/page.tsx
 * Persona list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Personas from "@/components/artifacts/persona/Personas";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getLayoutContextData } from "@/app/(main)/layout-server";
import { loadPersonasSearchParams } from "@/lib/search-params/personas";
import type { ParseCsvResult } from "@/components/common/BulkImport";

/** ---- Strong types from OpenAPI ---- */
type PersonasListOut = OutputOf<"/personas/search", "post">;
type DuplicatePersonaIn = InputOf<"/personas/duplicate", "post">;
type DuplicatePersonaOut = OutputOf<"/personas/duplicate", "post">;
type DeletePersonaIn = InputOf<"/personas/delete", "post">;
type DeletePersonaOut = OutputOf<"/personas/delete", "post">;
type CreatePersonaIn = InputOf<"/personas/create", "post">;
type CreatePersonaOut = OutputOf<"/personas/create", "post">;
type UpdatePersonaIn = InputOf<"/personas/update", "post">;
type UpdatePersonaOut = OutputOf<"/personas/update", "post">;
type GroupPersonaIn = InputOf<"/personas/group", "post">;
type GroupPersonaOut = OutputOf<"/personas/group", "post">;
type GeneratePersonaIn = InputOf<"/personas/generate", "post">;
type GeneratePersonaOut = OutputOf<"/personas/generate", "post">;
type GenerationsIn = InputOf<"/personas/generations", "post">;
type GenerationsOut = OutputOf<"/personas/generations", "post">;
type ProblemPersonaIn = InputOf<"/personas/problem", "post">;
type ProblemPersonaOut = OutputOf<"/personas/problem", "post">;
type ContextIn = InputOf<"/personas/context", "post">;
type ContextOut = OutputOf<"/personas/context", "post">;

/** ---- Body type for personas list request ---- */
type PersonasListBody = {
  search?: string | null;
  scenario_ids?: string[] | null;
  field_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  scenario_search?: string | null;
  field_search?: string | null;
  department_search?: string | null;
  color_search?: string | null;
  icon_search?: string | null;
  voice_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ---- */
const getPersonasList = async (body: PersonasListBody): Promise<PersonasListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/personas/search",
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
async function duplicatePersona(
  input: DuplicatePersonaIn
): Promise<DuplicatePersonaOut> {
  "use server";
  return api.post("/personas/duplicate", input);
}

async function deletePersona(
  input: DeletePersonaIn
): Promise<DeletePersonaOut> {
  "use server";
  return api.post("/personas/delete", input);
}

async function createPersona(input: CreatePersonaIn): Promise<CreatePersonaOut> {
  "use server";
  return api.post("/personas/create", input);
}

async function updatePersona(input: UpdatePersonaIn): Promise<UpdatePersonaOut> {
  "use server";
  return api.post("/personas/update", input);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/personas/csv", { formData });
}

async function generatePersona(
  input: GeneratePersonaIn
): Promise<GeneratePersonaOut> {
  "use server";
  return api.post("/personas/generate", input);
}

async function getPersonaGroupHistory(groupId: string): Promise<GroupPersonaOut> {
  "use server";
  return api.post("/personas/group", { body: { group_id: groupId } } as GroupPersonaIn);
}

async function searchPersonaGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/personas/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createPersonaProblem(input: ProblemPersonaIn): Promise<ProblemPersonaOut> {
  "use server";
  return api.post("/personas/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/personas/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface PersonasPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PersonasPage({ searchParams }: PersonasPageProps) {
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

  const q = loadPersonasSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: PersonasListBody = {
    search: q.search || null,
    scenario_ids: q.scenarioIds && q.scenarioIds.length > 0 ? q.scenarioIds : null,
    field_ids: q.fieldIds && q.fieldIds.length > 0 ? q.fieldIds : null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    scenario_search: q.scenarioSearch || null,
    field_search: q.fieldSearch || null,
    department_search: q.departmentSearch || null,
    color_search: q.colorSearch || null,
    icon_search: q.iconSearch || null,
    voice_search: q.voiceSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data, view cookie, and group in parallel
  const [listData, initialColumnVisibility, groupResult] = await Promise.all([
    getPersonasList(body),
    readViewCookie("personas"),
    api.post("/personas/group", { body: {} } as GroupPersonaIn),
  ]);

  return (
    <FullPageLayout
      profileData={profileData}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "persona",
        createFeedback: createPersonaProblem,
      }}
      breadcrumbs={[
        { title: "Training", section: "training", url: "/training" },
        { title: "Personas" },
      ]}
      toolbar={<NewArtifactButton label="New Persona" href="/training/personas/new" />}
      panelProps={{
        artifactType: "persona",
        groupId: (groupResult as GroupPersonaOut & { group_id?: string })?.group_id ?? null,
        generateAction: generatePersona,
        permissions: [
          { artifact: "persona", operation: "draft" },
          { artifact: "persona", operation: "get" },
          { artifact: "persona", operation: "docs" },
          { artifact: "persona", operation: "group" },
        ],
        getGroupHistory: getPersonaGroupHistory,
        searchGroups: searchPersonaGroups,
      }}
    >
      <div className="space-y-6 px-4" data-page="personas-index">
        <Personas
          listData={listData}
          initialColumnVisibility={initialColumnVisibility}
          duplicatePersonaAction={duplicatePersona}
          deletePersonaAction={deletePersona}
          createPersonaAction={createPersona}
          updatePersonaAction={updatePersona}
          parseCsvAction={parseCsv}
          importFields={listData.import_fields ?? undefined}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={listData.total_count ?? 0}
          scenarioSearch={q.scenarioSearch ?? ""}
          fieldSearch={q.fieldSearch ?? ""}
          departmentSearch={q.departmentSearch ?? ""}
          colorSearch={q.colorSearch ?? ""}
          iconSearch={q.iconSearch ?? ""}
          voiceSearch={q.voiceSearch ?? ""}
        />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeletePersonaIn,
  DeletePersonaOut,
  DuplicatePersonaIn,
  DuplicatePersonaOut,
  PersonasListOut,
  CreatePersonaIn,
  CreatePersonaOut,
  UpdatePersonaIn,
  UpdatePersonaOut,
};
