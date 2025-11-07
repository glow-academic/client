/**
 * app/create/scenarios/s/[scenarioId]/page.tsx
 * Scenario editing page with server actions
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";

import Scenario from "@/components/scenarios/Scenario";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

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

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getScenario = cache(
  async (input: ScenarioDetailIn): Promise<ScenarioDetailOut> => {
    return api.post("/scenarios/detail", input);
  },
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ scenarioId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { scenarioId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const scenario = await getScenario({ body: { scenarioId, profileId } });
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
export async function createScenario(
  input: CreateScenarioIn,
): Promise<CreateScenarioOut> {
  "use server";
  const out = await api.post("/scenarios/create", input);
  revalidateTag("scenarios");
  return out;
}

export async function updateScenario(
  input: UpdateScenarioIn,
): Promise<UpdateScenarioOut> {
  "use server";
  const out = await api.post("/scenarios/update", input);
  revalidateTag("scenarios");
  return out;
}

export async function generateAIScenario(
  input: GenerateAIScenarioIn,
): Promise<GenerateAIScenarioOut> {
  "use server";
  const out = await api.post("/scenarios/generate-ai", input);
  revalidateTag("scenarios");
  return out;
}

export async function randomizeScenario(
  input: RandomizeScenarioIn,
): Promise<RandomizeScenarioOut> {
  "use server";
  const out = await api.post("/scenarios/randomize", input);
  revalidateTag("scenarios");
  return out;
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

  // Fetch scenario detail (cached, won't duplicate with metadata)
  const scenarioDetail = await getScenario({
    body: { scenarioId, profileId },
  });

  return (
    <div className="space-y-6">
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
