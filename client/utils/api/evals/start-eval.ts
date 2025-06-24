/**
 * start-eval.ts
 * Used to start an evaluation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

export interface EvalRunResponse {
    success: boolean;
    message: string;
    eval_run_id?: string;
  }

export async function startEval(evalId: string): Promise<EvalRunResponse> {
    const formData = new FormData();
    formData.append("eval_id", evalId);
  
    const response = await fetch(`${getApiUrl()}/evals/start`, {
      method: "POST",
      body: formData,
    });
  
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    return response.json();
  }