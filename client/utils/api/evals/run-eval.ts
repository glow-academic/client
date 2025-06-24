/**
 * run-eval.ts
 * Used to run an evaluation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

export interface RunEvalResponse {
  success: boolean;
  message: string;
}

export interface RunEvalParams {
  eval_run_id: string;
}

export async function runEval(params: RunEvalParams): Promise<RunEvalResponse> {
  const formData = new FormData();
  formData.append("eval_run_id", params.eval_run_id);

  const response = await fetch(`${getApiUrl()}/evals/run`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
