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
type ScenarioNewIn = InputOf<"/api/v3/scenarios/new", "post">;
type ScenarioNewOut = OutputOf<"/api/v3/scenarios/new", "post">;
type CreateScenarioIn = InputOf<"/api/v3/scenarios/create", "post">;
type CreateScenarioOut = OutputOf<"/api/v3/scenarios/create", "post">;
type UpdateScenarioIn = InputOf<"/api/v3/scenarios/update", "post">;
type UpdateScenarioOut = OutputOf<"/api/v3/scenarios/update", "post">;
// GenerateAIScenario types removed - now using WebSocket
type GenerateAIScenarioIn = never;
type GenerateAIScenarioOut = never;
type RandomizeScenarioIn = InputOf<"/api/v3/scenarios/randomize", "post">;
type RandomizeScenarioOut = OutputOf<"/api/v3/scenarios/randomize", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getScenarioDefault = async (
  input: ScenarioNewIn
): Promise<ScenarioNewOut> => {
  return api.post("/scenarios/new", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
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

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Scenario",
    description:
      "Create a new problem-based learning scenario for teaching assistant training. Design realistic educational challenges and problem statements to practice pedagogical problem-solving and enhance instructional design skills.",
  };
}

export default async function NewScenarioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Parse search params
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

  // Extract filter params
  const departmentIds = searchParamsObj
    .get("departmentIds")
    ?.split(",")
    .filter(Boolean);
  const personaIds = searchParamsObj
    .get("personaIds")
    ?.split(",")
    .filter(Boolean);
  const documentIds = searchParamsObj
    .get("documentIds")
    ?.split(",")
    .filter(Boolean);
  const templateDocumentIds = searchParamsObj
    .get("templateDocumentIds")
    ?.split(",")
    .filter(Boolean);
  const parameterIds = searchParamsObj
    .get("parameterIds")
    ?.split(",")
    .filter(Boolean);
  const fieldIds = searchParamsObj // Renamed from parameterItemIds
    .get("fieldIds") // Renamed from parameterItemIds
    ?.split(",")
    .filter(Boolean);
  // Extract URL parameters for linking generated resources
  const imageIds = searchParamsObj.get("imageIds")?.split(",").filter(Boolean);
  const objectiveIds = searchParamsObj
    .get("objectiveIds")
    ?.split(",")
    .filter(Boolean);
  const problemStatementIds = searchParamsObj
    .get("problemStatementIds")
    ?.split(",")
    .filter(Boolean);
  const personaSearch = searchParamsObj.get("personaSearch") || undefined;
  const documentSearch = searchParamsObj.get("documentSearch") || undefined;
  const parameterSearch = searchParamsObj.get("parameterSearch") || undefined;
  const personaMin = searchParamsObj.get("personaMin")
    ? parseInt(searchParamsObj.get("personaMin") || "1", 10)
    : undefined;
  const personaMax = searchParamsObj.get("personaMax")
    ? parseInt(searchParamsObj.get("personaMax") || "1", 10)
    : undefined;
  const documentMin = searchParamsObj.get("documentMin")
    ? parseInt(searchParamsObj.get("documentMin") || "0", 10)
    : undefined;
  const documentMax = searchParamsObj.get("documentMax")
    ? parseInt(searchParamsObj.get("documentMax") || "1", 10)
    : undefined;
  const parameterSelectionMin = searchParamsObj.get("parameterSelectionMin")
    ? parseInt(searchParamsObj.get("parameterSelectionMin") || "0", 10)
    : undefined;
  const parameterSelectionMax = searchParamsObj.get("parameterSelectionMax")
    ? parseInt(searchParamsObj.get("parameterSelectionMax") || "3", 10)
    : undefined;
  const objectivesMin = searchParamsObj.get("objectivesMin")
    ? parseInt(searchParamsObj.get("objectivesMin") || "0", 10)
    : undefined;
  const objectivesMax = searchParamsObj.get("objectivesMax")
    ? parseInt(searchParamsObj.get("objectivesMax") || "0", 10)
    : undefined;
  const useImage = searchParamsObj.get("useImage")
    ? searchParamsObj.get("useImage") === "true"
    : undefined;

  // Parse field ranges (format: fieldMin_{paramId}, fieldMax_{paramId})
  const fieldRanges: // Renamed from parameterItemRanges
  Record<string, { min: number; max: number }> | undefined = (() => {
    const ranges: Record<string, { min: number; max: number }> = {};
    let hasRanges = false;
    for (const [key, value] of searchParamsObj.entries()) {
      if (key.startsWith("fieldMin_")) {
        // Renamed from parameterItemMin_
        const paramId = key.replace("fieldMin_", "");
        const min = parseInt(value, 10);
        if (!isNaN(min)) {
          if (!ranges[paramId]) ranges[paramId] = { min: 1, max: 2 };
          ranges[paramId].min = min;
          hasRanges = true;
        }
      } else if (key.startsWith("fieldMax_")) {
        // Renamed from parameterItemMax_
        const paramId = key.replace("fieldMax_", "");
        const max = parseInt(value, 10);
        if (!isNaN(max)) {
          if (!ranges[paramId]) ranges[paramId] = { min: 1, max: 2 };
          ranges[paramId].max = max;
          hasRanges = true;
        }
      }
    }
    return hasRanges ? ranges : undefined;
  })();

  // Parse randomization param (single param: "all", "persona", "document", "parameters", or "parameter_{field_id}")
  const randomize = searchParamsObj.get("randomize") || undefined;

  // Fetch default scenario detail server-side with filter params
  const scenarioDetailDefault = await getScenarioDefault({
    body: {
      profileId,
      departmentIds: departmentIds || null,
      personaIds: personaIds || null,
      documentIds: documentIds || null,
      templateDocumentIds: templateDocumentIds || null,
      parameterIds: parameterIds || null,
      fieldIds: fieldIds || null, // Renamed from parameterItemIds
      personaSearch: personaSearch || null,
      documentSearch: documentSearch || null,
      parameterSearch: parameterSearch || null,
      personaMin: personaMin || null,
      personaMax: personaMax || null,
      documentMin: documentMin || null,
      documentMax: documentMax || null,
      parameterSelectionMin: parameterSelectionMin || null,
      parameterSelectionMax: parameterSelectionMax || null,
      objectivesMin: objectivesMin || null,
      objectivesMax: objectivesMax || null,
      fieldRanges: fieldRanges || null, // Renamed from parameterItemRanges
      randomize: randomize || null,
      useImage: useImage || null,
      imageIds: imageIds || null,
      objectiveIds: objectiveIds || null,
      problemStatementIds: problemStatementIds || null,
    },
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
  ScenarioNewIn,
  ScenarioNewOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
};
