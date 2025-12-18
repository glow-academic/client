/**
 * app/(main)/create/cohorts/new/page.tsx
 * New cohort page for the cohorts section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Cohort from "@/components/cohorts/Cohort";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type CohortNewIn = InputOf<"/api/v3/cohorts/new", "post">;
type CohortNewOut = OutputOf<"/api/v3/cohorts/new", "post">;
type CreateCohortIn = InputOf<"/api/v3/cohorts/create", "post">;
type CreateCohortOut = OutputOf<"/api/v3/cohorts/create", "post">;
/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getCohortDefault = async (): Promise<CohortNewOut> => {
  return api.post(
    "/cohorts/new",
    { body: {} },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Strongly-typed server action ---- */
async function createCohort(input: CreateCohortIn): Promise<CreateCohortOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/cohorts/create", input);
}

/** ---- Server action for searching profiles to add to cohort ---- */

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Cohort",
    description:
      "Create a new learning cohort for teaching assistant training programs. Organize groups of teaching assistants, configure cohort settings, and set up group-based learning activities for effective L&D program administration.",
  };
}

export default async function NewCohortPage() {
  // Fetch cohort default data (for dropdowns and defaults)
  const cohortDetailDefault = await getCohortDefault();

  return (
    <div
      className="space-y-6"
      data-page="cohort-new"
      aria-label="Create new cohort page"
    >
      <Cohort
        cohortDetailDefault={cohortDetailDefault}
        createCohortAction={createCohort}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { CohortNewIn, CohortNewOut, CreateCohortIn, CreateCohortOut };
