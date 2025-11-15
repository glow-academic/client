/**
 * app/(main)/create/cohorts/page.tsx
 * Cohorts list page - redirects to home with cohorts section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { getSession } from "@/auth";

import Cohorts from "@/components/cohorts/Cohorts";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type CohortsListOut = OutputOf<"/api/v3/cohorts/list", "post">;
type DuplicateCohortIn = InputOf<"/api/v3/cohorts/duplicate", "post">;
type DuplicateCohortOut = OutputOf<"/api/v3/cohorts/duplicate", "post">;
type DeleteCohortIn = InputOf<"/api/v3/cohorts/delete", "post">;
type DeleteCohortOut = OutputOf<"/api/v3/cohorts/delete", "post">;
type LeaveCohortIn = InputOf<"/api/v3/cohorts/leave", "post">;
type LeaveCohortOut = OutputOf<"/api/v3/cohorts/leave", "post">;

/** ---- Cached fetch with Next tags ----
 * Cache key includes profileId so entries are per-user.
 * Tags allow revalidateTag("cohorts") to invalidate.
 */
const getCohortsList = unstable_cache(
  async (profileId: string): Promise<CohortsListOut> => {
    return api.post("/cohorts/list", { body: { profileId } });
  },
  ["cohorts:list"],
  { tags: ["cohorts"] }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function duplicateCohort(
  input: DuplicateCohortIn,
): Promise<DuplicateCohortOut> {
  "use server";
  const out = await api.post("/cohorts/duplicate", input);
  revalidateTag("cohorts");
  return out;
}

export async function deleteCohort(
  input: DeleteCohortIn,
): Promise<DeleteCohortOut> {
  "use server";
  const out = await api.post("/cohorts/delete", input);
  revalidateTag("cohorts");
  return out;
}

export async function leaveCohort(
  input: LeaveCohortIn,
): Promise<LeaveCohortOut> {
  "use server";
  const out = await api.post("/cohorts/leave", input);
  revalidateTag("cohorts");
  return out;
}

export const metadata: Metadata = {
  title: "Cohorts",
  description: `Manage cohorts in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function CohortsPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getCohortsList(profileId);

  return (
    <div className="space-y-6" data-page="cohorts-index">
      <Cohorts
        listData={listData}
        duplicateCohortAction={duplicateCohort}
        deleteCohortAction={deleteCohort}
        leaveCohortAction={leaveCohort}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CohortsListOut,
  DeleteCohortIn,
  DeleteCohortOut,
  DuplicateCohortIn,
  DuplicateCohortOut,
  LeaveCohortIn,
  LeaveCohortOut,
};
