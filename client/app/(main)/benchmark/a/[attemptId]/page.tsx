/**
 * app/benchmark/a/[attemptId]/page.tsx
 * Eval attempt status page for the user.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import EvalAttemptStatus from "@/components/benchmark/EvalAttemptStatus";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type EvalAttemptFullIn = InputOf<"/api/v3/evals/attempt/full", "post">;
type EvalAttemptFullOut = OutputOf<"/api/v3/evals/attempt/full", "post">;
type AgentsListOut = OutputOf<"/api/v3/agents/list", "post">;
type UpdateEvalAttemptIn = InputOf<"/api/v3/evals/attempt/update", "post">;
type UpdateEvalAttemptOut = OutputOf<"/api/v3/evals/attempt/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for websocket/attempt pages.
 */
const getEvalAttemptFull = async (
  _attemptId: string,
  input: EvalAttemptFullIn,
): Promise<EvalAttemptFullOut> => {
  return api.post("/evals/attempt/full", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

const getAgentsList = async (): Promise<AgentsListOut> => {
  "use server";
  return api.post("/agents/list", { body: {} }, { cache: "no-store" });
};

const updateEvalAttemptSettings = async (
  input: UpdateEvalAttemptIn,
): Promise<UpdateEvalAttemptOut> => {
  "use server";
  return api.post("/evals/attempt/update", input, { cache: "no-store" });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ attemptId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { attemptId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const attemptData = await getEvalAttemptFull(attemptId, {
      body: { attemptId },
    });
    const evalName = attemptData?.eval?.["name"];
    return {
      title: `Benchmark ${evalName || "Attempt"}`,
      description: `${evalName ? `${evalName} - ` : ""}Evaluation benchmark attempt for teaching assistant training platform. Monitor evaluation progress, analyze performance metrics, and review results.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: `Benchmark Attempt ${attemptId.substring(0, 8)}...`,
    description:
      "Evaluation benchmark attempt for teaching assistant training platform. Monitor evaluation progress, analyze performance metrics, and review results.",
  };
}

/** ---- Page component ---- */
export default async function BenchmarkAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch attempt data server-side
  try {
    const attemptData = await getEvalAttemptFull(attemptId, {
      body: { attemptId },
    });
    const agentsList = await getAgentsList();

    return (
      <div className="space-y-6">
        <EvalAttemptStatus
          attemptId={attemptId}
          attemptData={attemptData}
          agentsList={agentsList}
          updateEvalAttemptSettings={updateEvalAttemptSettings}
        />
      </div>
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
          resourceType="eval"
          redirectPath="/benchmark"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Re-export types for consistency ---- */
export type {
  EvalAttemptFullIn,
  EvalAttemptFullOut,
  AgentsListOut,
  UpdateEvalAttemptIn,
  UpdateEvalAttemptOut,
};

