/**
 * app/(main)/create/personas/new/page.tsx
 * New persona page for the personas section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Persona from "@/components/artifacts/persona/Persona";
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
type SavePersonaIn = InputOf<"/api/v5/artifacts/personas/save", "post">;
type SavePersonaOut = OutputOf<"/api/v5/artifacts/personas/save", "post">;
type PatchPersonaDraftIn = InputOf<"/api/v5/artifacts/personas/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<"/api/v5/artifacts/personas/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getPersonaDefault = async (
  input: GetPersonaIn
): Promise<GetPersonaOut> => {
  return api.post("/artifacts/personas/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function savePersona(input: SavePersonaIn): Promise<SavePersonaOut> {
  "use server";
  return api.post("/artifacts/personas/save", input);
}

async function patchPersonaDraft(
  input: PatchPersonaDraftIn
): Promise<PatchPersonaDraftOut> {
  "use server";
  return api.patch("/artifacts/personas/draft", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/personas/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/personas/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/personas/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
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
      parameter_ids: q.parameterIds ?? null,
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
        key={q.draftId || "no-draft"}
        personaData={personaDetailDefault}
        savePersonaAction={savePersona}
        patchPersonaDraftAction={patchPersonaDraft}
      />
    </div>
  );
}
