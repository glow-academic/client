/**
 * app/e/[evalId]/page.tsx
 * Evaluation page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

"use client";

import Evaluation from "@/components/common/chat/Evaluation";
import { use } from "react";

export default function EvaluationPage({
  params,
}: {
  params: Promise<{ evalId: string }>;
}) {
  const { evalId } = use(params);
  return (
    <div className="space-y-6">
      <Evaluation evaluationId={evalId} />
    </div>
  );
}
