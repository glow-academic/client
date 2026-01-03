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
type ScenarioNewIn = InputOf<"/api/v4/scenarios/new", "post">;
type ScenarioNewOut = OutputOf<"/api/v4/scenarios/new", "post">;
type CreateScenarioIn = InputOf<"/api/v4/scenarios/create", "post">;
type CreateScenarioOut = OutputOf<"/api/v4/scenarios/create", "post">;
type UpdateScenarioIn = InputOf<"/api/v4/scenarios/update", "post">;
type UpdateScenarioOut = OutputOf<"/api/v4/scenarios/update", "post">;
type PatchScenarioDraftIn = InputOf<"/api/v4/scenarios/draft", "patch">;
type PatchScenarioDraftOut = OutputOf<"/api/v4/scenarios/draft", "patch">;

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

async function patchScenarioDraft(
  input: PatchScenarioDraftIn
): Promise<PatchScenarioDraftOut> {
  "use server";
  return api.patch("/scenarios/draft", input);
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
        ? Object.entries(fieldShowSelectedByParam).map(([parameter_id, show_selected]) => ({
            parameter_id,
            show_selected,
          }))
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
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateScenarioIn,
  CreateScenarioOut,
  PatchScenarioDraftIn,
  PatchScenarioDraftOut,
  ScenarioNewIn,
  ScenarioNewOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
};
