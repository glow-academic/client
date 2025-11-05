/**
 * app/(main)/create/personas/p/[personaId]/page.tsx
 * Persona edit page for the persona page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import Persona from "@/components/personas/Persona";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type PersonaDetailIn = InputOf<"/api/v3/personas/detail", "post">;
type PersonaDetailOut = OutputOf<"/api/v3/personas/detail", "post">;
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
type UpdatePersonaIn = InputOf<"/api/v3/personas/update", "post">;
type UpdatePersonaOut = OutputOf<"/api/v3/personas/update", "post">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getPersona = cache(
  async (input: PersonaDetailIn): Promise<PersonaDetailOut> => {
    return api.post("/personas/detail", input);
  }
);

const getPersonaDefault = cache(
  async (input: PersonaDetailDefaultIn): Promise<PersonaDetailDefaultOut> => {
    return api.post("/personas/detail-default", input);
  }
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ personaId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { personaId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const persona = await getPersona({ body: { personaId, profileId } });
    return {
      title: `${persona?.name || "Persona"} Persona`,
      description: `${persona ? `${persona.name} ${persona.description || ""}` : "Persona"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Persona",
      description: `Persona in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function createPersona(
  input: CreatePersonaIn
): Promise<CreatePersonaOut> {
  "use server";
  const out = await api.post("/personas/create", input);
  revalidateTag("personas");
  return out;
}

export async function updatePersona(
  input: UpdatePersonaIn
): Promise<UpdatePersonaOut> {
  "use server";
  const out = await api.post("/personas/update", input);
  revalidateTag("personas");
  return out;
}

/** ---- Server renders client with typed data and actions ---- */
export default async function PersonaEditPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch persona detail (cached, won't duplicate with metadata)
  const personaDetail = await getPersona({ body: { personaId, profileId } });

  return (
    <div className="space-y-6">
      <Persona
        personaId={personaId}
        mode="edit"
        personaDetail={personaDetail}
        createPersonaAction={createPersona}
        updatePersonaAction={updatePersona}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  PersonaDetailIn,
  PersonaDetailOut,
  PersonaDetailDefaultIn,
  PersonaDetailDefaultOut,
  CreatePersonaIn,
  CreatePersonaOut,
  UpdatePersonaIn,
  UpdatePersonaOut,
};
