/**
 * app/(main)/create/cohorts/c/[cohortId]/page.tsx
 * Cohort edit page for the cohort.
 * @AshokSaravanan222 & @siladiea
 * 01/12/2026
 */

import Cohort from "@/components/cohorts/Cohort";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetCohortIn = InputOf<"/api/v4/cohorts/get", "post">;
type GetCohortOut = OutputOf<"/api/v4/cohorts/get", "post">;
type SaveCohortIn = InputOf<"/api/v4/cohorts/save", "post">;
type SaveCohortOut = OutputOf<"/api/v4/cohorts/save", "post">;
type PatchCohortDraftIn = InputOf<"/api/v4/cohorts/draft", "patch">;
type PatchCohortDraftOut = OutputOf<"/api/v4/cohorts/draft", "patch">;
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

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getCohort = async (input: GetCohortIn): Promise<GetCohortOut> => {
  return api.post("/cohorts/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ cohortId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { cohortId } = await params;

  try {
    const input: GetCohortIn = {
      body: {
        cohort_id: cohortId,
        draft_id: null,
        descriptions_search: null,
        simulation_search: null,
        simulation_show_selected: null,
        current_simulation_ids: null,
        mcp: false,
      } as GetCohortIn["body"],
    };
    const cohort = await getCohort(input);
    const cohortName = cohort?.name_resource?.name || "Cohort";
    return {
      title: `${cohortName} Edit`,
      description: `${cohortName} - Edit learning cohort for teaching assistant training programs. Manage group settings and coordinate group-based learning activities for effective L&D program administration.`,
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

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveCohort(input: SaveCohortIn): Promise<SaveCohortOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/cohorts/save", input);
}

async function patchCohortDraft(
  input: PatchCohortDraftIn
): Promise<PatchCohortDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/cohorts/draft", input);
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
        current_simulation_ids: null, // Will be extracted from draft payload or cohort in SQL
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
