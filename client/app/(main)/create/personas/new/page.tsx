/**
 * app/(main)/create/personas/new/page.tsx
 * New persona page for the personas section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import PersonaNew from "@/components/personas/PersonaNew";
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
type CreateDraftIconsIn = InputOf<"/api/v4/resources/icons", "post">;
type CreateDraftIconsOut = OutputOf<"/api/v4/resources/icons", "post">;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFieldsIn = InputOf<"/api/v4/resources/fields", "post">;
type CreateDraftFieldsOut = OutputOf<"/api/v4/resources/fields", "post">;
type CreateDraftDocumentsIn = InputOf<"/api/v4/resources/documents", "post">;
type CreateDraftDocumentsOut = OutputOf<"/api/v4/resources/documents", "post">;
type CreateDraftDepartmentsIn = InputOf<"/api/v4/resources/departments", "post">;
type CreateDraftDepartmentsOut = OutputOf<"/api/v4/resources/departments", "post">;

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

async function createDraftIcons(
  input: CreateDraftIconsIn
): Promise<CreateDraftIconsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/icons", input);
}

async function createDraftFlags(
  input: CreateDraftFlagsIn
): Promise<CreateDraftFlagsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/flags", input);
}

async function createDraftFields(
  input: CreateDraftFieldsIn
): Promise<CreateDraftFieldsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/fields", input);
}

async function createDraftDocuments(
  input: CreateDraftDocumentsIn
): Promise<CreateDraftDocumentsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/documents", input);
}

async function createDraftDepartments(
  input: CreateDraftDepartmentsIn
): Promise<CreateDraftDepartmentsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/departments", input);
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
    color: parseAsString,
    icon: parseAsString,
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
      current_color: q.color ?? null,
      current_icon: q.icon ?? null,
    } as GetPersonaIn["body"],
  };
  const personaDetailDefault = await getPersonaDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="persona-new"
      aria-label="Create new persona page"
    >
      <PersonaNew
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        personaData={personaDetailDefault}
        savePersonaAction={savePersona}
        patchPersonaDraftAction={patchPersonaDraft}
        createNamesAction={createDraftNames}
        createDescriptionsAction={createDraftDescriptions}
        createInstructionsAction={createDraftInstructions}
        createColorsAction={createDraftColors}
        createIconsAction={createDraftIcons}
        createFlagsAction={createDraftFlags}
        createFieldsAction={createDraftFields}
        createDocumentsAction={createDraftDocuments}
        createDepartmentsAction={createDraftDepartments}
      />
    </div>
  );
}

// Types are now defined inline in components using InputOf/OutputOf
