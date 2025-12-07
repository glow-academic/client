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

/** ---- Strong types from OpenAPI ---- */
type CohortDetailIn = InputOf<"/api/v3/cohorts/detail", "post">;
type CohortDetailOut = OutputOf<"/api/v3/cohorts/detail", "post">;
type UpdateCohortIn = InputOf<"/api/v3/cohorts/update", "post">;
type UpdateCohortOut = OutputOf<"/api/v3/cohorts/update", "post">;

/** ---- Types for search-profile endpoint (manual until OpenAPI schema updated) ---- */
type CohortSearchProfileIn = {
  body: {
    cohortId: string | null;
    query: string | null;
    departmentIds: string[] | null;
    limit: number;
    profileId: string;
  };
};
type CohortSearchProfileOut = {
  staff: Array<{
    profile_id: string;
    first_name: string;
    last_name: string;
    emails: string[];
    primary_email: string | null;
    name: string;
    role: string;
    initials: string;
    active: boolean;
    last_active: string | null;
    cohort_ids: string[];
    department_ids: string[];
    primary_department_id: string;
    requests_per_day: number | null;
    total_requests: number;
    requests_in_last_day: number;
    can_edit: boolean;
    can_delete: boolean;
  }>;
  cohort_mapping: Record<string, { name: string; description: string }>;
  department_mapping: Record<string, { name: string; description: string }>;
};
/** ---- Derived types from server responses ---- */
type CohortStaffItem = CohortDetailOut["staff"][number];

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getCohort = async (
  cohortId: string,
  profileId: string,
): Promise<CohortDetailOut> => {
  return api.post(
    "/cohorts/detail",
    { body: { cohortId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ cohortId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { cohortId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const cohort = await getCohort(cohortId, profileId);
    return {
      title: `${cohort?.title || "Cohort"} Edit`,
      description: `${cohort?.title ? `${cohort.title} - ` : ""}Edit learning cohort for teaching assistant training programs.${cohort?.description ? ` ${cohort.description}` : ""} Manage group settings and coordinate group-based learning activities for effective L&D program administration.`,
    };
  } catch {
    return {
      title: "Cohort Edit",
      description: "Edit learning cohort for teaching assistant training programs. Manage group settings and coordinate group-based learning activities for effective L&D program administration.",
    };
  }
}

/** ---- Strongly-typed server action ---- */
async function updateCohort(input: UpdateCohortIn): Promise<UpdateCohortOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/cohorts/update", input);
}

/** ---- Server action for searching profiles to add to cohort ---- */
async function searchCohortProfile(
  input: CohortSearchProfileIn,
): Promise<CohortSearchProfileOut> {
  "use server";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (api.post as any)("/cohorts/search-profile", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  }) as Promise<CohortSearchProfileOut>;
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
        searchAddStaff={searchCohortProfile}
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
