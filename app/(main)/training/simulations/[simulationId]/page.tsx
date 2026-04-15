/**
 * app/(main)/training/simulations/[simulationId]/page.tsx
 * Simulation edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import type { ScenarioFlagsProps } from "@/components/resources/ScenarioFlags";
import Simulation from "@/components/artifacts/simulation/Simulation";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetSimulationIn = InputOf<"/simulations/get", "post">;
type GetSimulationOut = OutputOf<"/simulations/get", "post">;
type UpdateSimulationIn = InputOf<"/simulations/update", "post">;
type UpdateSimulationOut = OutputOf<"/simulations/update", "post">;
type PatchSimulationDraftIn = InputOf<"/simulations/draft", "patch">;
type PatchSimulationDraftOut = OutputOf<"/simulations/draft", "patch">;
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
type CreateDraftScenarioFlagsAction = NonNullable<
  ScenarioFlagsProps["createScenarioFlagsAction"]
>;
type CreateDraftScenarioPositionsIn = InputOf<
  "/api/v5/resources/scenario_positions",
  "post"
>;
type CreateDraftScenarioPositionsOut = OutputOf<
  "/api/v5/resources/scenario_positions",
  "post"
>;
type CreateDraftScenarioRubricsIn = InputOf<
  "/api/v5/resources/scenario_rubrics",
  "post"
>;
type CreateDraftScenarioRubricsOut = OutputOf<
  "/api/v5/resources/scenario_rubrics",
  "post"
>;
type CreateDraftScenarioTimeLimitsIn = InputOf<
  "/api/v5/resources/scenario_time_limits",
  "post"
>;
type CreateDraftScenarioTimeLimitsOut = OutputOf<
  "/api/v5/resources/scenario_time_limits",
  "post"
>;
type GroupSimulationIn = InputOf<"/simulations/group", "post">;
type GroupSimulationOut = OutputOf<"/simulations/group", "post">;
type GenerateSimulationIn = InputOf<"/simulations/generate", "post">;
type GenerateSimulationOut = OutputOf<"/simulations/generate", "post">;
type ProblemSimulationIn = InputOf<"/simulations/problem", "post">;
type ProblemSimulationOut = OutputOf<"/simulations/problem", "post">;
type ContextIn = InputOf<"/simulations/context", "post">;
type ContextOut = OutputOf<"/simulations/context", "post">;

// Export types for client component (type-only imports)
export type {
  PatchSimulationDraftIn,
  PatchSimulationDraftOut,
  UpdateSimulationIn,
  UpdateSimulationOut,
  GetSimulationOut as SimulationDataOut,
};

/** ---- Direct fetch (no caching - source of truth) ---- */
const getSimulation = async (
  input: GetSimulationIn
): Promise<GetSimulationOut> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const result = await api.post("/simulations/get", input, {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout: Server took too long to respond");
    }
    throw error;
  }
};

/** ---- Strongly-typed server actions ---- */
async function updateSimulation(
  input: UpdateSimulationIn
): Promise<UpdateSimulationOut> {
  "use server";
  return api.post("/simulations/update", input);
}

async function patchSimulationDraft(
  input: PatchSimulationDraftIn
): Promise<PatchSimulationDraftOut> {
  "use server";
  return api.patch("/simulations/draft", input);
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

const createDraftScenarioFlags: CreateDraftScenarioFlagsAction = async (
  input
) => {
  "use server";
  return (api.post as unknown as (
    path: string,
    payload: Parameters<CreateDraftScenarioFlagsAction>[0]
  ) => ReturnType<CreateDraftScenarioFlagsAction>)(
    "/resources/scenario_flags",
    input
  );
};

async function createDraftScenarioPositions(
  input: CreateDraftScenarioPositionsIn
): Promise<CreateDraftScenarioPositionsOut> {
  "use server";
  return api.post("/resources/scenario_positions", input);
}

async function createDraftScenarioRubrics(
  input: CreateDraftScenarioRubricsIn
): Promise<CreateDraftScenarioRubricsOut> {
  "use server";
  return api.post("/resources/scenario_rubrics", input);
}

async function createDraftScenarioTimeLimits(
  input: CreateDraftScenarioTimeLimitsIn
): Promise<CreateDraftScenarioTimeLimitsOut> {
  "use server";
  return api.post("/resources/scenario_time_limits", input);
}

async function generateSimulation(
  input: GenerateSimulationIn
): Promise<GenerateSimulationOut> {
  "use server";
  return api.post("/simulations/generate", input);
}

async function getSimulationGroupHistory(groupId: string): Promise<GroupSimulationOut> {
  "use server";
  return api.post("/simulations/group", { body: { group_id: groupId } } as GroupSimulationIn);
}

type GenerationsIn = InputOf<"/simulations/generations", "post">;
type GenerationsOut = OutputOf<"/simulations/generations", "post">;

async function searchSimulationGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/simulations/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createSimulationProblem(input: ProblemSimulationIn): Promise<ProblemSimulationOut> {
  "use server";
  return api.post("/simulations/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ simulationId: string }>;
}): Promise<Metadata> {
  const { simulationId } = await params;
  const context = await api.post("/simulations/context", { body: { entity_id: simulationId } } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.detail.title,
    description: context.page_metadata?.detail.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function EditSimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ simulationId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { simulationId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/simulations/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

  // Parse search params using nuqs
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  const simulationSearchParams = {
    draftId: parseAsString,
    scenarioSearch: parseAsString,
  };
  const loadSimulationSearchParams = createLoader(simulationSearchParams);
  const q = loadSimulationSearchParams(searchParamsObj);

  try {
    const input: GetSimulationIn = {
      body: {
        simulation_id: simulationId,
        draft_id: q.draftId ?? null,
        scenario_search: q.scenarioSearch ?? null,
        filter_scenario_ids: null,
      } as GetSimulationIn["body"],
    };

    const [simulationData, context, draftsResult, groupResult] = await Promise.all([
      getSimulation(input),
      api.post("/simulations/context", { body: { entity_id: simulationId } } as ContextIn) as Promise<ContextOut>,
      api.post("/simulations/drafts", {}),
      api.post("/simulations/group", { body: {} } as GroupSimulationIn),
    ]);

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <FullPageLayout
          profileData={context.profile}
          sessionSnapshot={snapshot}
          initialSidebarOpen={initialSidebarOpen}
          initialPanelOpen={initialPanelOpen}
          sidebarProps={{
            activeSection: "simulation",
            createFeedback: createSimulationProblem,
          }}
          breadcrumbs={[
            { title: "Training", section: "training", url: "/training" },
            { title: "Simulations", section: "simulations", url: "/training/simulations" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "simulation",
            groupId: (groupResult as GroupSimulationOut & { group_id?: string })?.group_id ?? null,
            generateAction: generateSimulation,
            permissions: [
              { artifact: "simulation", operation: "draft" },
              { artifact: "simulation", operation: "get" },
              { artifact: "simulation", operation: "docs" },
              { artifact: "simulation", operation: "group" },
            ],
            getGroupHistory: getSimulationGroupHistory,
            searchGroups: searchSimulationGroups,
          }}
        >
          <div
            className="space-y-6 px-4"
            data-page="simulation-edit"
            data-simulation-id={simulationId}
          >
            <Simulation
              simulationId={simulationId}
              simulationData={simulationData}
              updateSimulationAction={updateSimulation}
              patchSimulationDraftAction={patchSimulationDraft}
              createNamesAction={createDraftNames}
              createDescriptionsAction={createDraftDescriptions}
              createScenarioFlagsAction={createDraftScenarioFlags}
              createScenarioPositionsAction={createDraftScenarioPositions}
              createScenarioRubricsAction={createDraftScenarioRubrics}
              createScenarioTimeLimitsAction={createDraftScenarioTimeLimits}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
    );
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message.includes("403") ||
        error.message.includes("access denied") ||
        error.message.includes("Access denied") ||
        (error &&
          typeof error === "object" &&
          "status" in error &&
          error.status === 403))
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="simulation"
          redirectPath="/training/simulations"
        />
      );
    }
    throw error;
  }
}
