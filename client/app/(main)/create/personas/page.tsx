/**
 * app/(main)/create/personas/page.tsx
 * Persona list page - redirects to home with personas section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import { auth } from "@/auth";
import Personas from "@/components/personas/Personas";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type PersonasListIn = InputOf<"/api/v3/personas/list", "post">;
type PersonasListOut = OutputOf<"/api/v3/personas/list", "post">;
type DuplicatePersonaIn = InputOf<"/api/v3/personas/duplicate", "post">;
type DuplicatePersonaOut = OutputOf<"/api/v3/personas/duplicate", "post">;
type DeletePersonaIn = InputOf<"/api/v3/personas/delete", "post">;
type DeletePersonaOut = OutputOf<"/api/v3/personas/delete", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getPersonasList = cache(
  async (input: PersonasListIn): Promise<PersonasListOut> => {
    return api.post("/personas/list", input);
  }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function duplicatePersona(
  input: DuplicatePersonaIn
): Promise<DuplicatePersonaOut> {
  "use server";
  const out = await api.post("/personas/duplicate", input);
  revalidateTag("personas");
  return out;
}

export async function deletePersona(
  input: DeletePersonaIn
): Promise<DeletePersonaOut> {
  "use server";
  const out = await api.post("/personas/delete", input);
  revalidateTag("personas");
  return out;
}

export const metadata: Metadata = {
  title: "Personas",
  description: `Personas in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function PersonasPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getPersonasList({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
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
