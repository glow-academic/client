/**
 * app/(main)/training/personas/page.tsx
 * Persona list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import Personas from "@/components/artifacts/persona/Personas";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { loadPersonasSearchParams } from "@/lib/search-params/personas";
import type { ParseCsvResult } from "@/components/common/BulkImport";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type PersonasListOut = OutputOf<"/persona/search", "post">;
type DuplicatePersonaIn = InputOf<"/persona/duplicate", "post">;
type DuplicatePersonaOut = OutputOf<"/persona/duplicate", "post">;
type DeletePersonaIn = InputOf<"/persona/delete", "post">;
type DeletePersonaOut = OutputOf<"/persona/delete", "post">;
type CreatePersonaIn = InputOf<"/persona/create", "post">;
type CreatePersonaOut = OutputOf<"/persona/create", "post">;
type UpdatePersonaIn = InputOf<"/persona/update", "post">;
type UpdatePersonaOut = OutputOf<"/persona/update", "post">;
type GroupPersonaIn = InputOf<"/persona/group", "post">;
type GroupPersonaOut = OutputOf<"/persona/group", "post">;
type GenerationsIn = InputOf<"/persona/generations", "post">;
type GenerationsOut = OutputOf<"/persona/generations", "post">;
type ProblemPersonaIn = InputOf<"/persona/problem", "post">;
type ProblemPersonaOut = OutputOf<"/persona/problem", "post">;
type ContextIn = InputOf<"/persona/context", "post">;
type ContextOut = OutputOf<"/persona/context", "post">;

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
    "/persona/search",
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
  return api.post("/persona/duplicate", input);
}

async function deletePersona(
  input: DeletePersonaIn
): Promise<DeletePersonaOut> {
  "use server";
  return api.post("/persona/delete", input);
}

async function createPersona(input: CreatePersonaIn): Promise<CreatePersonaOut> {
  "use server";
  return api.post("/persona/create", input);
}

async function updatePersona(input: UpdatePersonaIn): Promise<UpdatePersonaOut> {
  "use server";
  return api.post("/persona/update", input);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/persona/csv", { formData });
}

// Cast through ``unknown`` — openapi.json was generated against the
// pre-2.15.34 export shape (inline ``content``). The deployed server
// returns ``{file_id, file_name, row_count}`` per the file-modality
// refactor. The codegen will catch up on the next bump.
async function exportPersonas(): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/persona/export", {
    body: {},
  } as unknown as InputOf<"/persona/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshPersonas(): Promise<unknown> {
  "use server";
  return api.post("/persona/refresh", {
    body: {},
  } as unknown as InputOf<"/persona/refresh", "post">);
}

async function createPersonaProblem(input: ProblemPersonaIn): Promise<ProblemPersonaOut> {
  "use server";
  return api.post("/persona/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getPersonaGroup(input: GroupPersonaIn): Promise<GroupPersonaOut> {
  "use server";
  return api.post("/persona/group", input);
}

async function searchPersonaGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/persona/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getPersonaContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/persona/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getPersonaContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Personas" };
  }
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

  try {
    // Profile data for providers
    const context = await getPersonaContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/training/personas", context.profile.role_permissions);

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
      api.post(
        "/persona/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupPersonaIn,
      ),
    ]);

    return (
      <FullPageLayout
        profileData={context.profile}
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
        toolbar={
          <ArtifactToolbarActions
            newButton={{ label: "New Persona", href: "/training/personas/new" }}
            exportAction={exportPersonas}
            refreshAction={refreshPersonas}
            bffDownloadPrefix="/api/persona/download"
          />
        }
        panelProps={{
          artifactType: "persona",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupPersonaOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupPersonaOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          // Cross-persona toolset for the list view: the LLM can find,
          // edit, duplicate, delete, and bulk-export, in addition to
          // the draft lifecycle. Each operation is independently gated
          // by tool registration on the server, so this is an
          // upper-bound "allowed list" — any operation without a
          // registered tool simply isn't picked by the LLM.
          operations: [
            "search", "get", "duplicate", "update", "delete",
            "draft", "drafts", "create", "csv", "export", "title",
          ],
          prompts: context.prompts?.prompts,
          getGroupAction: getPersonaGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchPersonaGenerations as PanelProps["searchGenerationsAction"],
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
            currentSearchBody={body}
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
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error
    ) {
      // 401 → not logged in. 403 → resource belongs to a department the
      // user isn't in. Don't conflate.
      if (error.status === 401) {
        return (
          <UnifiedAccessDenied
            reason="not-logged-in"
            pathname="/training/personas"
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="persona"
            redirectPath="/training/personas"
          />
        );
      }
    }
    throw error;
  }
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
  PersonasListBody,
};
