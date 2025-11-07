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
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type PersonaDetailDefaultIn = InputOf<
  "/api/v3/personas/detail-default",
  "post"
>;
type PersonaDetailDefaultOut = OutputOf<
  "/api/v3/personas/detail-default",
  "post"
>;
type CreatePersonaIn = InputOf<"/api/v3/personas/create", "post">;
type CreatePersonaOut = OutputOf<"/api/v3/personas/create", "post">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getPersonaDefault = cache(
  async (input: PersonaDetailDefaultIn): Promise<PersonaDetailDefaultOut> => {
    return api.post("/personas/detail-default", input);
  },
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function createPersona(
  input: CreatePersonaIn,
): Promise<CreatePersonaOut> {
  "use server";
  const out = await api.post("/personas/create", input);
  revalidateTag("personas");
  return out;
}

export const metadata: Metadata = {
  title: "New Persona",
  description: `New persona creation page for the personas section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewPersonaPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default persona detail server-side
  const personaDetailDefault = await getPersonaDefault({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
      <Persona
        mode="create"
        personaDetailDefault={personaDetailDefault}
        createPersonaAction={createPersona}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreatePersonaIn,
  CreatePersonaOut,
  PersonaDetailDefaultIn,
  PersonaDetailDefaultOut,
};
