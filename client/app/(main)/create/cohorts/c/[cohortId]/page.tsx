/**
 * app/(main)/create/cohorts/c/[cohortId]/page.tsx
 * Cohort edit page for the cohort.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import Cohort from "@/components/cohorts/Cohort";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type CohortDetailIn = InputOf<"/api/v4/cohorts/detail", "post">;
type CohortDetailOut = OutputOf<"/api/v4/cohorts/detail", "post">;
type UpdateCohortIn = InputOf<"/api/v4/cohorts/update", "post">;
type UpdateCohortOut = OutputOf<"/api/v4/cohorts/update", "post">;
/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getCohort = async (cohortId: string): Promise<CohortDetailOut> => {
  return api.post(
    "/cohorts/detail",
    { body: { cohortId } },
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

  try {
    const cohort = await getCohort(cohortId);
    return {
      title: `${cohort?.title || "Cohort"} Edit`,
      description: `${cohort?.title ? `${cohort.title} - ` : ""}Edit learning cohort for teaching assistant training programs.${cohort?.description ? ` ${cohort.description}` : ""} Manage group settings and coordinate group-based learning activities for effective L&D program administration.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Cohort Edit",
    description:
      "Edit learning cohort for teaching assistant training programs. Manage group settings and coordinate group-based learning activities for effective L&D program administration.",
  };
}

/** ---- Strongly-typed server action ---- */
async function updateCohort(input: UpdateCohortIn): Promise<UpdateCohortOut> {
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
  // Check cohort access by fetching detail (will return 403 if no access)
  let cohortDetail: CohortDetailOut;
  try {
    cohortDetail = await getCohort(cohortId);
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="cohort"
          redirectPath="/create/cohorts"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }

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
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CohortDetailIn,
  CohortDetailOut,
  UpdateCohortIn,
  UpdateCohortOut,
};
