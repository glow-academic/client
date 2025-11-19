/**
 * app/(main)/cohorts/new/page.tsx
 * New cohort page for the cohorts section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Cohort from "@/components/cohorts/Cohort";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

// Import staff actions from staff page
import {
  bulkCreateOrUpdateStaff,
  getCreateStaffData,
  processCSV,
  searchStaff,
} from "@/app/(main)/system/staff/page";

/** ---- Strong types from OpenAPI ---- */
type CohortDetailDefaultIn = InputOf<"/api/v3/cohorts/detail-default", "post">;
type CohortDetailDefaultOut = OutputOf<
  "/api/v3/cohorts/detail-default",
  "post"
>;
type CreateCohortIn = InputOf<"/api/v3/cohorts/create", "post">;
type CreateCohortOut = OutputOf<"/api/v3/cohorts/create", "post">;

/** ---- Cached fetch with Next tags ----
 * Per-profile cache entry tagged as 'cohorts' so create() can invalidate.
 */
const getCohortDefault = unstable_cache(
  async (profileId: string): Promise<CohortDetailDefaultOut> => {
    return api.post("/cohorts/detail-default", { body: { profileId } });
  },
  ["cohorts:detail-default"],
  { tags: ["cohorts"] }
);

/** ---- Strongly-typed server action ---- */
async function createCohort(
  input: CreateCohortIn,
): Promise<CreateCohortOut> {
  "use server";
  const out = await api.post("/cohorts/create", input);
  revalidateTag("cohorts");
  return out;
}

export const metadata: Metadata = {
  title: "New Cohort",
  description: `Create new cohorts in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewCohortPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch cohort default data (for dropdowns and defaults)
  const cohortDetailDefault = await getCohortDefault(profileId);

  // Fetch initial search data (empty query) for SearchExistingStaffModal
  const initialSearchData = await searchStaff({
    body: {
      query: null,
      cohortIds: null,
      departmentIds: null,
      limit: 200,
      profileId,
    },
  });

  // Fetch initial create staff data for CreateStaffButton
  const initialCreateStaffData = await getCreateStaffData({
    body: {
      departmentIds: [],
      profileId,
    },
  });

  return (
    <div
      className="space-y-6"
      data-page="cohort-new"
      aria-label="Create new cohort page"
    >
      <Cohort
        cohortDetailDefault={cohortDetailDefault}
        createCohortAction={createCohort}
        processCSVAction={processCSV}
        bulkCreateOrUpdateStaffAction={bulkCreateOrUpdateStaff}
        searchStaffAction={searchStaff}
        initialSearchData={initialSearchData}
        initialCreateStaffData={initialCreateStaffData}
      />
    </div>
  );
}

/** ---- Derived types from server responses ---- */
type CohortDefaultStaffItem = CohortDetailDefaultOut["staff"][number];

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CohortDefaultStaffItem,
  CohortDetailDefaultIn,
  CohortDetailDefaultOut,
  CreateCohortIn,
  CreateCohortOut,
};
