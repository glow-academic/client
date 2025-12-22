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
  extractFieldRanges,
  extractFieldShowSelectedByParam,
  loadScenarioSearchParams,
} from "../searchParams";

/** ---- Strong types from OpenAPI ---- */
type ScenarioNewIn = InputOf<"/api/v3/scenarios/new", "post">;
type ScenarioNewOut = OutputOf<"/api/v3/scenarios/new", "post">;
type CreateScenarioIn = InputOf<"/api/v3/scenarios/create", "post">;
type CreateScenarioOut = OutputOf<"/api/v3/scenarios/create", "post">;
type UpdateScenarioIn = InputOf<"/api/v3/scenarios/update", "post">;
type UpdateScenarioOut = OutputOf<"/api/v3/scenarios/update", "post">;

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
  const fieldRanges = extractFieldRanges(searchParamsObj);

  // Fetch default scenario detail server-side with filter params
  const scenarioDetailDefault = await getScenarioDefault({
    body: {
      departmentIds: csvToArray(q.departmentIds) ?? null,
      personaIds: csvToArray(q.personaIds) ?? null,
      documentIds: csvToArray(q.documentIds) ?? null,
      templateDocumentIds: csvToArray(q.templateDocumentIds) ?? null,
      parameterIds: csvToArray(q.parameterIds) ?? null,
      fieldIds: csvToArray(q.fieldIds) ?? null,
      personaSearch: q.personaSearch ?? null,
      documentSearch: q.documentSearch ?? null,
      parameterSearch: q.parameterSearch ?? null,
      documentShowSelected: q.documentShowSelected ?? null,
      documentShowTemplate: q.documentShowTemplate ?? null,
      personaShowSelected: q.personaShowSelected ?? null,
      parameterShowSelected: q.parameterShowSelected ?? null,
      fieldShowSelectedByParam: fieldShowSelectedByParam ?? null,
      personaMin: q.personaMin ?? null,
      personaMax: q.personaMax ?? null,
      documentMin: q.documentMin ?? null,
      documentMax: q.documentMax ?? null,
      parameterSelectionMin: q.parameterSelectionMin ?? null,
      parameterSelectionMax: q.parameterSelectionMax ?? null,
      fieldRanges: fieldRanges ?? null,
      randomize: q.randomize ?? null,
      useImage: q.useImage ?? null,
      useVideo: q.useVideo ?? null,
      imageIds: csvToArray(q.imageIds) ?? null,
      objectiveIds: csvToArray(q.objectiveIds) ?? null,
      problemStatementIds: csvToArray(q.problemStatementIds) ?? null,
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
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateScenarioIn,
  CreateScenarioOut,
  ScenarioNewIn,
  ScenarioNewOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
};
