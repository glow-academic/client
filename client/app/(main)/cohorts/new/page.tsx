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

/** ---- Strong types from OpenAPI ---- */
type CohortNewIn = InputOf<"/api/v3/cohorts/new", "post">;
type CohortNewOut = OutputOf<"/api/v3/cohorts/new", "post">;
type CreateCohortIn = InputOf<"/api/v3/cohorts/create", "post">;
type CreateCohortOut = OutputOf<"/api/v3/cohorts/create", "post">;

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
    default_profile: boolean;
    requests_in_last_day: number;
    can_edit: boolean;
    can_delete: boolean;
  }>;
  cohort_mapping: Record<string, { name: string; description: string }>;
  department_mapping: Record<string, { name: string; description: string }>;
};

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getCohortDefault = async (profileId: string): Promise<CohortNewOut> => {
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
async function createCohort(input: CreateCohortIn): Promise<CreateCohortOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/cohorts/create", input);
}

/** ---- Server action for searching profiles to add to cohort ---- */
async function searchCohortProfile(
  input: CohortSearchProfileIn
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

  return (
    <div
      className="space-y-6"
      data-page="cohort-new"
      aria-label="Create new cohort page"
    >
      <Cohort
        cohortDetailDefault={cohortDetailDefault}
        createCohortAction={createCohort}
        searchAddStaff={searchCohortProfile}
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
