/**
 * app/(main)/system/evals/[evalId]/page.tsx
 * Eval detail/edit page
 * @AshokSaravanan222
 * 01/26/2025
 */

import Eval from "@/components/artifacts/eval/Eval";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetEvalIn = InputOf<"/api/v5/artifacts/evals/get", "post">;
type GetEvalOut = OutputOf<"/api/v5/artifacts/evals/get", "post">;
type CreateEvalIn = InputOf<"/api/v5/artifacts/evals/create", "post">;
type CreateEvalOut = OutputOf<"/api/v5/artifacts/evals/create", "post">;
type UpdateEvalIn = InputOf<"/api/v5/artifacts/evals/update", "post">;
type UpdateEvalOut = OutputOf<"/api/v5/artifacts/evals/update", "post">;
type PatchEvalDraftIn = InputOf<"/api/v5/artifacts/evals/draft", "patch">;
type PatchEvalDraftOut = OutputOf<"/api/v5/artifacts/evals/draft", "patch">;
// Note: Run/stop eval functionality moved to websocket events (evals_start, evals_stop)

/** ---- Direct fetch for eval detail ---- */
const getEvalDetail = async (input: GetEvalIn): Promise<GetEvalOut> => {
  return api.post("/artifacts/evals/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/evals/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/evals/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/evals/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ evalId: string }>;
}): Promise<Metadata> {
  const { evalId } = await params;
  const docs = await getDocs({ body: { entity_id: evalId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions ---- */
async function createEval(input: CreateEvalIn): Promise<CreateEvalOut> {
  "use server";
  return api.post("/artifacts/evals/create", input);
}

async function updateEval(input: UpdateEvalIn): Promise<UpdateEvalOut> {
  "use server";
  return api.post("/artifacts/evals/update", input);
}

async function patchEvalDraft(
  input: PatchEvalDraftIn
): Promise<PatchEvalDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/evals/draft", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function EvalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ evalId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { evalId } = await params;
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

  // Inline server-side parsers for eval search params
  const evalSearchParams = {
    draftId: parseAsString,
    agentSearch: parseAsString,
    agentShowSelected: parseAsBoolean,
    modelRunSearch: parseAsString,
    modelRunShowSelected: parseAsBoolean,
    groupSearch: parseAsString,
    groupShowSelected: parseAsBoolean,
  };
  const loadEvalSearchParams = createLoader(evalSearchParams);
  const q = loadEvalSearchParams(searchParamsObj);

  // Fetch eval detail with draft_id and search params
  const input: GetEvalIn = {
    body: {
      eval_id: evalId, // Provided for detail mode
      draft_id: q.draftId ?? null,
      agent_search: q.agentSearch ?? null,
      group_search: q.groupSearch ?? null,
      // Note: available_model_runs_search uses modelRunSearch from URL
      available_model_runs_search: q.modelRunSearch ?? null,
    } as GetEvalIn["body"],
  };
  const [evalDetail, docs, draftsResult] = await Promise.all([
    getEvalDetail(input),
    getDocs({ body: { entity_id: evalId } }),
    api.post("/artifacts/evals/drafts", {})
  ]);

  const entityName = docs.detail.title;

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <PageHeader
        breadcrumbs={[
          { title: "System", section: "system", url: "/system" },
          { title: "Evals", section: "evals", url: "/system/evals" },
          { title: entityName },
        ]}
        toolbar={<SaveToolbar />}
      />
      <div
        className="space-y-6 px-4"
        data-page="eval-edit"
        aria-label="Edit eval page"
      >
        <Eval
          evalId={evalId}
          evalDetail={evalDetail}
          createEvalAction={createEval}
            updateEvalAction={updateEval}
          patchEvalDraftAction={patchEvalDraft}
        />
      </div>
    </DraftProviderClient>
  );
}

/** ---- Export types for client component ---- */
export type {
  GetEvalIn as EvalDetailIn,
  GetEvalOut as EvalDetailOut,
  PatchEvalDraftIn,
  PatchEvalDraftOut,
  CreateEvalIn,
  CreateEvalOut,
  UpdateEvalIn,
  UpdateEvalOut,
};
