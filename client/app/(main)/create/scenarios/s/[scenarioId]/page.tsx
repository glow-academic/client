/**
 * app/create/scenarios/s/[scenarioId]/page.tsx
 * Scenario editing page with server actions
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Scenario from "@/components/scenarios/Scenario";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import {
  csvToArray,
  extractFieldShowSelectedByParam,
  extractParameterItemRanges,
  loadScenarioSearchParams,
} from "../../searchParams";

/** ---- Strong types from OpenAPI ---- */
type ScenarioDetailIn = InputOf<"/api/v4/scenarios/detail", "post">;
type ScenarioDetailOut = OutputOf<"/api/v4/scenarios/detail", "post">;
type ScenarioNewIn = InputOf<"/api/v4/scenarios/new", "post">;
type ScenarioNewOut = OutputOf<"/api/v4/scenarios/new", "post">;
type CreateScenarioIn = InputOf<"/api/v4/scenarios/create", "post">;
type CreateScenarioOut = OutputOf<"/api/v4/scenarios/create", "post">;
type UpdateScenarioIn = InputOf<"/api/v4/scenarios/update", "post">;
type UpdateScenarioOut = OutputOf<"/api/v4/scenarios/update", "post">;
type PatchScenarioDraftIn = InputOf<"/api/v4/scenarios/draft", "patch">;
type PatchScenarioDraftOut = OutputOf<"/api/v4/scenarios/draft", "patch">;
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
    documentShowSelected?: boolean;
    documentShowTemplate?: boolean;
    personaShowSelected?: boolean;
    parameterShowSelected?: boolean;
    fieldShowSelectedByParam?: Record<string, boolean>; // Per-parameter field filters: {paramId: bool}
    personaMin?: number;
    personaMax?: number;
    documentMin?: number;
    documentMax?: number;
    parameterSelectionMin?: number;
    parameterSelectionMax?: number;
    parameterItemRanges?: Record<string, { min: number; max: number }>;
    useImage?: boolean;
    useVideo?: boolean;
    imageIds?: string[];
    objectiveIds?: string[];
    problemStatementIds?: string[];
  }
): Promise<ScenarioDetailOut> => {
  // Convert camelCase filter params to snake_case for API
  const snakeCaseParams: Record<string, unknown> = {
    scenario_id: scenarioId,
  };
  
  if (filterParams) {
    if (filterParams.draftId) snakeCaseParams.draft_id = filterParams.draftId;
    if (filterParams.departmentIds) snakeCaseParams.filter_department_ids = filterParams.departmentIds;
    if (filterParams.personaIds) snakeCaseParams.filter_persona_ids = filterParams.personaIds;
    if (filterParams.documentIds) snakeCaseParams.filter_document_ids = filterParams.documentIds;
    if (filterParams.templateDocumentIds) snakeCaseParams.template_document_ids = filterParams.templateDocumentIds;
    if (filterParams.parameterIds) snakeCaseParams.filter_parameter_ids = filterParams.parameterIds;
    if (filterParams.parameterItemIds) snakeCaseParams.filter_field_ids = filterParams.parameterItemIds;
    if (filterParams.personaSearch) snakeCaseParams.persona_search = filterParams.personaSearch;
    if (filterParams.documentSearch) snakeCaseParams.document_search = filterParams.documentSearch;
    if (filterParams.parameterSearch) snakeCaseParams.parameter_search = filterParams.parameterSearch;
    if (filterParams.documentShowSelected !== undefined) snakeCaseParams.document_show_selected = filterParams.documentShowSelected;
    if (filterParams.documentShowTemplate !== undefined) snakeCaseParams.document_show_template = filterParams.documentShowTemplate;
    if (filterParams.personaShowSelected !== undefined) snakeCaseParams.persona_show_selected = filterParams.personaShowSelected;
    if (filterParams.parameterShowSelected !== undefined) snakeCaseParams.parameter_show_selected = filterParams.parameterShowSelected;
    if (filterParams.fieldShowSelectedByParam) snakeCaseParams.field_show_selected_by_param = filterParams.fieldShowSelectedByParam;
    if (filterParams.personaMin !== undefined) snakeCaseParams.persona_min = filterParams.personaMin;
    if (filterParams.personaMax !== undefined) snakeCaseParams.persona_max = filterParams.personaMax;
    if (filterParams.documentMin !== undefined) snakeCaseParams.document_min = filterParams.documentMin;
    if (filterParams.documentMax !== undefined) snakeCaseParams.document_max = filterParams.documentMax;
    if (filterParams.parameterSelectionMin !== undefined) snakeCaseParams.parameter_selection_min = filterParams.parameterSelectionMin;
    if (filterParams.parameterSelectionMax !== undefined) snakeCaseParams.parameter_selection_max = filterParams.parameterSelectionMax;
    if (filterParams.parameterItemRanges) snakeCaseParams.field_ranges = filterParams.parameterItemRanges;
    if (filterParams.useImage !== undefined) snakeCaseParams.use_image = filterParams.useImage;
    if (filterParams.useVideo !== undefined) snakeCaseParams.use_video = filterParams.useVideo;
    if (filterParams.imageIds) snakeCaseParams.image_ids = filterParams.imageIds;
    if (filterParams.objectiveIds) snakeCaseParams.objective_ids = filterParams.objectiveIds;
    if (filterParams.problemStatementIds) snakeCaseParams.problem_statement_ids = filterParams.problemStatementIds;
  }
  
  return api.post(
    "/scenarios/detail",
    {
      body: snakeCaseParams,
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
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const scenario = await getScenario(scenarioId);
    return {
      title: `${scenario?.name || "Scenario"}`,
      description: `${scenario?.name ? `${scenario.name} - ` : ""}Problem-based learning scenario for teaching assistant training. Practice pedagogical problem-solving and instructional design through realistic educational challenges.${scenario?.problem_statement ? ` ${scenario.problem_statement}` : ""}`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Scenario",
    description:
      "Problem-based learning scenario for teaching assistant training. Practice pedagogical problem-solving and instructional design through realistic educational challenges.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateScenario(
  input: UpdateScenarioIn
): Promise<UpdateScenarioOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/scenarios/update", input);
}

async function patchScenarioDraft(
  input: PatchScenarioDraftIn
): Promise<PatchScenarioDraftOut> {
  "use server";
  return api.post("/scenarios/draft", input);
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
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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

  // Load typed search params using nuqs
  const q = loadScenarioSearchParams(searchParamsObj);

  // Extract dynamic params (not handled by nuqs parsers)
  const fieldShowSelectedByParam =
    extractFieldShowSelectedByParam(searchParamsObj);
  const parameterItemRanges = extractParameterItemRanges(searchParamsObj);

  // Fetch scenario detail (always fresh - source of truth) with filter params
  try {
    type FilterParams = {
      draftId?: string | null;
      departmentIds?: string[];
      personaIds?: string[];
      documentIds?: string[];
      templateDocumentIds?: string[];
      parameterIds?: string[];
      parameterItemIds?: string[];
      personaSearch?: string;
      documentSearch?: string;
      parameterSearch?: string;
      documentShowSelected?: boolean;
      documentShowTemplate?: boolean;
      personaShowSelected?: boolean;
      parameterShowSelected?: boolean;
      fieldShowSelectedByParam?: Record<string, boolean>; // Per-parameter field filters
      personaMin?: number;
      personaMax?: number;
      documentMin?: number;
      documentMax?: number;
      parameterSelectionMin?: number;
      parameterSelectionMax?: number;
      parameterItemRanges?: Record<string, { min: number; max: number }>;
      useImage?: boolean;
      useVideo?: boolean;
      imageIds?: string[];
      objectiveIds?: string[];
      problemStatementIds?: string[];
    };
    const filterParams: FilterParams = {};
    if (q.draftId) filterParams.draftId = q.draftId;
    const departmentIds = csvToArray(q.departmentIds);
    const personaIds = csvToArray(q.personaIds);
    const documentIds = csvToArray(q.documentIds);
    const templateDocumentIds = csvToArray(q.templateDocumentIds);
    const parameterIds = csvToArray(q.parameterIds);
    const fieldIds = csvToArray(q.fieldIds);

    if (departmentIds) filterParams.departmentIds = departmentIds;
    if (personaIds) filterParams.personaIds = personaIds;
    if (documentIds) filterParams.documentIds = documentIds;
    if (templateDocumentIds)
      filterParams.templateDocumentIds = templateDocumentIds;
    if (parameterIds) filterParams.parameterIds = parameterIds;
    // Edit mode uses parameterItemIds, but nuqs uses fieldIds
    if (fieldIds) filterParams.parameterItemIds = fieldIds;
    if (q.personaSearch) filterParams.personaSearch = q.personaSearch;
    if (q.documentSearch) filterParams.documentSearch = q.documentSearch;
    if (q.parameterSearch) filterParams.parameterSearch = q.parameterSearch;
    if (q.documentShowSelected !== undefined && q.documentShowSelected !== null)
      filterParams.documentShowSelected = q.documentShowSelected;
    if (q.documentShowTemplate !== undefined && q.documentShowTemplate !== null)
      filterParams.documentShowTemplate = q.documentShowTemplate;
    if (q.personaShowSelected !== undefined && q.personaShowSelected !== null)
      filterParams.personaShowSelected = q.personaShowSelected;
    if (
      q.parameterShowSelected !== undefined &&
      q.parameterShowSelected !== null
    )
      filterParams.parameterShowSelected = q.parameterShowSelected;
    if (fieldShowSelectedByParam !== undefined)
      filterParams.fieldShowSelectedByParam = fieldShowSelectedByParam;
    if (q.personaMin !== undefined && q.personaMin !== null)
      filterParams.personaMin = q.personaMin;
    if (q.personaMax !== undefined && q.personaMax !== null)
      filterParams.personaMax = q.personaMax;
    if (q.documentMin !== undefined && q.documentMin !== null)
      filterParams.documentMin = q.documentMin;
    if (q.documentMax !== undefined && q.documentMax !== null)
      filterParams.documentMax = q.documentMax;
    if (
      q.parameterSelectionMin !== undefined &&
      q.parameterSelectionMin !== null
    )
      filterParams.parameterSelectionMin = q.parameterSelectionMin;
    if (
      q.parameterSelectionMax !== undefined &&
      q.parameterSelectionMax !== null
    )
      filterParams.parameterSelectionMax = q.parameterSelectionMax;
    if (parameterItemRanges)
      filterParams.parameterItemRanges = parameterItemRanges;
    if (q.useImage !== undefined && q.useImage !== null)
      filterParams.useImage = q.useImage;
    if (q.useVideo !== undefined && q.useVideo !== null)
      filterParams.useVideo = q.useVideo;
    const imageIds = csvToArray(q.imageIds);
    const objectiveIds = csvToArray(q.objectiveIds);
    const problemStatementIds = csvToArray(q.problemStatementIds);
    if (imageIds) filterParams.imageIds = imageIds;
    if (objectiveIds) filterParams.objectiveIds = objectiveIds;
    if (problemStatementIds)
      filterParams.problemStatementIds = problemStatementIds;

    const scenarioDetail = await getScenario(
      scenarioId,
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
          updateScenarioAction={updateScenario}
          patchScenarioDraftAction={patchScenarioDraft}
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
        <UnifiedAccessDenied
          reason="department"
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
  PatchScenarioDraftIn,
  PatchScenarioDraftOut,
  ScenarioDetailIn,
  ScenarioDetailOut,
  ScenarioNewIn,
  ScenarioNewOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
};
