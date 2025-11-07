/**
 * app/(main)/create/personas/new/page.tsx
 * New persona page for the personas section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Persona from "@/components/personas/Persona";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type PersonaDetailDefaultOut = OutputOf<
  "/api/v3/personas/detail-default",
  "post"
>;
type CreatePersonaIn = InputOf<"/api/v3/personas/create", "post">;
type CreatePersonaOut = OutputOf<"/api/v3/personas/create", "post">;

/** ---- Cached fetch with Next tags ----
 * Per-profile cache entry tagged as 'personas' so create() can invalidate.
 */
const getPersonaDefault = unstable_cache(
  async (profileId: string): Promise<PersonaDetailDefaultOut> => {
    return api.post("/personas/detail-default", { body: { profileId } });
  },
  ["personas:detail-default"],
  { tags: ["personas"] }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function createPersona(
  input: CreatePersonaIn
): Promise<CreatePersonaOut> {
  "use server";
  const out = await api.post("/personas/create", input);
  revalidateTag("personas");
  const personaId = (out as { personaId?: string } | undefined)?.personaId;
  if (personaId) {
    revalidateTag(`persona:${personaId}`);
  }
  return out;
}

export const metadata: Metadata = {
  title: "New Persona",
  description: `New persona creation page for the personas section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewPersonaPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

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
export type { CreatePersonaIn, CreatePersonaOut, PersonaDetailDefaultOut };
