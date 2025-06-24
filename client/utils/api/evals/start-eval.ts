/**
 * start-eval.ts
 * Used to start an evaluation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface StartEvalParams {
  eval_id: string;
}

export interface StartEvalResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  eval_run_ids?: string[];
  total_runs?: number;
}

export async function startEval(
  params: StartEvalParams
): Promise<StartEvalResponse> {
  try {
    const formData = new FormData();
    formData.append("eval_id", params.eval_id);

    const response = await fetch(`${getApiUrl()}/evals/start`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.detail ||
        errorData.message ||
        `Failed to start evaluation: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    return {
      success: result.success || true,
      message: result.message || "Evaluation started successfully",
      status: result.status || "success",
      eval_run_ids: result.eval_run_ids,
      total_runs: result.total_runs,
    };
  } catch (error) {
    const errorMessage = `Error starting evaluation ${params.eval_id}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
