/**
 * app/(main)/engine/rubrics/page.tsx
 * Rubric list page - redirects to home with rubrics section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Rubrics from "@/components/rubrics/Rubrics";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { getSession } from "@/auth";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type RubricsListOut = OutputOf<"/api/v3/rubrics/list", "post">;
type DuplicateRubricIn = InputOf<"/api/v3/rubrics/duplicate", "post">;
type DuplicateRubricOut = OutputOf<"/api/v3/rubrics/duplicate", "post">;
type DeleteRubricIn = InputOf<"/api/v3/rubrics/delete", "post">;
type DeleteRubricOut = OutputOf<"/api/v3/rubrics/delete", "post">;
type CreateRubricIn = InputOf<"/api/v3/rubrics/create", "post">;
type CreateRubricOut = OutputOf<"/api/v3/rubrics/create", "post">;
type UpdateRubricIn = InputOf<"/api/v3/rubrics/update", "post">;
type UpdateRubricOut = OutputOf<"/api/v3/rubrics/update", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getRubricsList = async (profileId: string): Promise<RubricsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/rubrics/list",
    { body: { profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function duplicateRubric(
  input: DuplicateRubricIn,
): Promise<DuplicateRubricOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/rubrics/duplicate", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

export async function deleteRubric(
  input: DeleteRubricIn,
): Promise<DeleteRubricOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/rubrics/delete", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

export async function createRubric(
  input: CreateRubricIn,
): Promise<CreateRubricOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/rubrics/create", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

export async function updateRubric(
  input: UpdateRubricIn,
): Promise<UpdateRubricOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/rubrics/update", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Rubrics",
    description:
      "Manage assessment rubrics for teaching assistant evaluation. Create and customize rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills.",
  };
}

export default async function RubricsPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch list data server-side
  const listData = await getRubricsList(profileId);

  return (
    <div className="space-y-6" data-page="rubrics-index">
      <Rubrics
        listData={listData}
        duplicateRubricAction={duplicateRubric}
        deleteRubricAction={deleteRubric}
        createRubricAction={createRubric}
        updateRubricAction={updateRubric}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateRubricIn,
  CreateRubricOut,
  DeleteRubricIn,
  DeleteRubricOut,
  DuplicateRubricIn,
  DuplicateRubricOut,
  RubricsListOut,
  UpdateRubricIn,
  UpdateRubricOut,
};
