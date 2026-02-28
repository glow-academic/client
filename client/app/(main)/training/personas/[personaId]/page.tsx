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
type GetPersonaIn = InputOf<"/api/v4/artifacts/personas/get", "post">;
type GetPersonaOut = OutputOf<"/api/v4/artifacts/personas/get", "post">;
type SavePersonaIn = InputOf<"/api/v4/artifacts/personas/save", "post">;
type SavePersonaOut = OutputOf<"/api/v4/artifacts/personas/save", "post">;
type PatchPersonaDraftIn = InputOf<"/api/v4/artifacts/personas/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<"/api/v4/artifacts/personas/draft", "patch">;
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
type CreateDraftParameterFieldsIn = InputOf<
  "/api/v4/resources/parameter_fields",
  "post"
>;
type CreateDraftParameterFieldsOut = OutputOf<
  "/api/v4/resources/parameter_fields",
  "post"
>;
type CreateDraftVoicesIn = InputOf<"/api/v4/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v4/resources/voices", "post">;
type LinkNamesIn = InputOf<"/api/v4/resources/names/link", "post">;
type LinkNamesOut = OutputOf<"/api/v4/resources/names/link", "post">;
type LinkDescriptionsIn = InputOf<"/api/v4/resources/descriptions/link", "post">;
type LinkDescriptionsOut = OutputOf<"/api/v4/resources/descriptions/link", "post">;
type LinkColorsIn = InputOf<"/api/v4/resources/colors/link", "post">;
type LinkColorsOut = OutputOf<"/api/v4/resources/colors/link", "post">;
type LinkIconsIn = InputOf<"/api/v4/resources/icons/link", "post">;
type LinkIconsOut = OutputOf<"/api/v4/resources/icons/link", "post">;
type LinkInstructionsIn = InputOf<"/api/v4/resources/instructions/link", "post">;
type LinkInstructionsOut = OutputOf<"/api/v4/resources/instructions/link", "post">;
type LinkFlagsIn = InputOf<"/api/v4/resources/flags/link", "post">;
type LinkFlagsOut = OutputOf<"/api/v4/resources/flags/link", "post">;
type LinkDepartmentsIn = InputOf<"/api/v4/resources/departments/link", "post">;
type LinkDepartmentsOut = OutputOf<"/api/v4/resources/departments/link", "post">;
type LinkExamplesIn = InputOf<"/api/v4/resources/examples/link", "post">;
type LinkExamplesOut = OutputOf<"/api/v4/resources/examples/link", "post">;
type LinkParameterFieldsIn = InputOf<"/api/v4/resources/parameter_fields/link", "post">;
type LinkParameterFieldsOut = OutputOf<"/api/v4/resources/parameter_fields/link", "post">;
type LinkVoicesIn = InputOf<"/api/v4/resources/voices/link", "post">;
type LinkVoicesOut = OutputOf<"/api/v4/resources/voices/link", "post">;

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
type DocsIn = InputOf<"/api/v4/artifacts/personas/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/personas/docs", "post">;

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
async function savePersona(input: SavePersonaIn): Promise<SavePersonaOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/personas/save", input);
}

async function patchPersonaDraft(
  input: PatchPersonaDraftIn
): Promise<PatchPersonaDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/personas/draft", input);
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

async function createDraftParameterFields(
  input: CreateDraftParameterFieldsIn
): Promise<CreateDraftParameterFieldsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/parameter_fields", input);
}

async function createDraftVoices(
  input: CreateDraftVoicesIn
): Promise<CreateDraftVoicesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/voices", input);
}

async function linkName(input: LinkNamesIn): Promise<LinkNamesOut> {
  "use server";
  return api.post("/resources/names/link", input);
}

async function linkDescription(input: LinkDescriptionsIn): Promise<LinkDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions/link", input);
}

async function linkColor(input: LinkColorsIn): Promise<LinkColorsOut> {
  "use server";
  return api.post("/resources/colors/link", input);
}

async function linkIcon(input: LinkIconsIn): Promise<LinkIconsOut> {
  "use server";
  return api.post("/resources/icons/link", input);
}

async function linkInstruction(input: LinkInstructionsIn): Promise<LinkInstructionsOut> {
  "use server";
  return api.post("/resources/instructions/link", input);
}

async function linkFlag(input: LinkFlagsIn): Promise<LinkFlagsOut> {
  "use server";
  return api.post("/resources/flags/link", input);
}

async function linkDepartment(
  input: LinkDepartmentsIn
): Promise<LinkDepartmentsOut> {
  "use server";
  return api.post("/resources/departments/link", input);
}

async function linkExample(input: LinkExamplesIn): Promise<LinkExamplesOut> {
  "use server";
  return api.post("/resources/examples/link", input);
}

async function linkParameterField(input: LinkParameterFieldsIn): Promise<LinkParameterFieldsOut> {
  "use server";
  return api.post("/resources/parameter_fields/link", input);
}

async function linkVoice(input: LinkVoicesIn): Promise<LinkVoicesOut> {
  "use server";
  return api.post("/resources/voices/link", input);
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
  const groupId = await resolveGroupId(q.draftId ?? null, "persona");

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
          savePersonaAction={savePersona}
          patchPersonaDraftAction={patchPersonaDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createInstructionsAction={createDraftInstructions}
          createColorsAction={createDraftColors}
          createExamplesAction={createDraftExamples}
          createParameterFieldsAction={createDraftParameterFields}
          createVoicesAction={createDraftVoices}
          linkNameAction={linkName}
          linkDescriptionAction={linkDescription}
          linkColorAction={linkColor}
          linkIconAction={linkIcon}
          linkInstructionAction={linkInstruction}
          linkFlagAction={linkFlag}
          linkDepartmentAction={linkDepartment}
          linkExampleAction={linkExample}
          linkParameterFieldAction={linkParameterField}
          linkVoiceAction={linkVoice}
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
