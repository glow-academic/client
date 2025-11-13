/**
 * app/(main)/management/rubrics/page.tsx
 * Rubric list page - redirects to home with rubrics section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import { getSession } from "@/auth";

import Rubrics from "@/components/rubrics/Rubrics";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type RubricsListIn = InputOf<"/api/v3/rubrics/list", "post">;
type RubricsListOut = OutputOf<"/api/v3/rubrics/list", "post">;
type DuplicateRubricIn = InputOf<"/api/v3/rubrics/duplicate", "post">;
type DuplicateRubricOut = OutputOf<"/api/v3/rubrics/duplicate", "post">;
type DeleteRubricIn = InputOf<"/api/v3/rubrics/delete", "post">;
type DeleteRubricOut = OutputOf<"/api/v3/rubrics/delete", "post">;
type CreateRubricIn = InputOf<"/api/v3/rubrics/create", "post">;
type CreateRubricOut = OutputOf<"/api/v3/rubrics/create", "post">;
type UpdateRubricIn = InputOf<"/api/v3/rubrics/update", "post">;
type UpdateRubricOut = OutputOf<"/api/v3/rubrics/update", "post">;

/** ---- Cached fetch with Next tags ----
 * Cache key includes profileId so entries are per-user.
 * Tags allow revalidateTag("rubrics") to invalidate.
 */
const getRubricsList = unstable_cache(
  async (profileId: string): Promise<RubricsListOut> => {
    return api.post("/rubrics/list", { body: { profileId } });
  },
  ["rubrics:list"],
  { tags: ["rubrics"] }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function duplicateRubric(
  input: DuplicateRubricIn,
): Promise<DuplicateRubricOut> {
  "use server";
  const out = await api.post("/rubrics/duplicate", input);
  revalidateTag("rubrics");
  const rubricId = input.body?.rubricId;
  if (rubricId) {
    revalidateTag(`rubric:${rubricId}`);
  }
  return out;
}

export async function deleteRubric(
  input: DeleteRubricIn,
): Promise<DeleteRubricOut> {
  "use server";
  const out = await api.post("/rubrics/delete", input);
  revalidateTag("rubrics");
  const rubricId = input.body?.rubricId;
  if (rubricId) {
    revalidateTag(`rubric:${rubricId}`);
  }
  return out;
}

export async function createRubric(
  input: CreateRubricIn,
): Promise<CreateRubricOut> {
  "use server";
  const out = await api.post("/rubrics/create", input);
  revalidateTag("rubrics");
  return out;
}

export async function updateRubric(
  input: UpdateRubricIn,
): Promise<UpdateRubricOut> {
  "use server";
  const out = await api.post("/rubrics/update", input);
  revalidateTag("rubrics");
  return out;
}

export const metadata: Metadata = {
  title: "Rubrics",
  description: `Rubrics in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function RubricsPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

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
