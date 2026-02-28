/**
 * app/(main)/training/simulations/[simulationId]/page.tsx
 * Simulation editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import type { ScenarioFlagsProps } from "@/components/resources/ScenarioFlags";
import Simulation from "@/components/artifacts/simulation/Simulation";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";
import { resolveGroupId } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type GetSimulationIn = InputOf<"/api/v4/artifacts/simulations/get", "post">;
type GetSimulationOut = OutputOf<"/api/v4/artifacts/simulations/get", "post">;
type SaveSimulationIn = InputOf<"/api/v4/artifacts/simulations/save", "post">;
type SaveSimulationOut = OutputOf<"/api/v4/artifacts/simulations/save", "post">;
type PatchSimulationDraftIn = InputOf<"/api/v4/artifacts/simulations/draft", "patch">;
type PatchSimulationDraftOut = OutputOf<"/api/v4/artifacts/simulations/draft", "patch">;
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
type CreateDraftScenarioFlagsAction = NonNullable<
  ScenarioFlagsProps["createScenarioFlagsAction"]
>;
type CreateDraftScenarioPositionsIn = InputOf<
  "/api/v4/resources/scenario_positions",
  "post"
>;
type CreateDraftScenarioPositionsOut = OutputOf<
  "/api/v4/resources/scenario_positions",
  "post"
>;
type CreateDraftScenarioRubricsIn = InputOf<
  "/api/v4/resources/scenario_rubrics",
  "post"
>;
type CreateDraftScenarioRubricsOut = OutputOf<
  "/api/v4/resources/scenario_rubrics",
  "post"
>;
type CreateDraftScenarioTimeLimitsIn = InputOf<
  "/api/v4/resources/scenario_time_limits",
  "post"
>;
type CreateDraftScenarioTimeLimitsOut = OutputOf<
  "/api/v4/resources/scenario_time_limits",
  "post"
>;

// Export types for client component (type-only imports)
export type {
  PatchSimulationDraftIn,
  PatchSimulationDraftOut,
  SaveSimulationIn,
  SaveSimulationOut,
  GetSimulationOut as SimulationDataOut,
};

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSimulation = async (
  input: GetSimulationIn
): Promise<GetSimulationOut> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const result = await api.post("/artifacts/simulations/get", input, {
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

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/simulations/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/simulations/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/simulations/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ simulationId: string }>;
}): Promise<Metadata> {
  const { simulationId } = await params;
  const docs = await getDocs({ body: { entity_id: simulationId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveSimulation(
  input: SaveSimulationIn
): Promise<SaveSimulationOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/simulations/save", input);
}

async function patchSimulationDraft(
  input: PatchSimulationDraftIn
): Promise<PatchSimulationDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/artifacts/simulations/draft", input);
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

const createDraftScenarioFlags: CreateDraftScenarioFlagsAction = async (
  input
) => {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/scenario_positions", input);
}

async function createDraftScenarioRubrics(
  input: CreateDraftScenarioRubricsIn
): Promise<CreateDraftScenarioRubricsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/scenario_rubrics", input);
}

async function createDraftScenarioTimeLimits(
  input: CreateDraftScenarioTimeLimitsIn
): Promise<CreateDraftScenarioTimeLimitsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/scenario_time_limits", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function EditSimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ simulationId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { simulationId } = await params;
  // Access control is handled server-side in layout
  // profileId removed - comes from X-Profile-Id header automatically
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

  // Inline server-side parsers for simulation search params
  // Only include search/filter params, not draft data (scenarioIds comes from draft payload)
  const simulationSearchParams = {
    draftId: parseAsString,
    scenarioSearch: parseAsString,
  };
  const loadSimulationSearchParams = createLoader(simulationSearchParams);
  const q = loadSimulationSearchParams(searchParamsObj);

  // Resolve group_id from layout context (cached per request)
  const groupId = await resolveGroupId(q.draftId ?? null, "simulation");

  // Fetch simulation detail (always fresh - source of truth) with draft_id and filters
  // filter_scenario_ids will come from draft payload if draft_id is provided
  try {
    const input: GetSimulationIn = {
      body: {
        simulation_id: simulationId,
        draft_id: q.draftId ?? null,
        group_id: groupId,
        scenario_search: q.scenarioSearch ?? null,
        // filter_scenario_ids comes from draft payload, not URL params
        filter_scenario_ids: null,
      } as GetSimulationIn["body"],
    };
    const simulationData = await getSimulation(input);

    return (
      <div
        className="space-y-6"
        data-page="simulation-edit"
        data-simulation-id={simulationId}
      >
        <Simulation
          simulationId={simulationId}
          simulationData={simulationData}
          saveSimulationAction={saveSimulation}
          patchSimulationDraftAction={patchSimulationDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createScenarioFlagsAction={createDraftScenarioFlags}
          createScenarioPositionsAction={createDraftScenarioPositions}
          createScenarioRubricsAction={
            createDraftScenarioRubrics
          }
          createScenarioTimeLimitsAction={
            createDraftScenarioTimeLimits
          }
        />
      </div>
    );
  } catch (error: unknown) {
    // Check for 403 (access denied) - show UnifiedAccessDenied component
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
    // Re-throw other errors
    throw error;
  }
}
