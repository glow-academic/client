/**
 * app/create/scenarios/s/[scenarioId]/page.tsx
 * Scenario editing page with server actions
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Scenario from "@/components/scenarios/Scenario";
import { api } from "@/lib/api/client";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { doRequest } from "@/lib/api/request-core";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import {
  csvToArray,
  extractFieldShowSelectedByParam,
  extractParameterItemRanges,
  loadScenarioSearchParams,
} from "../../searchParams";

/** ---- Strong types from OpenAPI ---- */
type GetScenarioIn = InputOf<"/api/v4/scenarios/get", "post">;
type GetScenarioOut = OutputOf<"/api/v4/scenarios/get", "post">;
type SaveScenarioIn = InputOf<"/api/v4/scenarios/save", "post">;
type SaveScenarioOut = OutputOf<"/api/v4/scenarios/save", "post">;
type PatchScenarioDraftIn = InputOf<"/api/v4/scenarios/draft", "patch">;
type PatchScenarioDraftOut = OutputOf<"/api/v4/scenarios/draft", "patch">;
// Resource creation types
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
type CreateDraftProblemStatementsIn = InputOf<
  "/api/v4/resources/problem_statements",
  "post"
>;
type CreateDraftProblemStatementsOut = OutputOf<
  "/api/v4/resources/problem_statements",
  "post"
>;
type CreateDraftObjectivesIn = InputOf<"/api/v4/resources/objectives", "post">;
type CreateDraftObjectivesOut = OutputOf<
  "/api/v4/resources/objectives",
  "post"
>;
type CreateDraftScenarioFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftScenarioFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type UpdateTemplatesIn = {
  body: {
    template_id: string;
    html: string;
    name?: string | null;
    description?: string | null;
  };
};
type UpdateTemplatesOut = {
  template_id: string | null;
};
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
 * Uses unified get endpoint.
 */
const getScenario = async (
  scenarioId: string,
  filterParams?: {
    draftId?: string;
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
    imageIds?: string[];
    objectiveIds?: string[];
    problemStatementIds?: string[];
  }
): Promise<GetScenarioOut> => {
  // Convert camelCase filter params to snake_case for API
  // Use proper type from InputOf to ensure type safety
  const body: GetScenarioIn["body"] = {
    scenario_id: scenarioId,
    mcp: null,
  };

  if (filterParams) {
    if (filterParams.draftId) body.draft_id = filterParams.draftId;
    if (filterParams.departmentIds)
      body.filter_department_ids = filterParams.departmentIds;
    if (filterParams.personaIds)
      body.filter_persona_ids = filterParams.personaIds;
    if (filterParams.documentIds)
      body.filter_document_ids = filterParams.documentIds;
    if (filterParams.templateDocumentIds)
      body.template_document_ids = filterParams.templateDocumentIds;
    if (filterParams.parameterIds)
      body.filter_parameter_ids = filterParams.parameterIds;
    if (filterParams.parameterItemIds)
      body.filter_field_ids = filterParams.parameterItemIds;
    if (filterParams.personaSearch)
      body.persona_search = filterParams.personaSearch;
    if (filterParams.documentSearch)
      body.document_search = filterParams.documentSearch;
    if (filterParams.parameterSearch)
      body.parameter_search = filterParams.parameterSearch;
    if (filterParams.descriptionSearch)
      body.description_search = filterParams.descriptionSearch;
    if (filterParams.problemStatementSearch)
      body.problem_statement_search = filterParams.problemStatementSearch;
    if (filterParams.templateSearch)
      body.template_search = filterParams.templateSearch;
    if (filterParams.imageSearch) body.image_search = filterParams.imageSearch;
    if (filterParams.videoSearch) body.video_search = filterParams.videoSearch;
    if (filterParams.documentShowSelected !== undefined)
      body.document_show_selected = filterParams.documentShowSelected;
    // Note: document_show_template, persona_min, persona_max, document_min, document_max,
    // parameter_selection_min, parameter_selection_max, field_ranges are not part of the API request
    if (filterParams.personaShowSelected !== undefined)
      body.persona_show_selected = filterParams.personaShowSelected;
    if (filterParams.parameterShowSelected !== undefined)
      body.parameter_show_selected = filterParams.parameterShowSelected;
    // Convert Record<string, boolean> to array format expected by API
    if (filterParams.fieldShowSelectedByParam) {
      body.field_show_selected_by_param = Object.entries(
        filterParams.fieldShowSelectedByParam
      ).map(([parameter_id, show_selected]) => ({
        parameter_id,
        show_selected,
      }));
    }
    if (filterParams.imageIds) body.image_ids = filterParams.imageIds;
    if (filterParams.objectiveIds)
      body.objective_ids = filterParams.objectiveIds;
    if (filterParams.problemStatementIds)
      body.problem_statement_ids = filterParams.problemStatementIds;
  }

  return api.post(
    "/scenarios/get",
    {
      body,
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
async function saveScenario(input: SaveScenarioIn): Promise<SaveScenarioOut> {
  "use server";
  // Use unified save endpoint (works for both create and edit)
  return api.post("/scenarios/save", input);
}

async function patchScenarioDraft(
  input: PatchScenarioDraftIn
): Promise<PatchScenarioDraftOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/scenarios/draft", input);
}

async function updateTemplates(
  input: UpdateTemplatesIn
): Promise<UpdateTemplatesOut> {
  "use server";
  return doRequest<UpdateTemplatesOut>(
    INTERNAL_HTTP_BASE,
    "POST",
    "/api/v4/resources/templates/update",
    input
  );
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

async function createDraftProblemStatements(
  input: CreateDraftProblemStatementsIn
): Promise<CreateDraftProblemStatementsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/problem_statements", input);
}

async function createDraftObjectives(
  input: CreateDraftObjectivesIn
): Promise<CreateDraftObjectivesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/objectives", input);
}

async function createDraftScenarioFlags(
  input: CreateDraftScenarioFlagsIn
): Promise<CreateDraftScenarioFlagsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/flags", input);
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
      descriptionSearch?: string;
      problemStatementSearch?: string;
      templateSearch?: string;
      imageSearch?: string;
      videoSearch?: string;
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
    if (q.descriptionSearch) filterParams.descriptionSearch = q.descriptionSearch;
    if (q.problemStatementSearch)
      filterParams.problemStatementSearch = q.problemStatementSearch;
    if (q.templateSearch) filterParams.templateSearch = q.templateSearch;
    if (q.imageSearch) filterParams.imageSearch = q.imageSearch;
    if (q.videoSearch) filterParams.videoSearch = q.videoSearch;
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
    if (
      fieldShowSelectedByParam !== undefined &&
      fieldShowSelectedByParam !== null
    )
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
    const imageIds = csvToArray(q.imageIds);
    const objectiveIds = csvToArray(q.objectiveIds);
    const problemStatementIds = csvToArray(q.problemStatementIds);
    if (imageIds) filterParams.imageIds = imageIds;
    if (objectiveIds) filterParams.objectiveIds = objectiveIds;
    if (problemStatementIds)
      filterParams.problemStatementIds = problemStatementIds;

    const scenarioDetail = await getScenario(
      scenarioId,
      Object.keys(filterParams).length > 0
        ? (filterParams as Parameters<typeof getScenario>[1])
        : undefined
    );

    return (
      <div
        className="space-y-6"
        data-page="scenario-edit"
        data-scenario-id={scenarioId}
      >
        <Scenario
          scenarioId={scenarioId}
          scenarioDetail={scenarioDetail}
          saveScenarioAction={saveScenario}
          patchScenarioDraftAction={patchScenarioDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createProblemStatementsAction={createDraftProblemStatements}
          createObjectivesAction={createDraftObjectives}
          createScenarioFlagsAction={createDraftScenarioFlags}
          updateTemplatesAction={updateTemplates}
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
  GetScenarioIn,
  GetScenarioOut,
  PatchScenarioDraftIn,
  PatchScenarioDraftOut,
  SaveScenarioIn,
  SaveScenarioOut,
  ScenarioDetailIn,
  ScenarioDetailOut,
  ScenarioNewIn,
  ScenarioNewOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
};
