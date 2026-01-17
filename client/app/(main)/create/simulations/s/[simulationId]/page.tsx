/**
 * app/create/simulations/s/[simulationId]/page.tsx
 * Simulation editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Simulation from "@/components/simulations/Simulation";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetSimulationIn = InputOf<"/api/v4/simulations/get", "post">;
type GetSimulationOut = OutputOf<"/api/v4/simulations/get", "post">;
type SaveSimulationIn = InputOf<"/api/v4/simulations/save", "post">;
type SaveSimulationOut = OutputOf<"/api/v4/simulations/save", "post">;
type PatchSimulationDraftIn = InputOf<"/api/v4/simulations/draft", "patch">;
type PatchSimulationDraftOut = OutputOf<"/api/v4/simulations/draft", "patch">;
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
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftScenariosIn = InputOf<"/api/v4/resources/scenarios", "post">;
type CreateDraftScenariosOut = OutputOf<"/api/v4/resources/scenarios", "post">;
type CreateDraftScenarioFlagsIn = InputOf<
  "/api/v4/resources/simulation_scenario_flags",
  "post"
>;
type CreateDraftScenarioFlagsOut = OutputOf<
  "/api/v4/resources/simulation_scenario_flags",
  "post"
>;
type CreateDraftScenarioPositionsIn = InputOf<
  "/api/v4/resources/scenario_positions",
  "post"
>;
type CreateDraftScenarioPositionsOut = OutputOf<
  "/api/v4/resources/scenario_positions",
  "post"
>;
type CreateDraftScenarioRubricGradeAgentsIn = InputOf<
  "/api/v4/resources/scenario_rubric_grade_agents",
  "post"
>;
type CreateDraftScenarioRubricGradeAgentsOut = OutputOf<
  "/api/v4/resources/scenario_rubric_grade_agents",
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

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ simulationId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { simulationId } = await params;
  // profileId removed - comes from X-Profile-Id header automatically

  try {
    const input: GetSimulationIn = {
      body: {
        simulation_id: simulationId,
        draft_id: null,
      } as GetSimulationIn["body"],
    };
    const simulation = await getSimulation(input);
    return {
      title: `${simulation?.name_resource?.name || "Simulation"}`,
      description: `${simulation?.name_resource?.name ? `${simulation.name_resource.name} - ` : ""}Teaching practice simulation for graduate teaching assistant training. Practice pedagogical techniques and student interaction strategies through realistic educational scenarios and simulation-based learning.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Simulation",
    description:
      "Teaching practice simulation for graduate teaching assistant training. Practice pedagogical techniques and student interaction strategies through realistic educational scenarios and simulation-based learning.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveSimulation(
  input: SaveSimulationIn
): Promise<SaveSimulationOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/simulations/save", input);
}

async function patchSimulationDraft(
  input: PatchSimulationDraftIn
): Promise<PatchSimulationDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // TODO: Investigate - simulations/draft endpoint doesn't exist on server
  throw new Error("simulations/draft endpoint doesn't exist on server");
  // return api.patch("/simulations/draft", input);
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

async function createDraftDepartments(
  input: CreateDraftDepartmentsIn
): Promise<CreateDraftDepartmentsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/departments", input);
}

async function createDraftFlags(
  input: CreateDraftFlagsIn
): Promise<CreateDraftFlagsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/flags", input);
}

async function createDraftScenarios(
  input: CreateDraftScenariosIn
): Promise<CreateDraftScenariosOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/scenarios", input);
}

async function createDraftScenarioFlags(
  input: CreateDraftScenarioFlagsIn
): Promise<CreateDraftScenarioFlagsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/simulation_scenario_flags", input);
}

async function createDraftScenarioPositions(
  input: CreateDraftScenarioPositionsIn
): Promise<CreateDraftScenarioPositionsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/scenario_positions", input);
}

async function createDraftScenarioRubricGradeAgents(
  input: CreateDraftScenarioRubricGradeAgentsIn
): Promise<CreateDraftScenarioRubricGradeAgentsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/scenario_rubric_grade_agents", input);
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
    scenarioShowSelected: parseAsBoolean,
  };
  const loadSimulationSearchParams = createLoader(simulationSearchParams);
  const q = loadSimulationSearchParams(searchParamsObj);

  // Fetch simulation detail (always fresh - source of truth) with draft_id and filters
  // filter_scenario_ids will come from draft payload if draft_id is provided
  try {
    const input: GetSimulationIn = {
      body: {
        simulation_id: simulationId,
        draft_id: q.draftId ?? null,
        scenario_search: q.scenarioSearch ?? null,
        scenario_show_selected: q.scenarioShowSelected ?? null,
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
          createDepartmentsAction={createDraftDepartments}
          createFlagsAction={createDraftFlags}
          createScenariosAction={createDraftScenarios}
          createScenarioFlagsAction={createDraftScenarioFlags}
          createScenarioPositionsAction={createDraftScenarioPositions}
          createScenarioRubricGradeAgentsAction={
            createDraftScenarioRubricGradeAgents
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
          redirectPath="/create/simulations"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}
