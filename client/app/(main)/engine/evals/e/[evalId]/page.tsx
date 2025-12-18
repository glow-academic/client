/**
 * app/(main)/engine/evals/e/[evalId]/page.tsx
 * Eval detail/edit page
 * @AshokSaravanan222
 * 01/26/2025
 */

import Eval from "@/components/evals/Eval";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type EvalDetailOut = OutputOf<"/api/v3/evals/detail", "post">;
type UpdateEvalIn = InputOf<"/api/v3/evals/update", "post">;
type UpdateEvalOut = OutputOf<"/api/v3/evals/update", "post">;
type RunEvalIn = InputOf<"/api/v3/evals/run", "post">;
type RunEvalOut = OutputOf<"/api/v3/evals/run", "post">;
type StopEvalIn = InputOf<"/api/v3/evals/stop", "post">;
type StopEvalOut = OutputOf<"/api/v3/evals/stop", "post">;

/** ---- Direct fetch for eval detail ---- */
const getEvalDetail = async (
  evalId: string,
): Promise<EvalDetailOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/evals/detail",
    { body: { evalId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
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

/** ---- Server renders client with typed data and actions ---- */
export default async function EvalDetailPage({
  params,
}: {
  params: Promise<{ evalId: string }>;
}) {
  const { evalId } = await params;
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch eval detail
  const evalDetail = await getEvalDetail(evalId);

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
      />
    </div>
  );
}

/** ---- Export types for client component ---- */
export type {
  EvalDetailOut,
  UpdateEvalIn,
  UpdateEvalOut,
  RunEvalIn,
  RunEvalOut,
  StopEvalIn,
  StopEvalOut,
};
