/**
 * app/(main)/training/scenarios/new/page.tsx
 * New scenario creation page with server actions
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Scenario from "@/components/artifacts/scenario/Scenario";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import {
  csvToArray,
  extractFieldShowSelectedByParam,
  loadScenarioSearchParams,
} from "@/lib/search-params/scenarios";

/** ---- Strong types from OpenAPI ---- */
type GetScenarioIn = InputOf<"/scenarios/get", "post">;
type GetScenarioOut = OutputOf<"/scenarios/get", "post">;
type CreateScenarioIn = InputOf<"/scenarios/create", "post">;
type CreateScenarioOut = OutputOf<"/scenarios/create", "post">;
type PatchScenarioDraftIn = InputOf<"/scenarios/draft", "patch">;
type PatchScenarioDraftOut = OutputOf<"/scenarios/draft", "patch">;

/** Upload action result — matches the interface expected by resource components */
type UploadResult = { success: boolean; upload_id?: string; message?: string };

async function getScenario(input: GetScenarioIn): Promise<GetScenarioOut> {
  "use server";
  return api.post("/scenarios/get", input);
}

async function createScenario(input: CreateScenarioIn): Promise<CreateScenarioOut> {
  "use server";
  return api.post("/scenarios/create", input);
}

async function patchScenarioDraft(
  input: PatchScenarioDraftIn
): Promise<PatchScenarioDraftOut> {
  "use server";
  return api.patch("/scenarios/draft", input);
}

async function uploadFile(formData: FormData): Promise<UploadResult> {
  "use server";
  try {
    const file = formData.get("file") as File | null;
    if (!file) return { success: false, message: "No file provided" };

    const { getAuthHeaders } = await import("@/lib/api/auth-headers");
    const { INTERNAL_HTTP_BASE } = await import("@/lib/api/config");
    const authHeaders = await getAuthHeaders();

    const response = await fetch(`${INTERNAL_HTTP_BASE}/v5/scenarios/upload`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": file.type || "application/octet-stream",
        "X-Filename": file.name,
      },
      body: Buffer.from(await file.arrayBuffer()),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, message: text || "Upload failed" };
    }

    const result = await response.json();
    return { success: true, upload_id: result.upload_id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return { success: false, message };
  }
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/scenarios/docs", "post">;
type DocsOut = OutputOf<"/scenarios/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/scenarios/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.page_metadata?.new.title, description: docs.page_metadata?.new.description };
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
  const [scenarioDetailDefault, draftsResult] = await Promise.all([
    getScenario({
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
      parameter_ids: csvToArray(q.parameterIds) ?? null,
      mcp: false,
    },
  }),
    api.post("/scenarios/drafts", {})
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <PageHeader
        breadcrumbs={[
          { title: "Training", section: "training", url: "/training" },
          { title: "Scenarios", section: "scenarios", url: "/training/scenarios" },
          { title: "New Scenario" },
        ]}
        toolbar={<SaveToolbar />}
      />
      <div
        className="space-y-6 px-4"
        data-page="scenario-new"
        aria-label="Create new scenario page"
      >
        <Scenario
          scenarioDetailDefault={scenarioDetailDefault}
          createScenarioAction={createScenario}
          patchScenarioDraftAction={patchScenarioDraft}
          uploadBasePath="/scenarios"
          uploadFileAction={uploadFile}
        />
      </div>
    </DraftProviderClient>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetScenarioIn,
  GetScenarioOut,
  PatchScenarioDraftIn,
  PatchScenarioDraftOut,
  CreateScenarioIn,
  CreateScenarioOut,
};
