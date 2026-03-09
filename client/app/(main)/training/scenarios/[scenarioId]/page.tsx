/**
 * app/(main)/training/scenarios/[scenarioId]/page.tsx
 * Scenario editing page with server actions
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Scenario from "@/components/artifacts/scenario/Scenario";
import { DraftProviderClient } from "@/contexts/draft-context";
import { getDrafts, resolveGroupId } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import {
  csvToArray,
  extractFieldShowSelectedByParam,
  extractParameterItemRanges,
  loadScenarioSearchParams,
} from "@/lib/search-params/scenarios";

/** ---- Strong types from OpenAPI ---- */
type GetScenarioIn = InputOf<"/api/v5/artifacts/scenarios/get", "post">;
type GetScenarioOut = OutputOf<"/api/v5/artifacts/scenarios/get", "post">;
type UpdateScenarioIn = InputOf<"/api/v5/artifacts/scenarios/update", "post">;
type UpdateScenarioOut = OutputOf<"/api/v5/artifacts/scenarios/update", "post">;
type PatchScenarioDraftIn = InputOf<"/api/v5/artifacts/scenarios/draft", "patch">;
type PatchScenarioDraftOut = OutputOf<"/api/v5/artifacts/scenarios/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 * Uses unified get endpoint.
 */
const getScenario = async (
  scenarioId: string,
  filterParams?: {
    draftId?: string | null;
    groupId?: string;
    departmentIds?: string[];
    personaIds?: string[];
    documentIds?: string[];
    parameterIds?: string[];
    parameterItemIds?: string[];
    personaSearch?: string;
    documentSearch?: string;
    parameterSearch?: string;
    descriptionSearch?: string;
    problemStatementSearch?: string;
    imageSearch?: string;
    videoSearch?: string;
    documentShowSelected?: boolean;
    personaShowSelected?: boolean;
    parameterShowSelected?: boolean;
    fieldShowSelectedByParam?: Record<string, boolean>;
    urlParameterIds?: string[];
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
  const body: GetScenarioIn["body"] = {
    scenario_id: scenarioId,
    mcp: null,
    parameter_ids: null,
  };

  if (filterParams) {
    if (filterParams.draftId) body.draft_id = filterParams.draftId;
    if (filterParams.groupId) body.group_id = filterParams.groupId;
    if (filterParams.departmentIds)
      body.filter_department_ids = filterParams.departmentIds;
    if (filterParams.personaIds)
      body.filter_persona_ids = filterParams.personaIds;
    if (filterParams.documentIds)
      body.filter_document_ids = filterParams.documentIds;
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
    if (filterParams.imageSearch) body.image_search = filterParams.imageSearch;
    if (filterParams.videoSearch) body.video_search = filterParams.videoSearch;
    if (filterParams.documentShowSelected !== undefined)
      body.document_show_selected = filterParams.documentShowSelected;
    if (filterParams.personaShowSelected !== undefined)
      body.persona_show_selected = filterParams.personaShowSelected;
    if (filterParams.parameterShowSelected !== undefined)
      body.parameter_show_selected = filterParams.parameterShowSelected;
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
    if (filterParams.urlParameterIds)
      body.parameter_ids = filterParams.urlParameterIds;
  }

  return api.post(
    "/artifacts/scenarios/get",
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

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/scenarios/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/scenarios/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/scenarios/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}): Promise<Metadata> {
  const { scenarioId } = await params;
  const docs = await getDocs({ body: { entity_id: scenarioId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateScenario(input: UpdateScenarioIn): Promise<UpdateScenarioOut> {
  "use server";
  return api.post("/artifacts/scenarios/update", input);
}

async function patchScenarioDraft(
  input: PatchScenarioDraftIn
): Promise<PatchScenarioDraftOut> {
  "use server";
  return api.patch("/artifacts/scenarios/draft", input);
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
      parameterIds?: string[];
      parameterItemIds?: string[];
      personaSearch?: string;
      documentSearch?: string;
      parameterSearch?: string;
      descriptionSearch?: string;
      problemStatementSearch?: string;
      imageSearch?: string;
      videoSearch?: string;
      documentShowSelected?: boolean;
      personaShowSelected?: boolean;
      parameterShowSelected?: boolean;
      fieldShowSelectedByParam?: Record<string, boolean>;
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
      urlParameterIds?: string[];
      groupId?: string;
    };
    const filterParams: FilterParams = {};
    if (q.draftId) filterParams.draftId = q.draftId;
    const departmentIds = csvToArray(q.departmentIds);
    const personaIds = csvToArray(q.personaIds);
    const documentIds = csvToArray(q.documentIds);
    const parameterIds = csvToArray(q.parameterIds);
    const fieldIds = csvToArray(q.fieldIds);

    if (departmentIds) filterParams.departmentIds = departmentIds;
    if (personaIds) filterParams.personaIds = personaIds;
    if (documentIds) filterParams.documentIds = documentIds;
    if (parameterIds) filterParams.parameterIds = parameterIds;
    if (fieldIds) filterParams.parameterItemIds = fieldIds;
    if (q.personaSearch) filterParams.personaSearch = q.personaSearch;
    if (q.documentSearch) filterParams.documentSearch = q.documentSearch;
    if (q.parameterSearch) filterParams.parameterSearch = q.parameterSearch;
    if (q.descriptionSearch) filterParams.descriptionSearch = q.descriptionSearch;
    if (q.problemStatementSearch)
      filterParams.problemStatementSearch = q.problemStatementSearch;
    if (q.imageSearch) filterParams.imageSearch = q.imageSearch;
    if (q.videoSearch) filterParams.videoSearch = q.videoSearch;
    if (q.documentShowSelected !== undefined && q.documentShowSelected !== null)
      filterParams.documentShowSelected = q.documentShowSelected;
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

    // URL render filter: which parameters are expanded
    const urlParameterIds = csvToArray(q.parameterIds);
    if (urlParameterIds) filterParams.urlParameterIds = urlParameterIds;

    // Resolve group_id from layout context (cached per request)
    const groupId = (await resolveGroupId({ draft_id: filterParams.draftId ?? null, artifact_type: "scenario" })).group_id;
    filterParams.groupId = groupId;

    const [scenarioDetail, docs, draftsResult] = await Promise.all([
      getScenario(
        scenarioId,
        Object.keys(filterParams).length > 0
          ? (filterParams as Parameters<typeof getScenario>[1])
          : undefined
      ),
      getDocs({ body: { entity_id: scenarioId } }),
      getDrafts(), // TODO: fetch only scenario drafts (e.g. getDrafts({ artifact_type: "scenario" }))
    ]);

    // Entity name from docs (already resolved server-side)
    const entityName = docs.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.drafts ?? []}>
        <PageHeader
          breadcrumbs={[
            { title: "Training", section: "training", url: "/training" },
            { title: "Scenarios", section: "scenarios", url: "/training/scenarios" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar artifactType="scenario" />}
        />
        <div
          className="space-y-6 px-4"
          data-page="scenario-edit"
          data-scenario-id={scenarioId}
        >
          <Scenario
            scenarioId={scenarioId}
            scenarioDetail={scenarioDetail}
            updateScenarioAction={updateScenario}
            patchScenarioDraftAction={patchScenarioDraft}
          />
        </div>
      </DraftProviderClient>
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
          redirectPath="/training/scenarios"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetScenarioIn,
  GetScenarioOut,
  PatchScenarioDraftIn,
  PatchScenarioDraftOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
};
