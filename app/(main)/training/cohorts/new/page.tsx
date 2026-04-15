/**
 * app/(main)/training/cohorts/new/page.tsx
 * New cohort page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 01/12/2026
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Cohort from "@/components/artifacts/cohort/Cohort";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type GetCohortIn = InputOf<"/cohorts/get", "post">;
type GetCohortOut = OutputOf<"/cohorts/get", "post">;
type CreateCohortIn = InputOf<"/cohorts/create", "post">;
type CreateCohortOut = OutputOf<"/cohorts/create", "post">;
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
const getCohortDefault = async (input: GetCohortIn): Promise<GetCohortOut> => {
  return api.post("/cohorts/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createCohort(input: CreateCohortIn): Promise<CreateCohortOut> {
  "use server";
  return api.post("/cohorts/create", input);
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
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/cohorts/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.new.title,
    description: context.page_metadata?.new.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function NewCohortPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers (until /cohorts/context returns full profile)
  const { profileData, snapshot } = await getLayoutContextData(session);

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
    descriptionSearch: parseAsString,
    simulationSearch: parseAsString,
    simulationShowSelected: parseAsBoolean,
    profileSearch: parseAsString,
    profileShowSelected: parseAsBoolean,
  };
  const loadCohortSearchParams = createLoader(cohortSearchParams);
  const q = loadCohortSearchParams(searchParamsObj);

  // Fetch default cohort detail server-side with filter params and draft_id
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

  const [cohortData, draftsResult, groupResult] = await Promise.all([
    getCohortDefault(input),
    api.post("/cohorts/drafts", {}),
    api.post("/cohorts/group", { body: {} } as GroupCohortIn),
  ]);

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
          { title: "New Cohort" },
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
          data-page="cohort-new"
          aria-label="Create new cohort page"
        >
          <Cohort
            key={q.draftId || "no-draft"}
            cohortData={cohortData}
            createCohortAction={createCohort}
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
