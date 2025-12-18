/**
 * app/(main)/benchmark/er/[eval_run_id]/page.tsx
 * Benchmark evaluation run detail page.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ eval_run_id: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { eval_run_id } = await params;

  return {
    title: `Evaluation Run ${eval_run_id.substring(0, 8)}...`,
    description:
      "Evaluation run details for teaching assistant training platform. Review benchmark test results, analyze performance metrics, and evaluate system effectiveness for educational institutions and L&D programs.",
  };
}

export default async function BenchmarkEvalRunPage({
  params,
}: {
  params: Promise<{ eval_run_id: string }>;
}) {
  const {} = await params;

  // Access control is handled server-side in layout

  return <div className="space-y-6">{/* Content will be added later */}</div>;
}
