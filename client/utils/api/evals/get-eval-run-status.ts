/**
 * get-eval-run-status.ts
 * Used to get the status of an evaluation run.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

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

export async function getEvalRunStatus(
  evalRunId: string
): Promise<EvalRunStatus> {
  const response = await fetch(`${getApiUrl()}/evals/run/${evalRunId}/status`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
