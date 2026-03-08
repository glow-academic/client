/**
 * app/(main)/training/personas/[personaId]/page.tsx
 * Persona edit page for the persona page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Persona from "@/components/artifacts/persona/Persona";
import { resolveGroupId } from "@/app/(main)/layout-server";
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
type GetPersonaIn = InputOf<"/api/v5/artifacts/personas/get", "post">;
type GetPersonaOut = OutputOf<"/api/v5/artifacts/personas/get", "post">;
type UpdatePersonaIn = InputOf<"/api/v5/artifacts/personas/update", "post">;
type UpdatePersonaOut = OutputOf<"/api/v5/artifacts/personas/update", "post">;
type PatchPersonaDraftIn = InputOf<"/api/v5/artifacts/personas/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<"/api/v5/artifacts/personas/draft", "patch">;
/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getPersona = async (input: GetPersonaIn): Promise<GetPersonaOut> => {
  return api.post("/artifacts/personas/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/personas/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/personas/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/personas/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ personaId: string }>;
}): Promise<Metadata> {
  const { personaId } = await params;
  const docs = await getDocs({ body: { entity_id: personaId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updatePersona(input: UpdatePersonaIn): Promise<UpdatePersonaOut> {
  "use server";
  return api.post("/artifacts/personas/update", input);
}

async function patchPersonaDraft(
  input: PatchPersonaDraftIn
): Promise<PatchPersonaDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/personas/draft", input);
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

  // Resolve group_id from layout context (cached per request)
  const groupId = (await resolveGroupId({ draft_id: q.draftId ?? null, artifact_type: "persona" })).group_id;

  // Fetch persona detail (always fresh - source of truth) with filter params
  // Note: OpenAPI schema may need regeneration to include new filter params
  try {
    const input: GetPersonaIn = {
      body: {
        persona_id: personaId,
        draft_id: q.draftId ?? null,
        group_id: groupId,
        color_search: q.colorSearch ?? null,
        icon_search: q.iconSearch ?? null,
        descriptions_search: q.descriptionSearch ?? null,
        instructions_search: q.instructionsSearch ?? null,
        field_search: q.fieldSearch ?? null,
        color_show_selected: q.colorShowSelected ?? null,
        icon_show_selected: q.iconShowSelected ?? null,
        field_show_selected: q.fieldShowSelected ?? null,
        parameter_ids: q.parameterIds ?? null,
      } as GetPersonaIn["body"],
    };
    const personaDetail = await getPersona(input);

    return (
      <div
        className="space-y-6"
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
