/**
 * app/(main)/engine/evals/e/[evalId]/page.tsx
 * Eval detail/edit page
 * @AshokSaravanan222
 * 01/26/2025
 */

import Eval from "@/components/evals/Eval";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type EvalDetailIn = InputOf<"/api/v4/evals/detail", "post">;
type EvalDetailOut = OutputOf<"/api/v4/evals/detail", "post">;
type UpdateEvalIn = InputOf<"/api/v4/evals/update", "post">;
type UpdateEvalOut = OutputOf<"/api/v4/evals/update", "post">;
type PatchEvalDraftIn = InputOf<"/api/v4/evals/draft", "patch">;
type PatchEvalDraftOut = OutputOf<"/api/v4/evals/draft", "patch">;
// Note: Run/stop eval functionality moved to websocket events (evals_start, evals_stop)

/** ---- Direct fetch for eval detail ---- */
const getEvalDetail = async (input: EvalDetailIn): Promise<EvalDetailOut> => {
  return api.post("/evals/detail", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Eval Details",
    description:
      "View and edit automated evaluation runs for teaching assistant assessments. Monitor batch evaluation progress, review pedagogical performance metrics, and analyze teaching effectiveness across multiple practice sessions.",
  };
}

/** ---- Strongly-typed server actions ---- */
async function updateEval(input: UpdateEvalIn): Promise<UpdateEvalOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/evals/update", input);
}

async function patchEvalDraft(
  input: PatchEvalDraftIn
): Promise<PatchEvalDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/evals/draft", input);
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
  };
  const loadEvalSearchParams = createLoader(evalSearchParams);
  const q = loadEvalSearchParams(searchParamsObj);

  // Fetch eval detail with draft_id
  const input: EvalDetailIn = {
    body: {
      eval_id: evalId,
      draft_id: q.draftId ?? null,
    } as EvalDetailIn["body"],
  };
  const evalDetail = await getEvalDetail(input);

  return (
    <div
      className="space-y-6"
      data-page="eval-edit"
      aria-label="Edit eval page"
    >
      <Eval
        evalId={evalId}
        evalDetail={evalDetail}
        updateEvalAction={updateEval}
        patchEvalDraftAction={patchEvalDraft}
      />
    </div>
  );
}

/** ---- Export types for client component ---- */
export type {
  EvalDetailIn,
  EvalDetailOut,
  UpdateEvalIn,
  UpdateEvalOut,
  PatchEvalDraftIn,
  PatchEvalDraftOut,
};
