/**
 * app/e/[evalId]/page.tsx
 * Evaluation page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import EvaluationRun from "@/components/common/chat/EvaluationRun";
import { use } from "react";

export default function EvaluationPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  return (
    <div className="space-y-6">
      <EvaluationRun runId={runId} />
    </div>
  );
}
