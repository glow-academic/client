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
import { revalidateTag } from "next/cache";
import { cache } from "react";

// Import staff actions from staff page
import {
  bulkCreateOrUpdateStaff,
  getCreateStaffData,
  processCSV,
  searchStaff,
} from "@/app/(main)/management/staff/page";

/** ---- Strong types from OpenAPI ---- */
type CohortDetailIn = InputOf<"/api/v3/cohorts/detail", "post">;
type CohortDetailOut = OutputOf<"/api/v3/cohorts/detail", "post">;
type UpdateCohortIn = InputOf<"/api/v3/cohorts/update", "post">;
type UpdateCohortOut = OutputOf<"/api/v3/cohorts/update", "post">;
/** ---- Derived types from server responses ---- */
type CohortStaffItem = CohortDetailOut["staff"][number];

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getCohort = cache(
  async (input: CohortDetailIn): Promise<CohortDetailOut> => {
    return api.post("/cohorts/detail", input);
  },
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ cohortId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { cohortId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const cohort = await getCohort({ body: { cohortId, profileId } });
    return {
      title: `${cohort?.title || "Cohort"} Edit`,
      description: `${cohort ? `${cohort.title} ${cohort.description || ""}` : "Cohort"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Cohort Edit",
      description: `Cohort in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Strongly-typed server action ---- */
export async function updateCohort(
  input: UpdateCohortIn,
): Promise<UpdateCohortOut> {
  "use server";
  const out = await api.post("/cohorts/update", input);
  revalidateTag("cohorts");
  return out;
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

  // Fetch cohort detail (cached, won't duplicate with metadata)
  const cohortDetail = await getCohort({ body: { cohortId, profileId } });

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
    <div className="space-y-6">
      <Cohort
        cohortId={cohortId}
        cohortDetail={cohortDetail}
        updateCohortAction={updateCohort}
        processCSVAction={processCSV}
        bulkCreateOrUpdateStaffAction={bulkCreateOrUpdateStaff}
        searchStaffAction={searchStaff}
        initialSearchData={initialSearchData}
        initialCreateStaffData={initialCreateStaffData}
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
