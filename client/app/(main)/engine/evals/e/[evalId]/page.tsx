/**
 * app/(main)/engine/evals/e/[evalId]/page.tsx
 * Eval detail/status view page (read-only)
 * @AshokSaravanan222
 * 01/26/2025
 */
import { getSession } from "@/auth";

import { EvalDetail } from "@/components/evals/EvalDetail";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type EvalDetailOut = OutputOf<"/api/v3/evals/detail", "post">;
type RunEvalIn = InputOf<"/api/v3/evals/run", "post">;
type RunEvalOut = OutputOf<"/api/v3/evals/run", "post">;
type StopEvalIn = InputOf<"/api/v3/evals/stop", "post">;
type StopEvalOut = OutputOf<"/api/v3/evals/stop", "post">;

/** ---- Direct fetch for eval detail ---- */
const getEvalDetail = async (
  evalId: string,
  profileId: string
): Promise<EvalDetailOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/evals/detail",
    { body: { evalId, profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    }
  );
};

/** ---- Metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Eval Details",
    description: "View eval status and results",
  };
}

/** ---- Strongly-typed server actions ---- */
async function runEval(input: RunEvalIn): Promise<RunEvalOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  return api.post("/evals/run", {
    ...input,
    body: { ...input.body, profileId },
  });
}

async function stopEval(input: StopEvalIn): Promise<StopEvalOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  return api.post("/evals/stop", {
    ...input,
    body: { ...input.body, profileId },
  });
}

/** ---- Server renders client with typed data and actions ---- */
export default async function EvalDetailPage({
  params,
}: {
  params: Promise<{ evalId: string }>;
}) {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";
  const { evalId } = await params;

  // Fetch eval detail
  const evalDetail = await getEvalDetail(evalId, profileId);

  return (
    <div className="space-y-6">
      <EvalDetail
        evalDetail={evalDetail}
        runEvalAction={runEval}
        stopEvalAction={stopEval}
      />
    </div>
  );
}

/** ---- Export types for client component ---- */
export type {
  EvalDetailOut,
  RunEvalIn,
  RunEvalOut,
  StopEvalIn,
  StopEvalOut,
};

