/**
 * stop-all-evals.ts
 * Used to stop all evaluations.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface StopAllEvalRunsParams {
  eval_run_id: string;
}

export interface StopAllEvalRunsResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  cancelled_count?: number;
  total_chats?: number;
}

export async function stopAllEvalRuns(
  params: StopAllEvalRunsParams
): Promise<StopAllEvalRunsResponse> {
  try {
    const formData = new FormData();
    formData.append("eval_run_id", params.eval_run_id);

    const response = await fetch(`${getApiUrl()}/evals/stop/all`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.detail ||
        errorData.message ||
        `Failed to stop all evaluations: ${response.status} ${response.statusText}`;
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
      message: result.message || "All evaluations stopped successfully",
      status: result.status || "success",
      cancelled_count: result.cancelled_count,
      total_chats: result.total_chats,
    };
  } catch (error) {
    const errorMessage = `Error stopping all evaluations for ${params.eval_run_id}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
