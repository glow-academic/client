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
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type PersonasListOut = OutputOf<"/api/v3/personas/list", "post">;
type DuplicatePersonaIn = InputOf<"/api/v3/personas/duplicate", "post">;
type DuplicatePersonaOut = OutputOf<"/api/v3/personas/duplicate", "post">;
type DeletePersonaIn = InputOf<"/api/v3/personas/delete", "post">;
type DeletePersonaOut = OutputOf<"/api/v3/personas/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getPersonasList = async (
  profileId: string
): Promise<PersonasListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/personas/list",
    { body: { profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicatePersona(
  input: DuplicatePersonaIn
): Promise<DuplicatePersonaOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/duplicate", {
    ...input,
    body: { ...input.body, profileId },
  });
}

async function deletePersona(
  input: DeletePersonaIn
): Promise<DeletePersonaOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/delete", {
    ...input,
    body: { ...input.body, profileId },
  });
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
