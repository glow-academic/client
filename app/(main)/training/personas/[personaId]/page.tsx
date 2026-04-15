/**
 * app/(main)/training/personas/[personaId]/page.tsx
 * Persona edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
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

/** ---- Strong types from OpenAPI ---- */
type GetPersonaIn = InputOf<"/personas/get", "post">;
type GetPersonaOut = OutputOf<"/personas/get", "post">;
type UpdatePersonaIn = InputOf<"/personas/update", "post">;
type UpdatePersonaOut = OutputOf<"/personas/update", "post">;
type PatchPersonaDraftIn = InputOf<"/personas/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<"/personas/draft", "patch">;
type GroupPersonaIn = InputOf<"/personas/group", "post">;
type GroupPersonaOut = OutputOf<"/personas/group", "post">;
type ProblemPersonaIn = InputOf<"/personas/problem", "post">;
type ProblemPersonaOut = OutputOf<"/personas/problem", "post">;
type ContextIn = InputOf<"/personas/context", "post">;
type ContextOut = OutputOf<"/personas/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getPersona = async (input: GetPersonaIn): Promise<GetPersonaOut> => {
  return api.post("/personas/get", input, {
    cache: "no-store",
    headers: { "X-Bypass-Cache": "1" },
  });
};

/** ---- Strongly-typed server actions ---- */
async function updatePersona(input: UpdatePersonaIn): Promise<UpdatePersonaOut> {
  "use server";
  return api.post("/personas/update", input);
}

async function patchPersonaDraft(
  input: PatchPersonaDraftIn
): Promise<PatchPersonaDraftOut> {
  "use server";
  return api.post("/personas/draft", input);
}

async function createPersonaProblem(input: ProblemPersonaIn): Promise<ProblemPersonaOut> {
  "use server";
  return api.post("/personas/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ personaId: string }>;
}): Promise<Metadata> {
  const { personaId } = await params;
  const context = await api.post("/personas/context", { body: { entity_id: personaId } } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.detail.title,
    description: context.page_metadata?.detail.description,
  };
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

  // Profile data for providers
  const context = await api.post("/personas/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

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
      api.post("/personas/context", { body: { entity_id: personaId } } as ContextIn) as Promise<ContextOut>,
      api.post("/personas/drafts", {}),
      api.post("/personas/group", { body: {} } as GroupPersonaIn),
    ]);

    const entityName = context.page_metadata?.detail.title;

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
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "persona",
            groupId: (groupResult as GroupPersonaOut & { group_id?: string })?.group_id ?? null,
            permissions: [
              { artifact: "persona", operation: "draft" },
              { artifact: "persona", operation: "get" },
              { artifact: "persona", operation: "docs" },
              { artifact: "persona", operation: "group" },
            ],
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
      "status" in error &&
      error.status === 403
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="persona"
          redirectPath="/training/personas"
        />
      );
    }
    throw error;
  }
}
