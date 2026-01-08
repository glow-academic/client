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
type PersonaNewIn = InputOf<"/api/v4/personas/new", "post">;
type PersonaNewOut = OutputOf<"/api/v4/personas/new", "post">;
type CreatePersonaIn = InputOf<"/api/v4/personas/create", "post">;
type CreatePersonaOut = OutputOf<"/api/v4/personas/create", "post">;
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
const getPersonaDefault = async (
  input: PersonaNewIn
): Promise<PersonaNewOut> => {
  return api.post("/personas/new", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createPersona(
  input: CreatePersonaIn
): Promise<CreatePersonaOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/create", input);
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
    colorShowSelected: parseAsBoolean,
    iconShowSelected: parseAsBoolean,
    color: parseAsString,
    icon: parseAsString,
  };
  const loadPersonaSearchParams = createLoader(personaSearchParams);
  const q = loadPersonaSearchParams(searchParamsObj);

  // Fetch default persona detail server-side with filter params and draft_id
  // Note: OpenAPI schema needs regeneration to include new filter params
  const input: PersonaNewIn = {
    body: {
      draft_id: q.draftId ?? null,
      color_search: q.colorSearch ?? null,
      icon_search: q.iconSearch ?? null,
      color_show_selected: q.colorShowSelected ?? null,
      icon_show_selected: q.iconShowSelected ?? null,
      current_color: q.color ?? null,
      current_icon: q.icon ?? null,
    } as PersonaNewIn["body"],
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
        mode="create"
        personaDetailDefault={personaDetailDefault}
        createPersonaAction={createPersona}
        createDraftNamesAction={createDraftNames}
        createDraftDescriptionsAction={createDraftDescriptions}
        createDraftInstructionsAction={createDraftInstructions}
        createDraftColorsAction={createDraftColors}
        createDraftIconsAction={createDraftIcons}
        createDraftFlagsAction={createDraftFlags}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreatePersonaIn,
  CreatePersonaOut,
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
  PatchPersonaDraftIn,
  PatchPersonaDraftOut,
  PersonaNewIn,
  PersonaNewOut,
};
