/**
 * app/(main)/management/evals/e/[evalId]/r/page.tsx
 * Evaluation Run page. Redirects to new evaluation run page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { use } from "react";
import { redirect } from "next/navigation";

export default function EvaluationRunPage({
  params,
}: {
  params: Promise<{ evalId: string }>;
}) {
  const { evalId } = use(params);
  return redirect(`/management/evals/e/${evalId}/edit`);
}