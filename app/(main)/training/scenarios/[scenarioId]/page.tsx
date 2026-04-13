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
type UpdateScenarioIn = InputOf<"/scenarios/update", "post">;
type UpdateScenarioOut = OutputOf<"/scenarios/update", "post">;
type PatchScenarioDraftIn = InputOf<"/scenarios/draft", "patch">;
type PatchScenarioDraftOut = OutputOf<"/scenarios/draft", "patch">;

/** Upload action result — matches the interface expected by resource components */
type UploadResult = { success: boolean; upload_id?: string; message?: string };

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 * Uses unified get endpoint.
 */
const getScenario = async (input: GetScenarioIn): Promise<GetScenarioOut> => {
  return api.post("/scenarios/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/scenarios/docs", "post">;
type DocsOut = OutputOf<"/scenarios/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/scenarios/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}): Promise<Metadata> {
  const { scenarioId } = await params;
  const docs = await getDocs({ body: { entity_id: scenarioId } });
  return { title: docs.page_metadata?.detail.title, description: docs.page_metadata?.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
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

async function updateScenario(input: UpdateScenarioIn): Promise<UpdateScenarioOut> {
  "use server";
  return api.post("/scenarios/update", input);
}

async function patchScenarioDraft(
  input: PatchScenarioDraftIn
): Promise<PatchScenarioDraftOut> {
  "use server";
  return api.patch("/scenarios/draft", input);
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

  // Fetch scenario detail (always fresh - source of truth) with filter params
  try {
    const parameterIds = csvToArray(q.parameterIds);

    const input: GetScenarioIn = {
      body: {
        id: scenarioId,
        draft_id: q.draftId ?? null,
        mcp: null,
        descriptions: q.descriptionSearch ? {
          search: q.descriptionSearch,
        } : undefined,
        personas: q.personaSearch || q.personaShowSelected ? {
          search: q.personaSearch ?? undefined,
          selected: q.personaShowSelected ?? undefined,
        } : undefined,
        documents: q.documentSearch || q.documentShowSelected ? {
          search: q.documentSearch ?? undefined,
          selected: q.documentShowSelected ?? undefined,
        } : undefined,
        parameters: q.parameterSearch || q.parameterShowSelected ? {
          search: q.parameterSearch ?? undefined,
          selected: q.parameterShowSelected ?? undefined,
        } : undefined,
        problem_statements: q.problemStatementSearch ? {
          search: q.problemStatementSearch,
        } : undefined,
        images: q.imageSearch ? {
          search: q.imageSearch,
        } : undefined,
        videos: q.videoSearch || q.videoEnabled === false ? {
          search: q.videoSearch ?? undefined,
          include: q.videoEnabled ?? undefined,
        } : undefined,
        objectives: q.objectivesEnabled === false ? {
          include: false,
        } : undefined,
        questions: q.questionsEnabled === false ? {
          include: false,
        } : undefined,
        parameter_fields: fieldShowSelectedByParam || parameterIds ? {
          selected: fieldShowSelectedByParam ? Object.entries(fieldShowSelectedByParam).map(
            ([parameter_id, show_selected]) => ({ parameter_id, show_selected })
          ) : undefined,
          parameter_ids: parameterIds ?? undefined,
        } : undefined,
      } as GetScenarioIn["body"],
    };

    const [scenarioDetail, docs, draftsResult] = await Promise.all([
      getScenario(input),
      getDocs({ body: { entity_id: scenarioId } }),
      api.post("/scenarios/drafts", {})
    ]);

    // Entity name from docs (already resolved server-side)
    const entityName = docs.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <PageHeader
          breadcrumbs={[
            { title: "Training", section: "training", url: "/training" },
            { title: "Scenarios", section: "scenarios", url: "/training/scenarios" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
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
            uploadBasePath="/scenarios"
            uploadFileAction={uploadFile}
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
