/**
 * app/(main)/create/personas/page.tsx
 * Persona list page - redirects to home with personas section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Personas from "@/components/personas/Personas";
import { getSession } from "@/auth";
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
const getPersonasList = async (profileId: string): Promise<PersonasListOut> => {
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
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
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
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/delete", {
    ...input,
    body: { ...input.body, profileId },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Personas",
    description:
      "Manage AI-powered student personas for teaching assistant training. Create and organize realistic student profiles with diverse personalities and learning styles to enhance simulation-based pedagogical practice and student interaction training.",
  };
}

export default async function PersonasPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

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
