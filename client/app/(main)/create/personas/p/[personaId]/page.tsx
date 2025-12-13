/**
 * app/(main)/create/personas/p/[personaId]/page.tsx
 * Persona edit page for the persona page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Persona from "@/components/personas/Persona";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getSession } from "@/auth";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type PersonaDetailOut = OutputOf<"/api/v3/personas/detail", "post">;
type PersonaNewIn = InputOf<"/api/v3/personas/new", "post">;
type PersonaNewOut = OutputOf<"/api/v3/personas/new", "post">;
type CreatePersonaIn = InputOf<"/api/v3/personas/create", "post">;
type CreatePersonaOut = OutputOf<"/api/v3/personas/create", "post">;
type UpdatePersonaIn = InputOf<"/api/v3/personas/update", "post">;
type UpdatePersonaOut = OutputOf<"/api/v3/personas/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getPersona = async (
  personaId: string,
  profileId: string,
): Promise<PersonaDetailOut> => {
  return api.post(
    "/personas/detail",
    { body: { personaId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ personaId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { personaId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (profileId) {
    try {
      const persona = await getPersona(personaId, profileId);
      return {
        title: `${persona?.name || "Persona"} Persona`,
        description: `${persona?.name ? `${persona.name} - ` : ""}AI-powered student persona for simulation-based teaching assistant training. Practice pedagogical techniques and student interaction strategies in realistic educational scenarios.${persona?.description ? ` ${persona.description}` : ""}`,
      };
    } catch {
      // Fall through to default metadata
    }
  }

  return {
    title: "Persona",
    description:
      "AI-powered student persona for simulation-based teaching assistant training. Practice pedagogical techniques and student interaction strategies in realistic educational scenarios.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createPersona(
  input: CreatePersonaIn,
): Promise<CreatePersonaOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/create", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

async function updatePersona(
  input: UpdatePersonaIn,
): Promise<UpdatePersonaOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/update", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

/** ---- Server renders client with typed data and actions ---- */
export default async function PersonaEditPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = await params;
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch persona detail (always fresh - source of truth)
  try {
    const personaDetail = await getPersona(personaId, profileId);

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
  PersonaNewIn,
  PersonaNewOut,
  PersonaDetailOut,
  UpdatePersonaIn,
  UpdatePersonaOut,
};
