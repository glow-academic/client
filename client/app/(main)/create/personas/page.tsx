/**
 * app/(main)/create/personas/page.tsx
 * Persona list page - redirects to home with personas section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import { getSession } from "@/auth";

import Personas from "@/components/personas/Personas";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type PersonasListOut = OutputOf<"/api/v3/personas/list", "post">;
type DuplicatePersonaIn = InputOf<"/api/v3/personas/duplicate", "post">;
type DuplicatePersonaOut = OutputOf<"/api/v3/personas/duplicate", "post">;
type DeletePersonaIn = InputOf<"/api/v3/personas/delete", "post">;
type DeletePersonaOut = OutputOf<"/api/v3/personas/delete", "post">;

/** ---- Cached fetch with Next tags ----
 * Cache key includes profileId so entries are per-user.
 * Tags allow revalidateTag("personas") to invalidate.
 */
const getPersonasList = unstable_cache(
  async (profileId: string): Promise<PersonasListOut> => {
    return api.post("/personas/list", { body: { profileId } });
  },
  ["personas:list"],
  { tags: ["personas"] }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicatePersona(
  input: DuplicatePersonaIn
): Promise<DuplicatePersonaOut> {
  "use server";
  const out = await api.post("/personas/duplicate", input);
  revalidateTag("personas");
  const personaId = input.body?.personaId;
  if (personaId) {
    revalidateTag(`persona:${personaId}`);
  }
  return out;
}

async function deletePersona(
  input: DeletePersonaIn
): Promise<DeletePersonaOut> {
  "use server";
  const out = await api.post("/personas/delete", input);
  revalidateTag("personas");
  const personaId = input.body?.personaId;
  if (personaId) {
    revalidateTag(`persona:${personaId}`);
  }
  return out;
}

export const metadata: Metadata = {
  title: "Personas",
  description: `Personas in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function PersonasPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getPersonasList(profileId);

  return (
    <div className="space-y-6" data-page="personas-index">
      <Personas
        listData={listData}
        duplicatePersonaAction={duplicatePersona}
        deletePersonaAction={deletePersona}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeletePersonaIn,
  DeletePersonaOut,
  DuplicatePersonaIn,
  DuplicatePersonaOut,
  PersonasListOut,
};
