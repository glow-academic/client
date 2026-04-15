/**
 * app/(main)/training/cohorts/[cohortId]/page.tsx
 * Cohort edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 01/12/2026
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Cohort from "@/components/artifacts/cohort/Cohort";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type GetCohortIn = InputOf<"/cohorts/get", "post">;
type GetCohortOut = OutputOf<"/cohorts/get", "post">;
type UpdateCohortIn = InputOf<"/cohorts/update", "post">;
type UpdateCohortOut = OutputOf<"/cohorts/update", "post">;
type PatchCohortDraftIn = InputOf<"/cohorts/draft", "patch">;
type PatchCohortDraftOut = OutputOf<"/cohorts/draft", "patch">;
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
type GroupCohortIn = InputOf<"/cohorts/group", "post">;
type GroupCohortOut = OutputOf<"/cohorts/group", "post">;
type GenerateCohortIn = InputOf<"/cohorts/generate", "post">;
type GenerateCohortOut = OutputOf<"/cohorts/generate", "post">;
type ProblemCohortIn = InputOf<"/cohorts/problem", "post">;
type ProblemCohortOut = OutputOf<"/cohorts/problem", "post">;
type ContextIn = InputOf<"/cohorts/context", "post">;
type ContextOut = OutputOf<"/cohorts/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getCohort = async (input: GetCohortIn): Promise<GetCohortOut> => {
  return api.post("/cohorts/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions ---- */
async function updateCohort(input: UpdateCohortIn): Promise<UpdateCohortOut> {
  "use server";
  return api.post("/cohorts/update", input);
}

async function patchCohortDraft(
  input: PatchCohortDraftIn
): Promise<PatchCohortDraftOut> {
  "use server";
  return api.patch("/cohorts/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
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

async function generateCohort(
  input: GenerateCohortIn
): Promise<GenerateCohortOut> {
  "use server";
  return api.post("/cohorts/generate", input);
}

async function getCohortGroupHistory(groupId: string): Promise<GroupCohortOut> {
  "use server";
  return api.post("/cohorts/group", { body: { group_id: groupId } } as GroupCohortIn);
}

type GenerationsIn = InputOf<"/cohorts/generations", "post">;
type GenerationsOut = OutputOf<"/cohorts/generations", "post">;

async function searchCohortGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/cohorts/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createCohortProblem(input: ProblemCohortIn): Promise<ProblemCohortOut> {
  "use server";
  return api.post("/cohorts/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}): Promise<Metadata> {
  const { cohortId } = await params;
  const context = await api.post("/cohorts/context", { body: { entity_id: cohortId } } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.detail.title,
    description: context.page_metadata?.detail.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function CohortEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { cohortId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

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
    descriptionSearch: parseAsString,
    simulationSearch: parseAsString,
    simulationShowSelected: parseAsBoolean,
    profileSearch: parseAsString,
    profileShowSelected: parseAsBoolean,
  };
  const loadCohortSearchParams = createLoader(cohortSearchParams);
  const q = loadCohortSearchParams(searchParamsObj);

  // Check cohort access by fetching detail (will return 403 if no access)
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

    const [cohortData, context, draftsResult, groupResult] = await Promise.all([
      getCohort(input),
      api.post("/cohorts/context", { body: { entity_id: cohortId } } as ContextIn) as Promise<ContextOut>,
      api.post("/cohorts/drafts", {}),
      api.post("/cohorts/group", { body: {} } as GroupCohortIn),
    ]);

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <FullPageLayout
          profileData={profileData}
          sessionSnapshot={snapshot}
          initialSidebarOpen={initialSidebarOpen}
          initialPanelOpen={initialPanelOpen}
          sidebarProps={{
            activeSection: "cohort",
            createFeedback: createCohortProblem,
          }}
          breadcrumbs={[
            { title: "Training", section: "training", url: "/training" },
            { title: "Cohorts", section: "cohorts", url: "/training/cohorts" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "cohort",
            groupId: (groupResult as GroupCohortOut & { group_id?: string })?.group_id ?? null,
            generateAction: generateCohort,
            permissions: [
              { artifact: "cohort", operation: "draft" },
              { artifact: "cohort", operation: "get" },
              { artifact: "cohort", operation: "docs" },
              { artifact: "cohort", operation: "group" },
            ],
            getGroupHistory: getCohortGroupHistory,
            searchGroups: searchCohortGroups,
          }}
        >
          <div
            className="space-y-6 px-4"
            data-page="cohort-edit"
            data-cohort-id={cohortId}
          >
            <Cohort
              key={q.draftId || "no-draft"}
              cohortId={cohortId}
              cohortData={cohortData}
              updateCohortAction={updateCohort}
              patchCohortDraftAction={patchCohortDraft}
              createNamesAction={createDraftNames}
              createDescriptionsAction={createDraftDescriptions}
              createSimulationPositionsAction={createDraftSimulationPositions}
              createProfilePersonasAction={createDraftProfilePersonas}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
    );
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
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetCohortIn,
  GetCohortOut,
  PatchCohortDraftIn,
  PatchCohortDraftOut,
  UpdateCohortIn,
  UpdateCohortOut,
};
