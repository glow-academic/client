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
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type PersonaDetailIn = InputOf<"/api/v4/personas/detail", "post">;
type PersonaDetailOut = OutputOf<"/api/v4/personas/detail", "post">;
type PersonaNewIn = InputOf<"/api/v4/personas/new", "post">;
type PersonaNewOut = OutputOf<"/api/v4/personas/new", "post">;
type CreatePersonaIn = InputOf<"/api/v4/personas/create", "post">;
type CreatePersonaOut = OutputOf<"/api/v4/personas/create", "post">;
type UpdatePersonaIn = InputOf<"/api/v4/personas/update", "post">;
type UpdatePersonaOut = OutputOf<"/api/v4/personas/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getPersona = async (
  input: PersonaDetailIn
): Promise<PersonaDetailOut> => {
  return api.post("/personas/detail", input, {
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
    const input: PersonaDetailIn = {
      body: {
        persona_id: personaId,
        color_search: null,
        icon_search: null,
      } as PersonaDetailIn["body"],
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
async function createPersona(
  input: CreatePersonaIn
): Promise<CreatePersonaOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/create", input);
}

async function updatePersona(
  input: UpdatePersonaIn
): Promise<UpdatePersonaOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/update", input);
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
    colorSearch: parseAsString,
    iconSearch: parseAsString,
  };
  const loadPersonaSearchParams = createLoader(personaSearchParams);
  const q = loadPersonaSearchParams(searchParamsObj);

  // Fetch persona detail (always fresh - source of truth) with filter params
  // Note: OpenAPI schema may need regeneration to include color_search/icon_search
  try {
    const input: PersonaDetailIn = {
      body: {
        persona_id: personaId,
        color_search: q.colorSearch ?? null,
        icon_search: q.iconSearch ?? null,
      } as PersonaDetailIn["body"],
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
          mode="edit"
          personaDetail={personaDetail}
          createPersonaAction={createPersona}
          updatePersonaAction={updatePersona}
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
  CreatePersonaIn,
  CreatePersonaOut,
  PersonaDetailIn,
  PersonaDetailOut,
  PersonaNewIn,
  PersonaNewOut,
  UpdatePersonaIn,
  UpdatePersonaOut,
};
