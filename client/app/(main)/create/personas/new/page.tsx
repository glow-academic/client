/**
 * app/(main)/create/personas/new/page.tsx
 * New persona page for the personas section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Persona from "@/components/personas/Persona";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
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
type CreateDraftDocumentsIn = InputOf<"/api/v4/resources/documents", "post">;
type CreateDraftDocumentsOut = OutputOf<"/api/v4/resources/documents", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getPersonaDefault = async (
  input: GetPersonaIn
): Promise<GetPersonaOut> => {
  return api.post("/personas/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

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

async function createDraftDocuments(
  input: CreateDraftDocumentsIn
): Promise<CreateDraftDocumentsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/documents", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Persona",
    description:
      "Create a new AI-powered student persona for teaching assistant training. Design realistic student profiles with unique personalities and learning styles to practice pedagogical techniques and improve student interaction skills through simulation-based learning.",
  };
}

export default async function NewPersonaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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

  // Inline server-side parsers for persona search params (navigation/search params only)
  const personaSearchParams = {
    draftId: parseAsString,
    // Search/filter params
    colorSearch: parseAsString,
    iconSearch: parseAsString,
    descriptionSearch: parseAsString,
    instructionsSearch: parseAsString,
    fieldSearch: parseAsString,
    colorShowSelected: parseAsBoolean,
    iconShowSelected: parseAsBoolean,
    fieldShowSelected: parseAsBoolean,
  };
  const loadPersonaSearchParams = createLoader(personaSearchParams);
  const q = loadPersonaSearchParams(searchParamsObj);

  // Fetch default persona detail server-side with filter params and draft_id
  // Note: OpenAPI schema needs regeneration to include new filter params
  const input: GetPersonaIn = {
    body: {
      persona_id: null, // NULL for new mode
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
  const personaDetailDefault = await getPersonaDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="persona-new"
      aria-label="Create new persona page"
    >
      <Persona
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        personaData={personaDetailDefault}
        savePersonaAction={savePersona}
        patchPersonaDraftAction={patchPersonaDraft}
        createNamesAction={createDraftNames}
        createDescriptionsAction={createDraftDescriptions}
        createInstructionsAction={createDraftInstructions}
        createColorsAction={createDraftColors}
        createExamplesAction={createDraftExamples}
        createDocumentsAction={createDraftDocuments}
      />
    </div>
  );
}

// Types are now defined inline in components using InputOf/OutputOf
