/**
 * app/(main)/create/simulations/new/page.tsx
 * New simulation page for the simulations section.
 * @AshokSaravanan222 & @siladiea
 * 01/12/2026
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Simulation from "@/components/artifacts/simulation/Simulation";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetSimulationIn = InputOf<"/simulations/get", "post">;
type GetSimulationOut = OutputOf<"/simulations/get", "post">;
type CreateSimulationIn = InputOf<"/simulations/create", "post">;
type CreateSimulationOut = OutputOf<"/simulations/create", "post">;
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
type CreateDraftScenarioFlagsIn = InputOf<
  "/api/v5/resources/scenario_flags",
  "post"
>;
type CreateDraftScenarioFlagsOut = OutputOf<
  "/api/v5/resources/scenario_flags",
  "post"
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

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for new pages.
 */
const getSimulationDefault = async (
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

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createSimulation(
  input: CreateSimulationIn
): Promise<CreateSimulationOut> {
  "use server";
  return api.post("/simulations/create", input);
}

async function patchSimulationDraft(
  input: PatchSimulationDraftIn
): Promise<PatchSimulationDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/simulations/draft", input);
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

async function createDraftScenarioFlags(
  input: CreateDraftScenarioFlagsIn
): Promise<CreateDraftScenarioFlagsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/scenario_flags", input);
}

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

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/simulations/docs", "post">;
type DocsOut = OutputOf<"/simulations/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/simulations/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.page_metadata?.new.title, description: docs.page_metadata?.new.description };
}

export default async function NewSimulationPage({
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

  // Inline server-side parsers for simulation search params (navigation/search params only)
  const simulationSearchParams = {
    draftId: parseAsString,
    // Search/filter params
    scenarioSearch: parseAsString,
    scenarioShowSelected: parseAsBoolean,
  };
  const loadSimulationSearchParams = createLoader(simulationSearchParams);
  const q = loadSimulationSearchParams(searchParamsObj);

  // Fetch default simulation detail server-side with filter params and draft_id
  const input: GetSimulationIn = {
    body: {
      simulation_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
      scenario_search: q.scenarioSearch ?? null,
      scenario_show_selected: q.scenarioShowSelected ?? null,
      filter_scenario_ids: null, // Not used in new mode
    } as GetSimulationIn["body"],
  };

  const draftsResult = await api.post("/simulations/drafts", {});

  let simulationDataDefault: GetSimulationOut | null = null;
  try {
    simulationDataDefault = await getSimulationDefault(input);
  } catch (error) {
    // Check for 403 (access denied) - show UnifiedAccessDenied component
    if (
      error instanceof Error &&
      (error.message.includes("403") ||
        error.message.includes("access denied") ||
        error.message.includes("Access denied"))
    ) {
      return <UnifiedAccessDenied reason="department" resourceType="simulation" redirectPath="/training/simulations" />;
    }
    // Re-throw other errors
    throw error;
  }

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <PageHeader
        breadcrumbs={[
          { title: "Training", section: "training", url: "/training" },
          { title: "Simulations", section: "simulations", url: "/training/simulations" },
          { title: "New Simulation" },
        ]}
        toolbar={<SaveToolbar />}
      />
      <div
        className="space-y-6 px-4"
        data-page="simulation-new"
        aria-label="Create new simulation page"
      >
        <Simulation
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          simulationData={simulationDataDefault}
          createSimulationAction={createSimulation}
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
    </DraftProviderClient>
  );
}

// Types are now defined inline in components using InputOf/OutputOf
