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

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getPersona = async (
  personaId: string,
  profileId: string
): Promise<PersonaDetailOut> => {
  return api.post(
    "/personas/detail",
    { body: { personaId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ personaId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { personaId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch active settings for organization name and description
  let organizationName = "";
  let organizationDescription = "";
  try {
    const activeSettings = await api.post("/settings/active", {
      body: { profileId },
    });
    organizationName = activeSettings.organization_name || "";
    organizationDescription = activeSettings.organization_description || "";
  } catch {
    // If settings unavailable, organizationName and organizationDescription will be empty
  }

  const orgPart = organizationName
    ? ` at ${organizationName}${organizationDescription ? ` - ${organizationDescription}` : ""}`
    : "";

  try {
    const persona = await getPersona(personaId, profileId);
    return {
      title: `${persona?.name || "Persona"} Persona`,
      description: `${persona ? `${persona.name} ${persona.description || ""}` : "Persona"} in GLOW${orgPart}.`,
    };
  } catch {
    return {
      title: "Persona",
      description: `Persona in GLOW${orgPart}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createPersona(
  input: CreatePersonaIn
): Promise<CreatePersonaOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/create", {
    ...input,
    body: { ...input.body, profileId },
  });
}

async function updatePersona(
  input: UpdatePersonaIn
): Promise<UpdatePersonaOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/update", {
    ...input,
    body: { ...input.body, profileId },
  });
}

async function deletePersonaPrompt(
  input: DeletePersonaPromptIn
): Promise<DeletePersonaPromptOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/delete-prompt", input);
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
