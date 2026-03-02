/**
 * app/(main)/system/evals/new/page.tsx
 * New eval page
 * @AshokSaravanan222
 * 01/26/2025
 */
import Eval from "@/components/artifacts/eval/Eval";
import { resolveGroupId } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import {
  createLoader,
  parseAsBoolean,
  parseAsString,
} from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetEvalIn = InputOf<"/api/v4/artifacts/evals/get", "post">;
type GetEvalOut = OutputOf<"/api/v4/artifacts/evals/get", "post">;
type SaveEvalIn = InputOf<"/api/v4/artifacts/evals/save", "post">;
type SaveEvalOut = OutputOf<"/api/v4/artifacts/evals/save", "post">;
type PatchEvalDraftIn = InputOf<"/api/v4/artifacts/evals/draft", "patch">;
type PatchEvalDraftOut = OutputOf<"/api/v4/artifacts/evals/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getEvalDefault = async (input: GetEvalIn): Promise<GetEvalOut> => {
  return api.post("/artifacts/evals/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata ---- */
/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/evals/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/evals/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/evals/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
}

/** ---- Strongly-typed server actions ---- */
async function saveEval(input: SaveEvalIn): Promise<SaveEvalOut> {
  "use server";
  // profileId comes from X-Profile-Id header automatically
  return api.post("/artifacts/evals/save", input);
}

async function patchEvalDraft(
  input: PatchEvalDraftIn
): Promise<PatchEvalDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/evals/draft", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewEvalPage({
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

  // Resolve group_id from layout context (cached per request)
  const groupId = (await resolveGroupId({ draft_id: q.draftId ?? null, artifact_type: "eval" })).group_id;

  // Fetch eval default data (for dropdowns and defaults) with draft_id and search params
  const input: GetEvalIn = {
    body: {
      eval_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
      group_id: groupId,
      agent_search: q.agentSearch ?? null,
      group_search: q.groupSearch ?? null,
      // Note: available_model_runs_search uses modelRunSearch from URL
      available_model_runs_search: q.modelRunSearch ?? null,
    } as GetEvalIn["body"],
  };
  const evalDetailDefault = await getEvalDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="eval-new"
      aria-label="Create new eval page"
    >
      <Eval
        evalDetailDefault={evalDetailDefault}
        createEvalAction={saveEval}
        patchEvalDraftAction={patchEvalDraft}
      />
    </div>
  );
}

/** ---- Export types for client component ---- */
export type {
  GetEvalIn as EvalNewIn,
  GetEvalOut as EvalNewOut,
  SaveEvalIn as CreateEvalIn,
  SaveEvalOut as CreateEvalOut,
  PatchEvalDraftIn,
  PatchEvalDraftOut,
};
