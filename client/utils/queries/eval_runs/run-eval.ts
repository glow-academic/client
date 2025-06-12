/**
 * utils/queries/eval_runs/run-eval.ts
 * Utility function for running evaluations
 */

export interface EvalRunResponse {
  success: boolean;
  message: string;
  eval_run_id?: string;
}

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

export async function runEval(evalRunId: string): Promise<Response> {
  const formData = new FormData();
  formData.append('eval_run_id', evalRunId);

  const response = await fetch('/api/evals/run', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
}

export async function getEvalRunStatus(evalRunId: string): Promise<EvalRunStatus> {
  const response = await fetch(`/api/evals/run/${evalRunId}/status`);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function startEval(evalId: string): Promise<EvalRunResponse> {
  const formData = new FormData();
  formData.append('eval_id', evalId);

  const response = await fetch('/api/evals/start', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
} 