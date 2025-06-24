/**
 * run-eval.ts
 * Used to run an evaluation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

export async function runEval(evalRunId: string): Promise<Response> {
    const formData = new FormData();
    formData.append("eval_run_id", evalRunId);
  
    const response = await fetch(`${getApiUrl()}/evals/run`, {
      method: "POST",
      body: formData,
    });
  
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    return response;
  }