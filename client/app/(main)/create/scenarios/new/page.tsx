/**
 * app/create/scenarios/new/page.tsx
 * New scenario creation page with server actions
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";

import Scenario from "@/components/scenarios/Scenario";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
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
const getScenarioDefault = async (
  input: ScenarioDetailDefaultIn
): Promise<ScenarioDetailDefaultOut> => {
  return api.post(
    "/scenarios/detail-default",
    input,
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

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

export const metadata: Metadata = {
  title: "New Scenario",
  description: `New scenario creation in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewScenarioPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default scenario detail server-side
  const scenarioDetailDefault = await getScenarioDefault({
    body: { profileId },
  });

  return (
    <div
      className="space-y-6"
      data-page="scenario-new"
      aria-label="Create new scenario page"
    >
      <Scenario
        mode="create"
        scenarioDetailDefault={scenarioDetailDefault}
        createScenarioAction={createScenario}
        updateScenarioAction={updateScenario}
        generateAIScenarioAction={generateAIScenario}
        randomizeScenarioAction={randomizeScenario}
      />
    </div>
  );
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
  UpdateScenarioIn,
  UpdateScenarioOut,
};
