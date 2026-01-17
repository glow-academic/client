/**
 * app/create/scenarios/new/page.tsx
 * New scenario creation page with server actions
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Scenario from "@/components/scenarios/Scenario";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import {
  csvToArray,
  extractFieldShowSelectedByParam,
  loadScenarioSearchParams,
} from "../searchParams";

/** ---- Strong types from OpenAPI ---- */
type GetScenarioIn = InputOf<"/api/v4/scenarios/get", "post">;
type GetScenarioOut = OutputOf<"/api/v4/scenarios/get", "post">;
type SaveScenarioIn = InputOf<"/api/v4/scenarios/save", "post">;
type SaveScenarioOut = OutputOf<"/api/v4/scenarios/save", "post">;
// Keep old types for backward compatibility during migration
type ScenarioNewIn = InputOf<"/api/v4/scenarios/new", "post">;
type ScenarioNewOut = OutputOf<"/api/v4/scenarios/new", "post">;
type CreateScenarioIn = InputOf<"/api/v4/scenarios/create", "post">;
type CreateScenarioOut = OutputOf<"/api/v4/scenarios/create", "post">;
type UpdateScenarioIn = InputOf<"/api/v4/scenarios/update", "post">;
type UpdateScenarioOut = OutputOf<"/api/v4/scenarios/update", "post">;
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
type CreateDraftScenarioFlagsIn = InputOf<
  "/api/v4/resources/scenario_flags",
  "post"
>;
type CreateDraftScenarioFlagsOut = OutputOf<
  "/api/v4/resources/scenario_flags",
  "post"
>;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 * Uses unified get endpoint with scenario_id = null for new mode.
 */
const getScenarioDefault = async (
  input: ScenarioNewIn
): Promise<GetScenarioOut> => {
  // Convert to unified get endpoint format
  const getInput: GetScenarioIn = {
    body: {
      scenario_id: null,
      draft_id: input.body.draft_id,
      filter_department_ids: input.body.filter_department_ids,
      filter_persona_ids: input.body.filter_persona_ids,
      filter_document_ids: input.body.filter_document_ids,
      template_document_ids: input.body.template_document_ids,
      filter_parameter_ids: input.body.filter_parameter_ids,
      filter_field_ids: input.body.filter_field_ids,
      persona_search: input.body.persona_search,
      document_search: input.body.document_search,
      parameter_search: input.body.parameter_search,
      document_show_selected: input.body.document_show_selected,
      persona_show_selected: input.body.persona_show_selected,
      parameter_show_selected: input.body.parameter_show_selected,
      field_show_selected_by_param: input.body.field_show_selected_by_param,
      use_image: input.body.use_image,
      use_video: input.body.use_video,
      image_ids: input.body.image_ids,
      objective_ids: input.body.objective_ids,
      problem_statement_ids: input.body.problem_statement_ids,
    },
  };
  return api.post("/scenarios/get", getInput, {
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
  // Convert to unified save endpoint
  const saveInput: SaveScenarioIn = {
    body: {
      ...input.body,
      input_scenario_id: null,
    },
  };
  const result = await api.post("/scenarios/save", saveInput);
  // Convert back to CreateScenarioOut format for compatibility
  return {
    body: {
      scenario_id: result.body.scenario_id,
      actor_name: result.body.actor_name,
    },
  };
}

async function patchScenarioDraft(
  input: PatchScenarioDraftIn
): Promise<PatchScenarioDraftOut> {
  "use server";
  // TODO: Investigate - scenarios/draft endpoint doesn't exist on server
  throw new Error("scenarios/draft endpoint doesn't exist on server");
  // return api.patch("/scenarios/draft", input);
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
  const scenarioDetailDefault = await getScenarioDefault({
    body: {
      draft_id: q.draftId ?? null,
      filter_department_ids: csvToArray(q.departmentIds) ?? null,
      filter_persona_ids: csvToArray(q.personaIds) ?? null,
      filter_document_ids: csvToArray(q.documentIds) ?? null,
      template_document_ids: csvToArray(q.templateDocumentIds) ?? null,
      filter_parameter_ids: csvToArray(q.parameterIds) ?? null,
      filter_field_ids: csvToArray(q.fieldIds) ?? null,
      persona_search: q.personaSearch ?? null,
      document_search: q.documentSearch ?? null,
      parameter_search: q.parameterSearch ?? null,
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
      use_image: q.useImage ?? null,
      use_video: q.useVideo ?? null,
      image_ids: csvToArray(q.imageIds) ?? null,
      objective_ids: csvToArray(q.objectiveIds) ?? null,
      problem_statement_ids: csvToArray(q.problemStatementIds) ?? null,
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
        patchScenarioDraftAction={patchScenarioDraft}
        createNamesAction={createDraftNames}
        createDescriptionsAction={createDraftDescriptions}
        createProblemStatementsAction={createDraftProblemStatements}
        createObjectivesAction={createDraftObjectives}
        createScenarioFlagsAction={createDraftScenarioFlags}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateScenarioIn,
  CreateScenarioOut,
  GetScenarioIn,
  GetScenarioOut,
  PatchScenarioDraftIn,
  PatchScenarioDraftOut,
  SaveScenarioIn,
  SaveScenarioOut,
  ScenarioNewIn,
  ScenarioNewOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
};
