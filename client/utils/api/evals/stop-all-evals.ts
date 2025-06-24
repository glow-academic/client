/**
 * stop-all-evals.ts
 * Used to stop all evaluations.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

export async function stopAllEvalRuns(evalRunId: string): Promise<Response> {
  const formData = new FormData();
  formData.append("eval_run_id", evalRunId);

  const response = await fetch(`${getApiUrl()}/evals/stop/all`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
}
