/**
 * app/(main)/create/personas/new/page.tsx
 * New persona page for the personas section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Persona from "@/components/personas/Persona";
import { AccessDenied } from "@/components/common/layout/AccessDenied";
import { api } from "@/lib/api/client";
import { requireAuthenticated } from "@/lib/auth-helpers";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type PersonaNewOut = OutputOf<"/api/v3/personas/new", "post">;
type CreatePersonaIn = InputOf<"/api/v3/personas/create", "post">;
type CreatePersonaOut = OutputOf<"/api/v3/personas/create", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getPersonaDefault = async (profileId: string): Promise<PersonaNewOut> => {
  return api.post(
    "/personas/new",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createPersona(
  input: CreatePersonaIn
): Promise<CreatePersonaOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/create", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Persona",
    description:
      "Create a new AI-powered student persona for teaching assistant training. Design realistic student profiles with unique personalities and learning styles to practice pedagogical techniques and improve student interaction skills through simulation-based learning.",
  };
}

export default async function NewPersonaPage() {
  const authResult = await requireAuthenticated().catch(() => null);
  if (!authResult) {
    return <AccessDenied redirectPath="/create/personas" />;
  }

  const profileId = authResult.effectiveProfileId;

  // Fetch default persona detail server-side (per-profile cache)
  const personaDetailDefault = await getPersonaDefault(profileId);

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
export type { CreatePersonaIn, CreatePersonaOut, PersonaNewOut };
