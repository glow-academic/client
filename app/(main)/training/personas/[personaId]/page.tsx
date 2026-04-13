/**
 * app/(main)/training/personas/[personaId]/page.tsx
 * Persona edit page for the persona page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Persona from "@/components/artifacts/persona/Persona";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import {
  createLoader,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
} from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetPersonaIn = InputOf<"/personas/get", "post">;
type GetPersonaOut = OutputOf<"/personas/get", "post">;
type UpdatePersonaIn = InputOf<"/personas/update", "post">;
type UpdatePersonaOut = OutputOf<"/personas/update", "post">;
type PatchPersonaDraftIn = InputOf<"/personas/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<"/personas/draft", "patch">;
/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getPersona = async (input: GetPersonaIn): Promise<GetPersonaOut> => {
  return api.post("/personas/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/personas/docs", "post">;
type DocsOut = OutputOf<"/personas/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/personas/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ personaId: string }>;
}): Promise<Metadata> {
  const { personaId } = await params;
  const docs = await getDocs({ body: { entity_id: personaId } });
  return { title: docs.page_metadata?.detail.title, description: docs.page_metadata?.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updatePersona(input: UpdatePersonaIn): Promise<UpdatePersonaOut> {
  "use server";
  return api.post("/personas/update", input);
}

async function patchPersonaDraft(
  input: PatchPersonaDraftIn
): Promise<PatchPersonaDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/personas/draft", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function PersonaEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ personaId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { personaId } = await params;
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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

  // Inline server-side parsers for persona search params
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

  // Fetch persona detail (always fresh - source of truth) with filter params
  // Note: OpenAPI schema may need regeneration to include new filter params
  try {
    const input: GetPersonaIn = {
      body: {
        persona_id: personaId,
        draft_id: q.draftId ?? null,
        parameter_ids: q.parameterIds ?? null,
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
        parameter_fields: q.fieldSearch || q.fieldShowSelected ? {
          search: q.fieldSearch ?? undefined,
          selected: q.fieldShowSelected ?? undefined,
        } : undefined,
      } as GetPersonaIn["body"],
    };
    const [personaDetail, docs, draftsResult] = await Promise.all([
      getPersona(input),
      getDocs({ body: { entity_id: personaId } }),
      api.post("/personas/drafts", {})
    ]);

    const entityName = docs.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <PageHeader
          breadcrumbs={[
            { title: "Training", section: "training", url: "/training" },
            { title: "Personas", section: "personas", url: "/training/personas" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
        />
        <div
          className="space-y-6 px-4"
          data-page="persona-edit"
          data-persona-id={personaId}
        >
          <Persona
            personaId={personaId}
            personaData={personaDetail}
            updatePersonaAction={updatePersona}
            patchPersonaDraftAction={patchPersonaDraft}
          />
        </div>
      </DraftProviderClient>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
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
    // Re-throw other errors
    throw error;
  }
}

// Types are now defined inline in components using InputOf/OutputOf
