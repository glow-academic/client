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

// Import staff actions from staff page
import {
  bulkCreateOrUpdateStaff,
  getCreateStaffData,
  processCSV,
  searchStaff,
} from "@/app/(main)/management/staff/page";

/** ---- Strong types from OpenAPI ---- */
type CohortNewIn = InputOf<"/api/v3/cohorts/new", "post">;
type CohortNewOut = OutputOf<
  "/api/v3/cohorts/new",
  "post"
>;
type CreateCohortIn = InputOf<"/api/v3/cohorts/create", "post">;
type CreateCohortOut = OutputOf<"/api/v3/cohorts/create", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getCohortDefault = async (
  profileId: string
): Promise<CohortNewOut> => {
  return api.post(
    "/cohorts/new",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Strongly-typed server action ---- */
async function createCohort(
  input: CreateCohortIn,
): Promise<CreateCohortOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/cohorts/create", input);
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  let organizationName = "";
  let organizationDescription = "";
  try {
    const activeSettings = await api.post("/settings/active", {
      body: { profileId },
    });
    organizationName = activeSettings.organization_name || "";
    organizationDescription = activeSettings.organization_description || "";
  } catch {
    // If settings unavailable, organizationName and organizationDescription will be empty
  }

  const orgPart = organizationName
    ? ` at ${organizationName}${organizationDescription ? ` - ${organizationDescription}` : ""}`
    : "";

  return {
    title: "New Cohort",
    description: `Create new cohorts in GLOW${orgPart}.`,
  };
}

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
type CohortDefaultStaffItem = CohortNewOut["staff"][number];

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CohortDefaultStaffItem,
  CohortNewIn,
  CohortNewOut,
  CreateCohortIn,
  CreateCohortOut,
};
