/**
 * app/(main)/management/evals/e/[evalId]/edit/page.tsx
 * Page for the eval page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import EvalEdit from "@/components/management/evals/EvalEdit";
import { use } from "react";

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
    title: `Edit ${evalDetails?.name || "Eval"}`,
    description: `Edit ${evalDetails?.name + " " + evalDetails?.description || "Eval"} in GLOW (Graduate Learning Orientation Workshop) at Purdue University.`,
  };
}

export default function EvalEditPage({
  params,
}: {
  params: Promise<{ evalId: string }>;
}) {
  const { evalId } = use(params);
  return (
    <div className="space-y-6">
      <EvalEdit evalId={evalId} />
    </div>
  );
}
