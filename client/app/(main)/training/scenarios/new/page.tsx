/**
 * app/(main)/training/scenarios/new/page.tsx
 * New scenario creation page with server actions
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Scenario from "@/components/artifacts/scenario/Scenario";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import {
  csvToArray,
  extractFieldShowSelectedByParam,
  loadScenarioSearchParams,
} from "@/lib/search-params/scenarios";

/** ---- Strong types from OpenAPI ---- */
type GetScenarioIn = InputOf<"/api/v4/artifacts/scenarios/get", "post">;
type GetScenarioOut = OutputOf<"/api/v4/artifacts/scenarios/get", "post">;
type SaveScenarioIn = InputOf<"/api/v4/artifacts/scenarios/save", "post">;
type SaveScenarioOut = OutputOf<"/api/v4/artifacts/scenarios/save", "post">;
// Keep old types for backward compatibility during migration
type PatchScenarioDraftIn = InputOf<"/api/v4/artifacts/scenarios/draft", "patch">;
type PatchScenarioDraftOut = OutputOf<"/api/v4/artifacts/scenarios/draft", "patch">;
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
type CreateDraftQuestionsIn = InputOf<"/api/v4/resources/questions", "post">;
type CreateDraftQuestionsOut = OutputOf<"/api/v4/resources/questions", "post">;
type CreateDraftImagesIn = InputOf<"/api/v4/resources/images", "post">;
type CreateDraftImagesOut = OutputOf<"/api/v4/resources/images", "post">;
type CreateDraftVideosIn = InputOf<"/api/v4/resources/videos", "post">;
type CreateDraftVideosOut = OutputOf<"/api/v4/resources/videos", "post">;
type CreateDraftParameterFieldsIn = InputOf<"/api/v4/resources/parameter_fields", "post">;
type CreateDraftParameterFieldsOut = OutputOf<"/api/v4/resources/parameter_fields", "post">;
type CreateDraftOptionsIn = InputOf<"/api/v4/resources/options", "post">;
type CreateDraftOptionsOut = OutputOf<"/api/v4/resources/options", "post">;

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
}

async function createDraftProblemStatements(
  input: CreateDraftProblemStatementsIn
): Promise<CreateDraftProblemStatementsOut> {
  "use server";
  return api.post("/resources/problem_statements", input);
}

async function createDraftObjectives(
  input: CreateDraftObjectivesIn
): Promise<CreateDraftObjectivesOut> {
  "use server";
  return api.post("/resources/objectives", input);
}

async function createDraftQuestions(
  input: CreateDraftQuestionsIn
): Promise<CreateDraftQuestionsOut> {
  "use server";
  return api.post("/resources/questions", input);
}

async function getScenario(input: GetScenarioIn): Promise<GetScenarioOut> {
  "use server";
  return api.post("/artifacts/scenarios/get", input);
}

async function saveScenario(input: SaveScenarioIn): Promise<SaveScenarioOut> {
  "use server";
  return api.post("/artifacts/scenarios/save", input);
}

async function patchScenarioDraft(
  input: PatchScenarioDraftIn
): Promise<PatchScenarioDraftOut> {
  "use server";
  return api.patch("/artifacts/scenarios/draft", input);
}

async function createDraftImages(
  input: CreateDraftImagesIn
): Promise<CreateDraftImagesOut> {
  "use server";
  return api.post("/resources/images", input);
}

async function createDraftVideos(
  input: CreateDraftVideosIn
): Promise<CreateDraftVideosOut> {
  "use server";
  return api.post("/resources/videos", input);
}

async function createDraftParameterFields(
  input: CreateDraftParameterFieldsIn
): Promise<CreateDraftParameterFieldsOut> {
  "use server";
  return api.post("/resources/parameter_fields", input);
}

async function createDraftOptions(
  input: CreateDraftOptionsIn
): Promise<CreateDraftOptionsOut> {
  "use server";
  return api.post("/resources/options", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/scenarios/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/scenarios/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/scenarios/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
}

export default async function NewScenarioPage({
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

  // Load typed search params using nuqs
  const q = loadScenarioSearchParams(searchParamsObj);

  // Extract dynamic params (not handled by nuqs parsers)
  const fieldShowSelectedByParam =
    extractFieldShowSelectedByParam(searchParamsObj);

  // Fetch default scenario detail server-side with filter params
  const scenarioDetailDefault = await getScenario({
    body: {
      draft_id: q.draftId ?? null,
      filter_department_ids: csvToArray(q.departmentIds) ?? null,
      filter_persona_ids: csvToArray(q.personaIds) ?? null,
      filter_document_ids: csvToArray(q.documentIds) ?? null,
      filter_parameter_ids: csvToArray(q.parameterIds) ?? null,
      filter_field_ids: csvToArray(q.fieldIds) ?? null,
      persona_search: q.personaSearch ?? null,
      document_search: q.documentSearch ?? null,
      parameter_search: q.parameterSearch ?? null,
      description_search: q.descriptionSearch ?? null,
      problem_statement_search: q.problemStatementSearch ?? null,
      image_search: q.imageSearch ?? null,
      video_search: q.videoSearch ?? null,
      document_show_selected: q.documentShowSelected ?? null,
      persona_show_selected: q.personaShowSelected ?? null,
      parameter_show_selected: q.parameterShowSelected ?? null,
      field_show_selected_by_param: fieldShowSelectedByParam
        ? Object.entries(fieldShowSelectedByParam).map(
            ([parameter_id, show_selected]) => ({
              parameter_id,
              show_selected,
            })
          )
        : null,
      problem_statement_ids: csvToArray(q.problemStatementIds) ?? null,
      mcp: false,
    },
  });

  return (
    <div
      className="space-y-6"
      data-page="scenario-new"
      aria-label="Create new scenario page"
    >
      <Scenario
        scenarioDetailDefault={scenarioDetailDefault}
        saveScenarioAction={saveScenario}
        patchScenarioDraftAction={patchScenarioDraft}
        createNamesAction={createDraftNames}
        createDescriptionsAction={createDraftDescriptions}
        createProblemStatementsAction={createDraftProblemStatements}
        createObjectivesAction={createDraftObjectives}
        createQuestionsAction={createDraftQuestions}
        createImagesAction={createDraftImages}
        createVideosAction={createDraftVideos}
        createParameterFieldsAction={createDraftParameterFields}
        createOptionsAction={createDraftOptions}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetScenarioIn,
  GetScenarioOut,
  PatchScenarioDraftIn,
  PatchScenarioDraftOut,
  SaveScenarioIn,
  SaveScenarioOut,
};
