/**
 * app/(main)/training/personas/[personaId]/page.tsx
 * Persona edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Persona from "@/components/artifacts/persona/Persona";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  createLoader,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
} from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetPersonaIn = InputOf<"/persona/get", "post">;
type GetPersonaOut = OutputOf<"/persona/get", "post">;
type UpdatePersonaIn = InputOf<"/persona/update", "post">;
type UpdatePersonaOut = OutputOf<"/persona/update", "post">;
type PatchPersonaDraftIn = InputOf<"/persona/draft", "post">;
type PatchPersonaDraftOut = OutputOf<"/persona/draft", "post">;
type GroupPersonaIn = InputOf<"/persona/group", "post">;
type GroupPersonaOut = OutputOf<"/persona/group", "post">;
type GenerationsIn = InputOf<"/persona/generations", "post">;
type GenerationsOut = OutputOf<"/persona/generations", "post">;
type ProblemPersonaIn = InputOf<"/persona/problem", "post">;
type ProblemPersonaOut = OutputOf<"/persona/problem", "post">;
type ContextIn = InputOf<"/persona/context", "post">;
type ContextOut = OutputOf<"/persona/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getPersona = async (input: GetPersonaIn): Promise<GetPersonaOut> => {
  return api.post("/persona/get", input, {
    cache: "no-store",
    headers: { "X-Bypass-Cache": "1" },
  });
};

/** ---- Strongly-typed server actions ---- */
async function updatePersona(input: UpdatePersonaIn): Promise<UpdatePersonaOut> {
  "use server";
  return api.post("/persona/update", input);
}

async function patchPersonaDraft(
  input: PatchPersonaDraftIn
): Promise<PatchPersonaDraftOut> {
  "use server";
  return api.post("/persona/draft", input);
}

async function createPersonaProblem(input: ProblemPersonaIn): Promise<ProblemPersonaOut> {
  "use server";
  return api.post("/persona/problem", input);
}

/** Per-item export — scopes to a single ``persona_id`` so the AI
 *  consumer downstream only sees the row the user is editing.
 *  Cast through ``unknown`` while openapi.json catches up to the
 *  file-modality response shape.
 */
async function exportPersonaById(personaId: string): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/persona/export", {
    body: { persona_id: personaId },
  } as unknown as InputOf<"/persona/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshPersona(): Promise<unknown> {
  "use server";
  return api.post("/persona/refresh", {
    body: {},
  } as unknown as InputOf<"/persona/refresh", "post">);
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
const getPersonaContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/persona/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ personaId: string }>;
}): Promise<Metadata> {
  try {
    const { personaId } = await params;
    const context = await getPersonaContextById(personaId);
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Personas" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function PersonaEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ personaId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { personaId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Parse search params using nuqs
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  const personaSearchParams = {
    draftId: parseAsString,
    colorSearch: parseAsString,
    iconSearch: parseAsString,
    descriptionSearch: parseAsString,
    instructionsSearch: parseAsString,
    fieldSearch: parseAsString,
    colorShowSelected: parseAsBoolean,
    iconShowSelected: parseAsBoolean,
    fieldShowSelected: parseAsBoolean,
    color: parseAsString,
    icon: parseAsString,
    parameterIds: parseAsArrayOf(parseAsString),
    groupId: parseAsString,
    groupSearch: parseAsString,
  };
  const loadPersonaSearchParams = createLoader(personaSearchParams);
  const q = loadPersonaSearchParams(searchParamsObj);

  try {
    const input: GetPersonaIn = {
      body: {
        id: personaId,
        draft_id: q.draftId ?? null,
        colors: q.colorSearch || q.colorShowSelected ? {
          search: q.colorSearch ?? undefined,
          selected: q.colorShowSelected ?? undefined,
        } : undefined,
        icons: q.iconSearch || q.iconShowSelected ? {
          search: q.iconSearch ?? undefined,
          selected: q.iconShowSelected ?? undefined,
        } : undefined,
        descriptions: q.descriptionSearch ? {
          search: q.descriptionSearch,
        } : undefined,
        instructions: q.instructionsSearch ? {
          search: q.instructionsSearch,
        } : undefined,
        parameter_fields: q.fieldSearch || q.fieldShowSelected || q.parameterIds ? {
          search: q.fieldSearch ?? undefined,
          selected: q.fieldShowSelected ?? undefined,
          parameter_ids: q.parameterIds ?? undefined,
        } : undefined,
      } as GetPersonaIn["body"],
    };

    const [personaDetail, context, draftsResult, groupResult] = await Promise.all([
      getPersona(input),
      getPersonaContextById(personaId) as Promise<ContextOut>,
      api.post("/persona/drafts", { body: { page_limit: 50, page_offset: 0 } }),
      api.post(
        "/persona/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupPersonaIn,
      ),
    ]);

    const entityName = context.page_metadata?.detail.title;
    const snapshot = buildSnapshot(session, context.profile);

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
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
            { title: "Personas", section: "personas", url: "/training/personas" },
            { title: entityName },
          ]}
          toolbar={
            <ArtifactToolbarActions
              leftSlot={<SaveToolbar />}
              exportAction={exportPersonaById.bind(null, personaId)}
              refreshAction={refreshPersona}
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
            // skips the duplicate client-side /persona/group refetch
            // on first paint, eliminating the hydration flicker.
            initialGroupHistory: groupResult as Record<string, unknown>,
            operations: ["draft", "get", "title"],
            prompts: context.prompts?.prompts,
            getGroupAction: getPersonaGroup as PanelProps["getGroupAction"],
            searchGenerationsAction:
              searchPersonaGenerations as PanelProps["searchGenerationsAction"],
          }}
        >
          <div
            className="space-y-6 px-4"
            data-page="persona-edit"
            data-persona-id={personaId}
          >
            <Persona
              personaId={personaId}
              groupId={(groupResult as GroupPersonaOut & { group_id?: string })?.group_id ?? null}
              personaData={personaDetail}
              updatePersonaAction={updatePersona}
              patchPersonaDraftAction={patchPersonaDraft}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error
    ) {
      // 401 → not logged in (matches /home, /practice). 403 → resource
      // belongs to a department the user isn't in. Don't conflate.
      if (error.status === 401) {
        return (
          <UnifiedAccessDenied
            reason="not-logged-in"
            pathname={`/training/personas/${personaId}`}
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
