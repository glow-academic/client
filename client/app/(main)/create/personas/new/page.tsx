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
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type PersonaNewIn = InputOf<"/api/v3/personas/new", "post">;
type PersonaNewOut = OutputOf<"/api/v3/personas/new", "post">;
type CreatePersonaIn = InputOf<"/api/v3/personas/create", "post">;
type CreatePersonaOut = OutputOf<"/api/v3/personas/create", "post">;

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

  // Inline server-side parsers for persona search params
  const personaSearchParams = {
    colorSearch: parseAsString,
    iconSearch: parseAsString,
  };
  const loadPersonaSearchParams = createLoader(personaSearchParams);
  const q = loadPersonaSearchParams(searchParamsObj);

  // Fetch default persona detail server-side with filter params
  // Note: OpenAPI schema may need regeneration to include color_search/icon_search
  const input: PersonaNewIn = {
    body: {
      color_search: q.colorSearch ?? null,
      icon_search: q.iconSearch ?? null,
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
        mode="create"
        personaDetailDefault={personaDetailDefault}
        createPersonaAction={createPersona}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { CreatePersonaIn, CreatePersonaOut, PersonaNewIn, PersonaNewOut };
