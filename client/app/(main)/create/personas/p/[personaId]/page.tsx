/**
 * app/(main)/create/personas/p/[personaId]/page.tsx
 * Persona edit page for the persona page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import PersonaNew from "@/components/personas/PersonaNew";
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
type CreateDraftNamesIn = InputOf<"/api/v4/drafts/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/drafts/names", "post">;
type CreateDraftDescriptionsIn = InputOf<"/api/v4/drafts/descriptions", "post">;
type CreateDraftDescriptionsOut = OutputOf<"/api/v4/drafts/descriptions", "post">;
type CreateDraftInstructionsIn = InputOf<"/api/v4/drafts/instructions", "post">;
type CreateDraftInstructionsOut = OutputOf<"/api/v4/drafts/instructions", "post">;
type CreateDraftColorsIn = InputOf<"/api/v4/drafts/colors", "post">;
type CreateDraftColorsOut = OutputOf<"/api/v4/drafts/colors", "post">;
type CreateDraftIconsIn = InputOf<"/api/v4/drafts/icons", "post">;
type CreateDraftIconsOut = OutputOf<"/api/v4/drafts/icons", "post">;
type CreateDraftFlagsIn = InputOf<"/api/v4/drafts/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/drafts/flags", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getPersona = async (
  input: GetPersonaIn
): Promise<GetPersonaOut> => {
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
      title: `${persona?.name || "Persona"} Persona`,
      description: `${persona?.name ? `${persona.name} - ` : ""}AI-powered student persona for simulation-based teaching assistant training. Practice pedagogical techniques and student interaction strategies in realistic educational scenarios.${persona?.description ? ` ${persona.description}` : ""}`,
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
async function savePersona(
  input: SavePersonaIn
): Promise<SavePersonaOut> {
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
  return api.post("/drafts/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/drafts/descriptions", input);
}

async function createDraftInstructions(
  input: CreateDraftInstructionsIn
): Promise<CreateDraftInstructionsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/drafts/instructions", input);
}

async function createDraftColors(
  input: CreateDraftColorsIn
): Promise<CreateDraftColorsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/drafts/colors", input);
}

async function createDraftIcons(
  input: CreateDraftIconsIn
): Promise<CreateDraftIconsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/drafts/icons", input);
}

async function createDraftFlags(
  input: CreateDraftFlagsIn
): Promise<CreateDraftFlagsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/drafts/flags", input);
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
    colorShowSelected: parseAsBoolean,
    iconShowSelected: parseAsBoolean,
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
        color_show_selected: q.colorShowSelected ?? null,
        icon_show_selected: q.iconShowSelected ?? null,
        current_color: q.color ?? null,
        current_icon: q.icon ?? null,
      } as GetPersonaIn["body"],
    };
    const personaDetail = await getPersona(input);

    return (
      <div
        className="space-y-6"
        data-page="persona-edit"
        data-persona-id={personaId}
      >
        <PersonaNew
          personaId={personaId}
          mode="edit"
          personaDetail={personaDetail}
          savePersonaAction={savePersona}
          patchPersonaDraftAction={patchPersonaDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createInstructionsAction={createDraftInstructions}
          createColorsAction={createDraftColors}
          createIconsAction={createDraftIcons}
          createFlagsAction={createDraftFlags}
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

/** ---- Export types for client component (type-only imports) ---- */
export type {
  SavePersonaIn,
  SavePersonaOut,
  CreateDraftNamesIn,
  CreateDraftNamesOut,
  CreateDraftDescriptionsIn,
  CreateDraftDescriptionsOut,
  CreateDraftInstructionsIn,
  CreateDraftInstructionsOut,
  CreateDraftColorsIn,
  CreateDraftColorsOut,
  CreateDraftIconsIn,
  CreateDraftIconsOut,
  CreateDraftFlagsIn,
  CreateDraftFlagsOut,
  GetPersonaIn,
  GetPersonaOut,
  PatchPersonaDraftIn,
  PatchPersonaDraftOut,
};
