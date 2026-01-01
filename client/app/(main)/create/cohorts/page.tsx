/**
 * app/(main)/create/cohorts/page.tsx
 * Cohorts list page - redirects to home with cohorts section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Cohorts from "@/components/cohorts/Cohorts";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type CohortsListOut = OutputOf<"/api/v4/cohorts/list", "post">;
type DuplicateCohortIn = InputOf<"/api/v4/cohorts/duplicate", "post">;
type DuplicateCohortOut = OutputOf<"/api/v4/cohorts/duplicate", "post">;
type DeleteCohortIn = InputOf<"/api/v4/cohorts/delete", "post">;
type DeleteCohortOut = OutputOf<"/api/v4/cohorts/delete", "post">;
type LeaveCohortIn = InputOf<"/api/v4/cohorts/leave", "post">;
type LeaveCohortOut = OutputOf<"/api/v4/cohorts/leave", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getCohortsList = async (): Promise<CohortsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/cohorts/list",
    { body: {} },
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
async function duplicateCohort(
  input: DuplicateCohortIn,
): Promise<DuplicateCohortOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/cohorts/duplicate", input);
}

async function deleteCohort(input: DeleteCohortIn): Promise<DeleteCohortOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/cohorts/delete", input);
}

async function leaveCohort(input: LeaveCohortIn): Promise<LeaveCohortOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/cohorts/leave", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Cohorts",
    description:
      "Manage learning cohorts for teaching assistant training programs. Organize groups of teaching assistants, track cohort progress, and coordinate group-based learning activities for effective L&D program administration.",
  };
}

export default async function CohortsPage() {
  // Access control is handled server-side in layout

  // Fetch list data server-side
  const listData = await getCohortsList();

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
