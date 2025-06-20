/**
 * app/(main)/management/evals/e/[evalId]/r/page.tsx
 * Evaluation Run page. Redirects to new evaluation run page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { use } from "react";
import { redirect } from "next/navigation";

import type { Metadata, ResolvingMetadata } from "next";
import { getEval } from "@/utils/queries/evals/get-eval";

export async function generateMetadata(
  { params }: { params: Promise<{ evalId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { evalId } = await params

  const evalDetails = await getEval(evalId);

  return {
    title: `${evalDetails?.name || "Eval"} Runs`,
    description: `${evalDetails?.name + " " + evalDetails?.description || "Eval"} runs in GLOW (Graduate Learning Orientation Workshop) at Purdue University.`,
  };
}

export default function EvaluationRunPage({
  params,
}: {
  params: Promise<{ evalId: string }>;
}) {
  const { evalId } = use(params);
  return redirect(`/management/evals/e/${evalId}/edit`);
}