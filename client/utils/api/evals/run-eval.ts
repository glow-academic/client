/**
 * run-eval.ts
 * Used to run an evaluation.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface RunEvalParams {
  eval_run_id: string;
}

export interface RunEvalResponse {
  success: boolean;
  message: string;
  status?: "processing" | "completed" | "error";
}

export async function runEval(params: RunEvalParams): Promise<RunEvalResponse> {
  try {
    const formData = new FormData();
    formData.append("eval_run_id", params.eval_run_id);

    const response = await fetch(`${getApiUrl()}/evals/run`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.detail ||
        errorData.message ||
        `Failed to run evaluation: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    return {
      success: result.status !== "error",
      message: result.message || "Evaluation is being processed",
      status: result.status || "processing",
    };
  } catch (error) {
    const errorMessage = `Error running evaluation ${params.eval_run_id}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
