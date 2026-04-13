/**
 * app/(main)/create/personas/new/page.tsx
 * New persona page for the personas section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Persona from "@/components/artifacts/persona/Persona";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
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
type CreatePersonaIn = InputOf<"/personas/create", "post">;
type CreatePersonaOut = OutputOf<"/personas/create", "post">;
type PatchPersonaDraftIn = InputOf<"/personas/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<"/personas/draft", "patch">;
type GroupPersonaIn = InputOf<"/personas/group", "post">;
type GroupPersonaOut = OutputOf<"/personas/group", "post">;
type GeneratePersonaIn = InputOf<"/personas/generate", "post">;
type GeneratePersonaOut = OutputOf<"/personas/generate", "post">;

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
async function createPersona(input: CreatePersonaIn): Promise<CreatePersonaOut> {
  "use server";
  return api.post("/personas/create", input);
}

async function patchPersonaDraft(
  input: PatchPersonaDraftIn
): Promise<PatchPersonaDraftOut> {
  "use server";
  return api.post("/personas/draft", input);
}

async function generatePersona(
  input: GeneratePersonaIn
): Promise<GeneratePersonaOut> {
  "use server";
  return api.post("/personas/generate", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/personas/docs", "post">;
type DocsOut = OutputOf<"/personas/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/personas/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.page_metadata?.new.title, description: docs.page_metadata?.new.description };
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
    parameterIds: parseAsArrayOf(parseAsString),
  };
  const loadPersonaSearchParams = createLoader(personaSearchParams);
  const q = loadPersonaSearchParams(searchParamsObj);

  // Fetch default persona detail server-side with filter params and draft_id
  const input: GetPersonaIn = {
    body: {
      id: null, // NULL for new mode
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
  const [personaDetailDefault, draftsResult, groupResult] = await Promise.all([
    getPersonaDefault(input),
    api.post("/personas/drafts", {}),
    api.post("/personas/group", { body: {} } as GroupPersonaIn),
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <PageHeader
        breadcrumbs={[
          { title: "Training", section: "training", url: "/training" },
          { title: "Personas", section: "personas", url: "/training/personas" },
          { title: "New Persona" },
        ]}
        toolbar={<SaveToolbar />}
      />
      <div
        className="space-y-6 px-4"
        data-page="persona-new"
        aria-label="Create new persona page"
      >
        <Persona
          key={q.draftId || "no-draft"}
          groupId={(groupResult as any)?.group_id ?? null}
          personaData={personaDetailDefault}
          createPersonaAction={createPersona}
          patchPersonaDraftAction={patchPersonaDraft}
          generateAction={generatePersona}
        />
      </div>
    </DraftProviderClient>
  );
}
