/**
 * app/(main)/create/cohorts/new/page.tsx
 * New cohort page for the cohorts section.
 * @AshokSaravanan222 & @siladiea
 * 01/12/2026
 */

import Cohort from "@/components/artifacts/cohort/Cohort";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetCohortIn = InputOf<"/api/v5/artifacts/cohorts/get", "post">;
type GetCohortOut = OutputOf<"/api/v5/artifacts/cohorts/get", "post">;
type CreateCohortIn = InputOf<"/api/v5/artifacts/cohorts/create", "post">;
type CreateCohortOut = OutputOf<"/api/v5/artifacts/cohorts/create", "post">;
type PatchCohortDraftIn = InputOf<"/api/v5/artifacts/cohorts/draft", "patch">;
type PatchCohortDraftOut = OutputOf<"/api/v5/artifacts/cohorts/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftSimulationPositionsIn = InputOf<
  "/api/v5/resources/simulation_positions",
  "post"
>;
type CreateDraftSimulationPositionsOut = OutputOf<
  "/api/v5/resources/simulation_positions",
  "post"
>;
type CreateDraftProfilePersonasIn = InputOf<
  "/api/v5/resources/profile_personas",
  "post"
>;
type CreateDraftProfilePersonasOut = OutputOf<
  "/api/v5/resources/profile_personas",
  "post"
>;


/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getCohortDefault = async (input: GetCohortIn): Promise<GetCohortOut> => {
  return api.post("/artifacts/cohorts/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createCohort(input: CreateCohortIn): Promise<CreateCohortOut> {
  "use server";
  return api.post("/artifacts/cohorts/create", input);
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
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/simulation_positions", input);
}

async function createDraftProfilePersonas(
  input: CreateDraftProfilePersonasIn
): Promise<CreateDraftProfilePersonasOut> {
  "use server";
  return api.post("/resources/profile_personas", input);
}


/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/cohorts/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/cohorts/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/cohorts/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
}

export default async function NewCohortPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params using nuqs
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
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

  // Fetch default cohort detail server-side with filter params and draft_id
  // Note: cohort_id is null for new mode
  const input: GetCohortIn = {
    body: {
      cohort_id: null,
      draft_id: q.draftId ?? null,
      descriptions_search: q.descriptionSearch ?? null,
      simulation_search: q.simulationSearch ?? null,
      simulation_show_selected: q.simulationShowSelected ?? null,
      profile_search: q.profileSearch ?? null,
      profile_show_selected: q.profileShowSelected ?? null,
      mcp: false,
    } as GetCohortIn["body"],
  };
  const [cohortData, draftsResult] = await Promise.all([
    getCohortDefault(input),
    api.post("/artifacts/cohorts/drafts", {})
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <PageHeader
        breadcrumbs={[
          { title: "Training", section: "training", url: "/training" },
          { title: "Cohorts", section: "cohorts", url: "/training/cohorts" },
          { title: "New Cohort" },
        ]}
        toolbar={<SaveToolbar />}
      />
      <div
        className="space-y-6 px-4"
        data-page="cohort-new"
        aria-label="Create new cohort page"
      >
        <Cohort
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          cohortData={cohortData}
          createCohortAction={createCohort}
          patchCohortDraftAction={patchCohortDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createSimulationPositionsAction={createDraftSimulationPositions}
          createProfilePersonasAction={createDraftProfilePersonas}
        />
      </div>
    </DraftProviderClient>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetCohortIn,
  GetCohortOut,
  PatchCohortDraftIn,
  PatchCohortDraftOut,
  CreateCohortIn,
  CreateCohortOut,
};
