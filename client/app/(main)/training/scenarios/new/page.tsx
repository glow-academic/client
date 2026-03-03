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
import { resolveGroupId } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type GetScenarioIn = InputOf<"/api/v5/artifacts/scenarios/get", "post">;
type GetScenarioOut = OutputOf<"/api/v5/artifacts/scenarios/get", "post">;
type SaveScenarioIn = InputOf<"/api/v5/artifacts/scenarios/save", "post">;
type SaveScenarioOut = OutputOf<"/api/v5/artifacts/scenarios/save", "post">;
// Keep old types for backward compatibility during migration
type PatchScenarioDraftIn = InputOf<"/api/v5/artifacts/scenarios/draft", "patch">;
type PatchScenarioDraftOut = OutputOf<"/api/v5/artifacts/scenarios/draft", "patch">;
// Resource creation types
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
type CreateDraftProblemStatementsIn = InputOf<
  "/api/v5/resources/problem_statements",
  "post"
>;
type CreateDraftProblemStatementsOut = OutputOf<
  "/api/v5/resources/problem_statements",
  "post"
>;
type CreateDraftObjectivesIn = InputOf<"/api/v5/resources/objectives", "post">;
type CreateDraftObjectivesOut = OutputOf<
  "/api/v5/resources/objectives",
  "post"
>;
type CreateDraftQuestionsIn = InputOf<"/api/v5/resources/questions", "post">;
type CreateDraftQuestionsOut = OutputOf<"/api/v5/resources/questions", "post">;
type CreateDraftImagesIn = InputOf<"/api/v5/resources/images", "post">;
type CreateDraftImagesOut = OutputOf<"/api/v5/resources/images", "post">;
type CreateDraftVideosIn = InputOf<"/api/v5/resources/videos", "post">;
type CreateDraftVideosOut = OutputOf<"/api/v5/resources/videos", "post">;
type CreateDraftParameterFieldsIn = InputOf<"/api/v5/resources/parameter_fields", "post">;
type CreateDraftParameterFieldsOut = OutputOf<"/api/v5/resources/parameter_fields", "post">;
type CreateDraftOptionsIn = InputOf<"/api/v5/resources/options", "post">;
type CreateDraftOptionsOut = OutputOf<"/api/v5/resources/options", "post">;
// Link types for tool call tracking
type LinkNamesIn = InputOf<"/api/v5/resources/names/link", "post">;
type LinkNamesOut = OutputOf<"/api/v5/resources/names/link", "post">;
type LinkDescriptionsIn = InputOf<"/api/v5/resources/descriptions/link", "post">;
type LinkDescriptionsOut = OutputOf<"/api/v5/resources/descriptions/link", "post">;
type LinkProblemStatementsIn = InputOf<"/api/v5/resources/problem_statements/link", "post">;
type LinkProblemStatementsOut = OutputOf<"/api/v5/resources/problem_statements/link", "post">;
type LinkObjectivesIn = InputOf<"/api/v5/resources/objectives/link", "post">;
type LinkObjectivesOut = OutputOf<"/api/v5/resources/objectives/link", "post">;
type LinkScenarioFlagsIn = InputOf<"/api/v5/resources/scenario_flags/link", "post">;
type LinkScenarioFlagsOut = OutputOf<"/api/v5/resources/scenario_flags/link", "post">;
type LinkDepartmentsIn = InputOf<"/api/v5/resources/departments/link", "post">;
type LinkDepartmentsOut = OutputOf<"/api/v5/resources/departments/link", "post">;
type LinkPersonasIn = InputOf<"/api/v5/resources/personas/link", "post">;
type LinkPersonasOut = OutputOf<"/api/v5/resources/personas/link", "post">;
type LinkDocumentsIn = InputOf<"/api/v5/resources/documents/link", "post">;
type LinkDocumentsOut = OutputOf<"/api/v5/resources/documents/link", "post">;
type LinkParameterFieldsIn = InputOf<"/api/v5/resources/parameter_fields/link", "post">;
type LinkParameterFieldsOut = OutputOf<"/api/v5/resources/parameter_fields/link", "post">;
type LinkImagesIn = InputOf<"/api/v5/resources/images/link", "post">;
type LinkImagesOut = OutputOf<"/api/v5/resources/images/link", "post">;
type LinkVideosIn = InputOf<"/api/v5/resources/videos/link", "post">;
type LinkVideosOut = OutputOf<"/api/v5/resources/videos/link", "post">;
type LinkQuestionsIn = InputOf<"/api/v5/resources/questions/link", "post">;
type LinkQuestionsOut = OutputOf<"/api/v5/resources/questions/link", "post">;
type LinkOptionsIn = InputOf<"/api/v5/resources/options/link", "post">;
type LinkOptionsOut = OutputOf<"/api/v5/resources/options/link", "post">;

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

// Link server actions for tool call tracking
async function linkNames(input: LinkNamesIn): Promise<LinkNamesOut> {
  "use server";
  return api.post("/resources/names/link", input);
}
async function linkDescriptions(input: LinkDescriptionsIn): Promise<LinkDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions/link", input);
}
async function linkProblemStatements(input: LinkProblemStatementsIn): Promise<LinkProblemStatementsOut> {
  "use server";
  return api.post("/resources/problem_statements/link", input);
}
async function linkObjectives(input: LinkObjectivesIn): Promise<LinkObjectivesOut> {
  "use server";
  return api.post("/resources/objectives/link", input);
}
async function linkScenarioFlags(input: LinkScenarioFlagsIn): Promise<LinkScenarioFlagsOut> {
  "use server";
  return api.post("/resources/scenario_flags/link", input);
}
async function linkDepartments(input: LinkDepartmentsIn): Promise<LinkDepartmentsOut> {
  "use server";
  return api.post("/resources/departments/link", input);
}
async function linkPersonas(input: LinkPersonasIn): Promise<LinkPersonasOut> {
  "use server";
  return api.post("/resources/personas/link", input);
}
async function linkDocuments(input: LinkDocumentsIn): Promise<LinkDocumentsOut> {
  "use server";
  return api.post("/resources/documents/link", input);
}
async function linkParameterFields(input: LinkParameterFieldsIn): Promise<LinkParameterFieldsOut> {
  "use server";
  return api.post("/resources/parameter_fields/link", input);
}
async function linkImages(input: LinkImagesIn): Promise<LinkImagesOut> {
  "use server";
  return api.post("/resources/images/link", input);
}
async function linkVideos(input: LinkVideosIn): Promise<LinkVideosOut> {
  "use server";
  return api.post("/resources/videos/link", input);
}
async function linkQuestions(input: LinkQuestionsIn): Promise<LinkQuestionsOut> {
  "use server";
  return api.post("/resources/questions/link", input);
}
async function linkOptions(input: LinkOptionsIn): Promise<LinkOptionsOut> {
  "use server";
  return api.post("/resources/options/link", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/scenarios/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/scenarios/docs", "post">;

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

  // Resolve group_id from layout context (cached per request)
  const groupId = (await resolveGroupId({ draft_id: q.draftId ?? null, artifact_type: "scenario" })).group_id;

  // Fetch default scenario detail server-side with filter params
  const scenarioDetailDefault = await getScenario({
    body: {
      draft_id: q.draftId ?? null,
      group_id: groupId,
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
      parameter_ids: csvToArray(q.parameterIds) ?? null,
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
        linkNamesAction={linkNames}
        linkDescriptionsAction={linkDescriptions}
        linkProblemStatementsAction={linkProblemStatements}
        linkObjectivesAction={linkObjectives}
        linkScenarioFlagsAction={linkScenarioFlags}
        linkDepartmentsAction={linkDepartments}
        linkPersonasAction={linkPersonas}
        linkDocumentsAction={linkDocuments}
        linkParameterFieldsAction={linkParameterFields}
        linkImagesAction={linkImages}
        linkVideosAction={linkVideos}
        linkQuestionsAction={linkQuestions}
        linkOptionsAction={linkOptions}
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
