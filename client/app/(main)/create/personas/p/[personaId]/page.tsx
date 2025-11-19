/**
 * app/(main)/create/personas/p/[personaId]/page.tsx
 * Persona edit page for the persona page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import Persona from "@/components/personas/Persona";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
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
type DeletePersonaPromptIn = InputOf<"/api/v3/personas/delete-prompt", "post">;
type DeletePersonaPromptOut = OutputOf<
  "/api/v3/personas/delete-prompt",
  "post"
>;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getPersona = (personaId: string) =>
  unstable_cache(
    async (profileId: string): Promise<PersonaDetailOut> => {
      return api.post("/personas/detail", {
        body: { personaId, profileId },
      });
    },
    ["personas:detail", personaId],
    { tags: ["personas", `persona:${personaId}`] }
  );

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ personaId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { personaId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const persona = await getPersona(personaId)(profileId);
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
  const personaId = input.body?.personaId;
  if (personaId) {
    revalidateTag(`persona:${personaId}`);
  }
  return out;
}

export async function deletePersonaPrompt(
  input: DeletePersonaPromptIn
): Promise<DeletePersonaPromptOut> {
  "use server";
  const out = await api.post("/personas/delete-prompt", input);
  revalidateTag("personas");
  const personaId = input.body?.personaId;
  if (personaId) {
    revalidateTag(`persona:${personaId}`);
  }
  return out;
}

/** ---- Server renders client with typed data and actions ---- */
export default async function PersonaEditPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch persona detail (cached, won't duplicate with metadata)
  try {
    const personaDetail = await getPersona(personaId)(profileId);

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
          deletePersonaPromptAction={deletePersonaPrompt}
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
        <DepartmentAccessDenied
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
  DeletePersonaPromptIn,
  DeletePersonaPromptOut,
  PersonaDetailDefaultIn,
  PersonaDetailDefaultOut,
  PersonaDetailOut,
  UpdatePersonaIn,
  UpdatePersonaOut,
};
