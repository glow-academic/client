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
type ScenarioNewIn = InputOf<"/api/v3/scenarios/new", "post">;
type ScenarioNewOut = OutputOf<"/api/v3/scenarios/new", "post">;
type CreateScenarioIn = InputOf<"/api/v3/scenarios/create", "post">;
type CreateScenarioOut = OutputOf<"/api/v3/scenarios/create", "post">;
type UpdateScenarioIn = InputOf<"/api/v3/scenarios/update", "post">;
type UpdateScenarioOut = OutputOf<"/api/v3/scenarios/update", "post">;
// GenerateAIScenario types - using WebSocket event types
type GenerateAIScenarioIn = {
  departmentId: string;
  personaIds: string[] | null;
  documentIds: string[] | null;
  fieldIds: string[] | null;
  profileId: string | null;
  userInstructions: string | null;
  imagesEnabled: boolean;
  videoEnabled: boolean;
  objectivesEnabled: boolean;
  questionsEnabled: boolean;
};
type GenerateAIScenarioOut = {
  success: boolean;
  message: string;
  title: string;
  description: string;
  objectives: string[];
  dynamic_document_mapping: Record<string, string> | null;
  problem_statement_id: string | null;
  objective_ids: string[];
  document_ids: string[];
  image_ids: string[];
};

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getScenario = async (
  scenarioId: string,
  profileId: string,
  filterParams?: {
    departmentIds?: string[];
    personaIds?: string[];
    documentIds?: string[];
    templateDocumentIds?: string[];
    parameterIds?: string[];
    parameterItemIds?: string[];
    personaSearch?: string;
    documentSearch?: string;
    parameterSearch?: string;
    personaMin?: number;
    personaMax?: number;
    documentMin?: number;
    documentMax?: number;
    parameterSelectionMin?: number;
    parameterSelectionMax?: number;
    parameterItemRanges?: Record<string, { min: number; max: number }>;
    randomizePersonas?: string;
    randomizeDocuments?: string;
    randomizeParameters?: string;
    randomizeParameterItems?: Record<string, string>;
    useImage?: boolean;
    imageIds?: string[];
    objectiveIds?: string[];
    problemStatementIds?: string[];
  }
): Promise<ScenarioDetailOut> => {
  return api.post(
    "/scenarios/detail",
    {
      body: {
        scenarioId,
        profileId,
        ...(filterParams || {}),
      },
    },
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
      description: `${scenario?.name ? `${scenario.name} - ` : ""}Problem-based learning scenario for teaching assistant training. Practice pedagogical problem-solving and instructional design through realistic educational challenges.${scenario?.problem_statement ? ` ${scenario.problem_statement}` : ""}`,
    };
  } catch {
    return {
      title: "Scenario",
      description:
        "Problem-based learning scenario for teaching assistant training. Practice pedagogical problem-solving and instructional design through realistic educational challenges.",
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

/** ---- Server renders client with typed data and actions ---- */
export default async function EditScenarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ scenarioId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { scenarioId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Parse search params
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
  const parameterItemIds = searchParamsObj
    .get("parameterItemIds")
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
  const useImage = searchParamsObj.get("useImage")
    ? searchParamsObj.get("useImage") === "true"
    : undefined;

  // Parse parameter item ranges
  const parameterItemRanges:
    | Record<string, { min: number; max: number }>
    | undefined = (() => {
    const ranges: Record<string, { min: number; max: number }> = {};
    let hasRanges = false;
    for (const [key, value] of searchParamsObj.entries()) {
      if (key.startsWith("parameterItemMin_")) {
        const paramId = key.replace("parameterItemMin_", "");
        const min = parseInt(value, 10);
        if (!isNaN(min)) {
          if (!ranges[paramId]) ranges[paramId] = { min: 1, max: 2 };
          ranges[paramId].min = min;
          hasRanges = true;
        }
      } else if (key.startsWith("parameterItemMax_")) {
        const paramId = key.replace("parameterItemMax_", "");
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

  // Parse randomization params
  const randomizePersonas =
    searchParamsObj.get("randomizePersonas") || undefined;
  const randomizeDocuments =
    searchParamsObj.get("randomizeDocuments") || undefined;
  const randomizeParameters =
    searchParamsObj.get("randomizeParameters") || undefined;

  const randomizeParameterItems: Record<string, string> | undefined = (() => {
    const items: Record<string, string> = {};
    for (const [key, value] of searchParamsObj.entries()) {
      if (key.startsWith("randomizeParameterItems_")) {
        const paramId = key.replace("randomizeParameterItems_", "");
        items[paramId] = value;
      }
    }
    return Object.keys(items).length > 0 ? items : undefined;
  })();

  // Fetch scenario detail (always fresh - source of truth) with filter params
  try {
    const filterParams: Parameters<typeof getScenario>[2] = {};
    if (departmentIds) filterParams.departmentIds = departmentIds;
    if (personaIds) filterParams.personaIds = personaIds;
    if (documentIds) filterParams.documentIds = documentIds;
    if (templateDocumentIds)
      filterParams.templateDocumentIds = templateDocumentIds;
    if (parameterIds) filterParams.parameterIds = parameterIds;
    if (parameterItemIds) filterParams.parameterItemIds = parameterItemIds;
    if (personaSearch) filterParams.personaSearch = personaSearch;
    if (documentSearch) filterParams.documentSearch = documentSearch;
    if (parameterSearch) filterParams.parameterSearch = parameterSearch;
    if (personaMin !== undefined) filterParams.personaMin = personaMin;
    if (personaMax !== undefined) filterParams.personaMax = personaMax;
    if (documentMin !== undefined) filterParams.documentMin = documentMin;
    if (documentMax !== undefined) filterParams.documentMax = documentMax;
    if (parameterSelectionMin !== undefined)
      filterParams.parameterSelectionMin = parameterSelectionMin;
    if (parameterSelectionMax !== undefined)
      filterParams.parameterSelectionMax = parameterSelectionMax;
    if (parameterItemRanges)
      filterParams.parameterItemRanges = parameterItemRanges;
    if (randomizePersonas) filterParams.randomizePersonas = randomizePersonas;
    if (randomizeDocuments)
      filterParams.randomizeDocuments = randomizeDocuments;
    if (randomizeParameters)
      filterParams.randomizeParameters = randomizeParameters;
    if (randomizeParameterItems)
      filterParams.randomizeParameterItems = randomizeParameterItems;
    if (useImage !== undefined) filterParams.useImage = useImage;
    if (imageIds) filterParams.imageIds = imageIds;
    if (objectiveIds) filterParams.objectiveIds = objectiveIds;
    if (problemStatementIds)
      filterParams.problemStatementIds = problemStatementIds;

    const scenarioDetail = await getScenario(
      scenarioId,
      profileId,
      Object.keys(filterParams).length > 0 ? filterParams : undefined
    );

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
  ScenarioDetailIn,
  ScenarioDetailOut,
  ScenarioNewIn,
  ScenarioNewOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
};
