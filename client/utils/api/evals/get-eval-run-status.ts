/**
 * get-eval-run-status.ts
 * Used to get the status of an evaluation run.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface GetEvalRunStatusParams {
  eval_run_id: string;
}

export interface EvalRunStatusChatStatus {
  chat_id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  message_count: number;
  scenario_id: string;
}

export interface EvalRunStatusResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  eval_run_id?: string;
  total_chats?: number;
  completed_chats?: number;
  progress_percentage?: number;
  chat_statuses?: EvalRunStatusChatStatus[];
}

export async function getEvalRunStatus(
  params: GetEvalRunStatusParams
): Promise<EvalRunStatusResponse> {
  try {
    const response = await fetch(
      `${getApiUrl()}/evals/run/${params.eval_run_id}/status`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.detail ||
        errorData.message ||
        `Failed to get eval run status: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: "Eval run status retrieved successfully",
      status: "success",
      eval_run_id: result.eval_run_id,
      total_chats: result.total_chats,
      completed_chats: result.completed_chats,
      progress_percentage: result.progress_percentage,
      chat_statuses: result.chat_statuses,
    };
  } catch (error) {
    const errorMessage = `Error getting eval run status for ${params.eval_run_id}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}

// Legacy interface for backward compatibility
export interface EvalRunStatus {
  eval_run_id: string;
  total_chats: number;
  completed_chats: number;
  progress_percentage: number;
  chat_statuses: Array<{
    chat_id: string;
    title: string;
    completed: boolean;
    completed_at: string | null;
    message_count: number;
    scenario_id: string;
  }>;
}
