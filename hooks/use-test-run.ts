/**
 * useTestRun — drive one test turn end-to-end.
 *
 * Canonical client-orchestrated sequence (mirrors /attempt's chat→message→generate
 * pattern):
 *
 *   1. POST /test/trace      { test_invocation_id, run_id (historical),
 *                              panel form state (tool_ids, prompt_text,
 *                              instructions, modality_ids, voice_ids,
 *                              temperature_level_ids, reasoning_level_ids,
 *                              quality_ids) } → trace_id
 *   2. POST /test/generate   { trace_id }                                  → run_id
 *      - When the eval is_dynamic=False, server skips the LLM call and
 *        returns the historical run_id verbatim.
 *      - When is_dynamic=True, server runs the model and returns the new
 *        run_id holding the assistant output.
 *   3. POST /test/run        { test_id, test_invocation_id,
 *                              test_invocation_trace_id, run_id }          → test_invocation_run_id
 *
 * No SSE wait — every step is a synchronous request/response.
 */
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransport } from "@/lib/transport/context";

export type RunStage =
  | "idle"
  | "tracing"
  | "generating"
  | "binding"
  | "ready"
  | "error";

/**
 * Per-turn bundle the user assembles in the resource panel. All fields
 * are optional — the server stores exactly what's passed (no inheritance
 * fallback). Free-text fields are minted as resources server-side.
 */
export interface RunPanelState {
  tool_ids?: string[];
  prompt_text?: string;
  instructions?: string[];
  modality_ids?: string[];
  voice_ids?: string[];
  temperature_level_ids?: string[];
  reasoning_level_ids?: string[];
  quality_ids?: string[];
  /** Pre-minted prompt ids the caller already has (combined with prompt_text). */
  prompt_ids?: string[];
  /** Pre-minted instruction ids (combined with instructions text). */
  instruction_ids?: string[];
}

export interface UseTestRunReturn {
  run: (params: {
    testId: string;
    testInvocationId: string;
    historicalRunId?: string;
    panel?: RunPanelState;
  }) => Promise<{
    traceId: string;
    runId: string;
    testInvocationRunId: string;
  } | null>;
  stage: RunStage;
  error: string | null;
}

export function useTestRun(): UseTestRunReturn {
  const transport = useTransport();
  const router = useRouter();
  const [stage, setStage] = useState<RunStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (params: {
      testId: string;
      testInvocationId: string;
      historicalRunId?: string;
      panel?: RunPanelState;
    }) => {
      try {
        setError(null);

        // 1. Open the trace with the panel state.
        setStage("tracing");
        const tracePayload: Record<string, unknown> = {
          test_id: params.testId,
          test_invocation_id: params.testInvocationId,
          ...(params.historicalRunId && { run_id: params.historicalRunId }),
          // Bundle overrides — server stores verbatim (no inheritance).
          ...(params.panel?.tool_ids && { tool_ids: params.panel.tool_ids }),
          ...(params.panel?.modality_ids && {
            modality_ids: params.panel.modality_ids,
          }),
          ...(params.panel?.voice_ids && { voice_ids: params.panel.voice_ids }),
          ...(params.panel?.temperature_level_ids && {
            temperature_level_ids: params.panel.temperature_level_ids,
          }),
          ...(params.panel?.reasoning_level_ids && {
            reasoning_level_ids: params.panel.reasoning_level_ids,
          }),
          ...(params.panel?.quality_ids && {
            quality_ids: params.panel.quality_ids,
          }),
          // Pre-minted ids (combined with text-minted on the server).
          ...(params.panel?.prompt_ids && {
            prompt_ids: params.panel.prompt_ids,
          }),
          ...(params.panel?.instruction_ids && {
            instruction_ids: params.panel.instruction_ids,
          }),
          // Free-text — server mints resources via canonical black boxes.
          ...(params.panel?.prompt_text && {
            prompt_text: params.panel.prompt_text,
          }),
          ...(params.panel?.instructions &&
            params.panel.instructions.length > 0 && {
              instructions: params.panel.instructions.filter(
                (s) => s.trim() !== "",
              ),
            }),
        };

        const traceResp = (await transport.send(
          "/test/trace",
          tracePayload,
        )) as Record<string, unknown>;
        const traceId = traceResp["test_invocation_trace_id"] as string;
        if (!traceId) throw new Error("trace creation returned no id");

        // 2. Generate (or skip when is_dynamic=False — server decides).
        setStage("generating");
        const genResp = (await transport.send("/test/generate", {
          trace_id: traceId,
        })) as Record<string, unknown>;
        const runId = genResp["run_id"] as string | undefined;
        if (!runId) {
          throw new Error("generate returned no run_id");
        }

        // 3. Bind the run to the invocation.
        setStage("binding");
        const runResp = (await transport.send("/test/run", {
          test_id: params.testId,
          test_invocation_id: params.testInvocationId,
          test_invocation_trace_id: traceId,
          run_id: runId,
        })) as Record<string, unknown>;
        const testInvocationRunId =
          (runResp["test_invocation_run_id"] as string) ?? "";

        setStage("ready");
        router.refresh();
        return { traceId, runId, testInvocationRunId };
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [transport, router],
  );

  return { run, stage, error };
}
