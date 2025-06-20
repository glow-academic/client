/**
 * app/(main)/management/evals/e/[evalId]/r/[runId]/page.tsx
 * Evaluation page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import EvaluationRun from "@/components/common/chat/EvaluationRun";
import { use } from "react";

import type { Metadata, ResolvingMetadata } from "next";
import { getEval } from "@/utils/queries/evals/get-eval";
import { getEvalRun } from "@/utils/queries/eval_runs/get-eval-run";
import { getAgent } from "@/utils/queries/agents/get-agent";

export async function generateMetadata(
  { params }: { params: Promise<{ evalId: string, runId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { runId } = await params

  const evalRunData = await getEvalRun(runId);
  // get the agent for the eval run
  if (!evalRunData) {
    return {
      title: `Eval Run ${runId.substring(0, 8)}...`,
      description: `Eval Run ${runId.substring(0, 8)}... in GLOW (Graduate Learning Orientation Workshop) at Purdue University.`,
    };
  }
  const agentEvalData = await getAgent(evalRunData?.agentId);
  // get base agent from eval
  const evalRunEvalData = await getEval(evalRunData?.evalId || "");
  const baseAgent = await getAgent(evalRunEvalData?.baseAgentId || "");
  return {
    title: `${baseAgent?.name} vs ${agentEvalData?.name}`,
    description: `${baseAgent?.name + " " + baseAgent?.description || "Base Agent"} vs ${agentEvalData?.name + " " + agentEvalData?.description || "Agent"} in GLOW (Graduate Learning Orientation Workshop) at Purdue University.`,
  };
}

export default function EvaluationPage({
  params,
}: {
  params: Promise<{ evalId: string, runId: string }>;
}) {
  const { runId } = use(params);
  return (
    <div className="space-y-6">
      <EvaluationRun runId={runId} />
    </div>
  );
}
