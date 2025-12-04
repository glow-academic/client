/**
 * app/(main)/cohorts/e/[cohortId]/page.tsx
 * Cohort edit page for the cohort.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { getSession } from "@/auth";

import Cohort from "@/components/cohorts/Cohort";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

// Import staff actions from staff page
import {
  bulkCreateOrUpdateStaff,
  bulkUpdateStaff,
  getCreateStaffData,
  processCSV,
  searchStaff,
  updateStaff,
} from "@/app/(main)/management/staff/page";

/** ---- Strong types from OpenAPI ---- */
type CohortDetailIn = InputOf<"/api/v3/cohorts/detail", "post">;
type CohortDetailOut = OutputOf<"/api/v3/cohorts/detail", "post">;
type UpdateCohortIn = InputOf<"/api/v3/cohorts/update", "post">;
type UpdateCohortOut = OutputOf<"/api/v3/cohorts/update", "post">;
/** ---- Derived types from server responses ---- */
type CohortStaffItem = CohortDetailOut["staff"][number];

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getCohort = async (
  cohortId: string,
  profileId: string
): Promise<CohortDetailOut> => {
  return api.post(
    "/cohorts/detail",
    { body: { cohortId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ cohortId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { cohortId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

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

  try {
    const cohort = await getCohort(cohortId, profileId);
    return {
      title: `${cohort?.title || "Cohort"} Edit`,
      description: `${cohort ? `${cohort.title} ${cohort.description || ""}` : "Cohort"} in GLOW${orgPart}.`,
    };
  } catch {
    return {
      title: "Cohort Edit",
      description: `Cohort in GLOW${orgPart}.`,
    };
  }
}

/** ---- Strongly-typed server action ---- */
async function updateCohort(
  input: UpdateCohortIn
): Promise<UpdateCohortOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/cohorts/update", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function CohortEditPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch cohort detail (always fresh - source of truth)
  const cohortDetail = await getCohort(cohortId, profileId);

  // Fetch initial search data (empty query) for SearchExistingStaffModal
  const initialSearchData = await searchStaff({
    body: {
      query: null,
      cohortIds: [cohortId],
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
      data-page="cohort-edit"
      data-cohort-id={cohortId}
    >
      <Cohort
        cohortId={cohortId}
        cohortDetail={cohortDetail}
        updateCohortAction={updateCohort}
        processCSVAction={processCSV}
        bulkCreateOrUpdateStaffAction={bulkCreateOrUpdateStaff}
        searchStaffAction={searchStaff}
        initialSearchData={initialSearchData}
        initialCreateStaffData={initialCreateStaffData}
        updateStaffAction={updateStaff}
        bulkUpdateStaffAction={bulkUpdateStaff}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CohortDetailIn,
  CohortDetailOut,
  CohortStaffItem,
  UpdateCohortIn,
  UpdateCohortOut,
};
