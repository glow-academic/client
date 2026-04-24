/**
 * useGenerationEmit — the emit side of the generation lifecycle.
 *
 * One of three generation primitives:
 *   - useGenerationEvents: receive events, track state
 *   - useGenerationEmit   (this file): emit, correlate run_ids
 *   - useGenerationToast: toast lifecycle bound to a runId
 *
 * Not to be confused with the existing `useGenerate` hook which is a
 * higher-level generation-panel chat controller — different concern.
 *
 * Returns an `emit(event, payload)` function and the last correlation id
 * issued. The correlation id is injected into the payload as
 * `client_run_id` so callers can pair their emits with incoming events
 * (e.g. bind a toast to a specific run, match progress to a click).
 *
 * No toasts, no connection-error messaging — just emit + correlate.
 * Uses `useTransport().send`, so it works across every transport mode.
 */
"use client";

import { useCallback, useState } from "react";

import { useTransport } from "@/lib/transport";

type EmitPayload = Record<string, unknown>;

export interface UseGenerationEmitReturn {
  /** Most recently issued client-side correlation id. Null until first emit. */
  lastRunId: string | null;
  /**
   * Emit a generation command. Returns the synchronously-known runId plus a
   * promise for the transport response (ack / .completed).
   *
   * The runId is set before this returns, so a caller can wire up a
   * correlated toast immediately without awaiting the response.
   */
  emit: (event: string, payload?: EmitPayload) => {
    runId: string;
    response: Promise<Record<string, unknown>>;
  };
}

function makeRunId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useGenerationEmit(): UseGenerationEmitReturn {
  const transport = useTransport();
  const [lastRunId, setLastRunId] = useState<string | null>(null);

  const emit = useCallback(
    (event: string, payload: EmitPayload = {}) => {
      const runId = makeRunId();
      setLastRunId(runId);
      const response = transport.send(event, {
        ...payload,
        client_run_id: runId,
      });
      return { runId, response };
    },
    [transport],
  );

  return { lastRunId, emit };
}
