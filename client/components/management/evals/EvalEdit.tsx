/**
 * EvalEdit.tsx
 * Used to display the edit for the evals page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import Eval from "@/components/common/eval/Eval";

export default function EvalEdit({ evalId }: { evalId: string }) {
  return <Eval evalId={evalId} mode="edit" />;
}
