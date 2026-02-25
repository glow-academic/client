/**
 * app/(main)/training/cohorts/[cohortId]/page.tsx
 * Cohort edit page for the cohort.
 * @AshokSaravanan222 & @siladiea
 * 01/12/2026
 */

import Cohort from "@/components/artifacts/cohort/Cohort";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetCohortIn = InputOf<"/api/v4/artifacts/cohorts/get", "post">;
type GetCohortOut = OutputOf<"/api/v4/artifacts/cohorts/get", "post">;
type SaveCohortIn = InputOf<"/api/v4/artifacts/cohorts/save", "post">;
type SaveCohortOut = OutputOf<"/api/v4/artifacts/cohorts/save", "post">;
type PatchCohortDraftIn = InputOf<"/api/v4/artifacts/cohorts/draft", "patch">;
type PatchCohortDraftOut = OutputOf<"/api/v4/artifacts/cohorts/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftSimulationPositionsIn = InputOf<
  "/api/v4/resources/simulation_positions",
  "post"
>;
type CreateDraftSimulationPositionsOut = OutputOf<
  "/api/v4/resources/simulation_positions",
  "post"
>;
type CreateDraftProfilePersonasIn = InputOf<
  "/api/v4/resources/profile_personas",
  "post"
>;
type CreateDraftProfilePersonasOut = OutputOf<
  "/api/v4/resources/profile_personas",
  "post"
>;

// Link types for tool call tracking
type LinkNamesIn = InputOf<"/api/v4/resources/names/link", "post">;
type LinkNamesOut = OutputOf<"/api/v4/resources/names/link", "post">;
type LinkDescriptionsIn = InputOf<"/api/v4/resources/descriptions/link", "post">;
type LinkDescriptionsOut = OutputOf<"/api/v4/resources/descriptions/link", "post">;
type LinkFlagsIn = InputOf<"/api/v4/resources/flags/link", "post">;
type LinkFlagsOut = OutputOf<"/api/v4/resources/flags/link", "post">;
type LinkDepartmentsIn = InputOf<"/api/v4/resources/departments/link", "post">;
type LinkDepartmentsOut = OutputOf<"/api/v4/resources/departments/link", "post">;
type LinkSimulationsIn = InputOf<"/api/v4/resources/simulations/link", "post">;
type LinkSimulationsOut = OutputOf<"/api/v4/resources/simulations/link", "post">;
type LinkSimulationPositionsIn = InputOf<"/api/v4/resources/simulation_positions/link", "post">;
type LinkSimulationPositionsOut = OutputOf<"/api/v4/resources/simulation_positions/link", "post">;
type LinkSimulationAvailabilityIn = InputOf<"/api/v4/resources/simulation_availability/link", "post">;
type LinkSimulationAvailabilityOut = OutputOf<"/api/v4/resources/simulation_availability/link", "post">;
type LinkProfilesIn = InputOf<"/api/v4/resources/profiles/link", "post">;
type LinkProfilesOut = OutputOf<"/api/v4/resources/profiles/link", "post">;
type LinkProfilePersonasIn = InputOf<"/api/v4/resources/profile_personas/link", "post">;
type LinkProfilePersonasOut = OutputOf<"/api/v4/resources/profile_personas/link", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getCohort = async (input: GetCohortIn): Promise<GetCohortOut> => {
  return api.post("/artifacts/cohorts/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/cohorts/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/cohorts/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/cohorts/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}): Promise<Metadata> {
  const { cohortId } = await params;
  const docs = await getDocs({ body: { entity_id: cohortId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveCohort(input: SaveCohortIn): Promise<SaveCohortOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/cohorts/save", input);
}

async function patchCohortDraft(
  input: PatchCohortDraftIn
): Promise<PatchCohortDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/artifacts/cohorts/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/descriptions", input);
}

async function createDraftSimulationPositions(
  input: CreateDraftSimulationPositionsIn
): Promise<CreateDraftSimulationPositionsOut> {
  "use server";
  return api.post("/resources/simulation_positions", input);
}

async function createDraftProfilePersonas(
  input: CreateDraftProfilePersonasIn
): Promise<CreateDraftProfilePersonasOut> {
  "use server";
  return api.post("/resources/profile_personas", input);
}

// Link server actions for tool call tracking
async function linkNames(input: LinkNamesIn): Promise<LinkNamesOut> {
  "use server";
  return api.post("/resources/names/link", input);
}

async function linkDescriptions(input: LinkDescriptionsIn): Promise<LinkDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions/link", input);
}

async function linkFlags(input: LinkFlagsIn): Promise<LinkFlagsOut> {
  "use server";
  return api.post("/resources/flags/link", input);
}

async function linkDepartments(input: LinkDepartmentsIn): Promise<LinkDepartmentsOut> {
  "use server";
  return api.post("/resources/departments/link", input);
}

async function linkSimulations(input: LinkSimulationsIn): Promise<LinkSimulationsOut> {
  "use server";
  return api.post("/resources/simulations/link", input);
}

async function linkSimulationPositions(input: LinkSimulationPositionsIn): Promise<LinkSimulationPositionsOut> {
  "use server";
  return api.post("/resources/simulation_positions/link", input);
}

async function linkSimulationAvailability(input: LinkSimulationAvailabilityIn): Promise<LinkSimulationAvailabilityOut> {
  "use server";
  return api.post("/resources/simulation_availability/link", input);
}

async function linkProfiles(input: LinkProfilesIn): Promise<LinkProfilesOut> {
  "use server";
  return api.post("/resources/profiles/link", input);
}

async function linkProfilePersonas(input: LinkProfilePersonasIn): Promise<LinkProfilePersonasOut> {
  "use server";
  return api.post("/resources/profile_personas/link", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function CohortEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { cohortId } = await params;

  // Parse search params using nuqs
  const params_obj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params_obj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Inline server-side parsers for cohort search params
  const cohortSearchParams = {
    draftId: parseAsString,
    // Search/filter params
    descriptionSearch: parseAsString,
    simulationSearch: parseAsString,
    simulationShowSelected: parseAsBoolean,
    profileSearch: parseAsString,
    profileShowSelected: parseAsBoolean,
  };
  const loadCohortSearchParams = createLoader(cohortSearchParams);
  const q = loadCohortSearchParams(searchParamsObj);

  // Check cohort access by fetching detail (will return 403 if no access)
  let cohortData: GetCohortOut;
  try {
    const input: GetCohortIn = {
      body: {
        cohort_id: cohortId,
        draft_id: q.draftId ?? null,
        descriptions_search: q.descriptionSearch ?? null,
        simulation_search: q.simulationSearch ?? null,
        simulation_show_selected: q.simulationShowSelected ?? null,
        profile_search: q.profileSearch ?? null,
        profile_show_selected: q.profileShowSelected ?? null,
        mcp: false,
      } as GetCohortIn["body"],
    };
    cohortData = await getCohort(input);
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
          redirectPath="/training/cohorts"
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
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        cohortId={cohortId}
        cohortData={cohortData}
        saveCohortAction={saveCohort}
        patchCohortDraftAction={patchCohortDraft}
        createNamesAction={createDraftNames}
        createDescriptionsAction={createDraftDescriptions}
        createSimulationPositionsAction={createDraftSimulationPositions}
        createProfilePersonasAction={createDraftProfilePersonas}
        linkNamesAction={linkNames}
        linkDescriptionsAction={linkDescriptions}
        linkFlagsAction={linkFlags}
        linkDepartmentsAction={linkDepartments}
        linkSimulationsAction={linkSimulations}
        linkSimulationPositionsAction={linkSimulationPositions}
        linkSimulationAvailabilityAction={linkSimulationAvailability}
        linkProfilesAction={linkProfiles}
        linkProfilePersonasAction={linkProfilePersonas}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetCohortIn,
  GetCohortOut,
  PatchCohortDraftIn,
  PatchCohortDraftOut,
  SaveCohortIn,
  SaveCohortOut,
};
