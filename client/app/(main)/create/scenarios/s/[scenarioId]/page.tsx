/**
 * app/create/scenarios/s/[scenarioId]/page.tsx
 * Scenario editing page with server actions
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";

import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import Scenario from "@/components/scenarios/Scenario";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ScenarioDetailIn = InputOf<"/api/v3/scenarios/detail", "post">;
type ScenarioDetailOut = OutputOf<"/api/v3/scenarios/detail", "post">;
type ScenarioDetailDefaultIn = InputOf<
  "/api/v3/scenarios/detail-default",
  "post"
>;
type ScenarioDetailDefaultOut = OutputOf<
  "/api/v3/scenarios/detail-default",
  "post"
>;
type CreateScenarioIn = InputOf<"/api/v3/scenarios/create", "post">;
type CreateScenarioOut = OutputOf<"/api/v3/scenarios/create", "post">;
type UpdateScenarioIn = InputOf<"/api/v3/scenarios/update", "post">;
type UpdateScenarioOut = OutputOf<"/api/v3/scenarios/update", "post">;
type GenerateAIScenarioIn = InputOf<"/api/v3/scenarios/generate-ai", "post">;
type GenerateAIScenarioOut = OutputOf<"/api/v3/scenarios/generate-ai", "post">;
type RandomizeScenarioIn = InputOf<"/api/v3/scenarios/randomize", "post">;
type RandomizeScenarioOut = OutputOf<"/api/v3/scenarios/randomize", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getScenario = async (
  scenarioId: string,
  profileId: string
): Promise<ScenarioDetailOut> => {
  return api.post(
    "/scenarios/detail",
    { body: { scenarioId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ scenarioId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { scenarioId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const scenario = await getScenario(scenarioId, profileId);
    return {
      title: `${scenario?.name || "Scenario"}`,
      description: `${scenario ? `${scenario.name} ${scenario.problem_statement || ""}` : "Scenario"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Scenario",
      description: `Scenario in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createScenario(
  input: CreateScenarioIn
): Promise<CreateScenarioOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/scenarios/create", input);
}

async function updateScenario(
  input: UpdateScenarioIn
): Promise<UpdateScenarioOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/scenarios/update", input);
}

async function generateAIScenario(
  input: GenerateAIScenarioIn
): Promise<GenerateAIScenarioOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/scenarios/generate-ai", input);
}

async function randomizeScenario(
  input: RandomizeScenarioIn
): Promise<RandomizeScenarioOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/scenarios/randomize", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function EditScenarioPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  const { scenarioId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch scenario detail (always fresh - source of truth)
  try {
    const scenarioDetail = await getScenario(scenarioId, profileId);

    return (
      <div
        className="space-y-6"
        data-page="scenario-edit"
        data-scenario-id={scenarioId}
      >
        <Scenario
          scenarioId={scenarioId}
          mode="edit"
          scenarioDetail={scenarioDetail}
          createScenarioAction={createScenario}
          updateScenarioAction={updateScenario}
          generateAIScenarioAction={generateAIScenario}
          randomizeScenarioAction={randomizeScenario}
        />
      </div>
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
        <DepartmentAccessDenied
          resourceType="scenario"
          redirectPath="/create/scenarios"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateScenarioIn,
  CreateScenarioOut,
  GenerateAIScenarioIn,
  GenerateAIScenarioOut,
  RandomizeScenarioIn,
  RandomizeScenarioOut,
  ScenarioDetailDefaultIn,
  ScenarioDetailDefaultOut,
  ScenarioDetailIn,
  ScenarioDetailOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
};
