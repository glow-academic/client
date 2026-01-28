/**
 * app/(main)/create/personas/p/[personaId]/page.tsx
 * Persona edit page for the persona page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Persona from "@/components/personas/Persona";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetPersonaIn = InputOf<"/api/v4/personas/get", "post">;
type GetPersonaOut = OutputOf<"/api/v4/personas/get", "post">;
type SavePersonaIn = InputOf<"/api/v4/personas/save", "post">;
type SavePersonaOut = OutputOf<"/api/v4/personas/save", "post">;
type PatchPersonaDraftIn = InputOf<"/api/v4/personas/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<"/api/v4/personas/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftInstructionsIn = InputOf<
  "/api/v4/resources/instructions",
  "post"
>;
type CreateDraftInstructionsOut = OutputOf<
  "/api/v4/resources/instructions",
  "post"
>;
type CreateDraftColorsIn = InputOf<"/api/v4/resources/colors", "post">;
type CreateDraftColorsOut = OutputOf<"/api/v4/resources/colors", "post">;
type CreateDraftExamplesIn = InputOf<"/api/v4/resources/examples", "post">;
type CreateDraftExamplesOut = OutputOf<"/api/v4/resources/examples", "post">;

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

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ personaId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { personaId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: GetPersonaIn = {
      body: {
        persona_id: personaId,
        color_search: null,
        icon_search: null,
      } as GetPersonaIn["body"],
    };
    const persona = await getPersona(input);
    return {
      title: `${persona?.name_resource?.name || "Persona"} Persona`,
      description: `${persona?.name_resource?.name ? `${persona.name_resource.name} - ` : ""}AI-powered student persona for simulation-based teaching assistant training. Practice pedagogical techniques and student interaction strategies in realistic educational scenarios.${persona?.description_resource?.description ? ` ${persona.description_resource.description}` : ""}`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Persona",
    description:
      "AI-powered student persona for simulation-based teaching assistant training. Practice pedagogical techniques and student interaction strategies in realistic educational scenarios.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function savePersona(input: SavePersonaIn): Promise<SavePersonaOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/save", input);
}

async function patchPersonaDraft(
  input: PatchPersonaDraftIn
): Promise<PatchPersonaDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/personas/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/descriptions", input);
}

async function createDraftInstructions(
  input: CreateDraftInstructionsIn
): Promise<CreateDraftInstructionsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/instructions", input);
}

async function createDraftColors(
  input: CreateDraftColorsIn
): Promise<CreateDraftColorsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/colors", input);
}

async function createDraftExamples(
  input: CreateDraftExamplesIn
): Promise<CreateDraftExamplesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/examples", input);
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
        color_search: q.colorSearch ?? null,
        icon_search: q.iconSearch ?? null,
        descriptions_search: q.descriptionSearch ?? null,
        instructions_search: q.instructionsSearch ?? null,
        field_search: q.fieldSearch ?? null,
        color_show_selected: q.colorShowSelected ?? null,
        icon_show_selected: q.iconShowSelected ?? null,
        field_show_selected: q.fieldShowSelected ?? null,
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
          savePersonaAction={savePersona}
          patchPersonaDraftAction={patchPersonaDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createInstructionsAction={createDraftInstructions}
          createColorsAction={createDraftColors}
          createExamplesAction={createDraftExamples}
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
          redirectPath="/create/personas"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

// Types are now defined inline in components using InputOf/OutputOf
