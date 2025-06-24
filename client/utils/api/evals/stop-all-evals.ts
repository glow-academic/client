/**
 * stop-all-evals.ts
 * Used to stop all evaluations.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

export interface StopAllEvalRunsResponse {
  success: boolean;
  message: string;
}

export interface StopAllEvalRunsParams {
  eval_run_id: string;
}

export async function stopAllEvalRuns(
  params: StopAllEvalRunsParams
): Promise<StopAllEvalRunsResponse> {
  const formData = new FormData();
  formData.append("eval_run_id", params.eval_run_id);

  const response = await fetch(`${getApiUrl()}/evals/stop/all`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
