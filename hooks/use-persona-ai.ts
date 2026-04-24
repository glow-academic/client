/**
 * usePersonaAi — per-artifact composition of the three generation primitives.
 *
 * Reference shape for per-artifact wrappers. Each artifact gets its own
 * ~30-line file that:
 *   1. Encodes the artifact's event names (no caller magic)
 *   2. Composes useGenerationEvents + useGenerationEmit + useGenerationToast
 *   3. Surfaces the small handful of fields callers actually use
 *
 * Replaces the persona-level call into the deprecated `useArtifactAi`.
 *
 * Today the server emits legacy event names like `persona_generation_*`.
 * When server-side event names canonicalize to `artifacts.persona.generate.*`,
 * change the EVENTS constant below — no caller change required.
 */
"use client";

import { useEffect, useRef } from "react";

import { useGenerationEmit } from "./use-generation-emit";
import { useGenerationEvents } from "./use-generation-events";
import { useGenerationToast } from "./use-generation-toast";

const ARTIFACT = "persona";

const EVENTS = {
  started: `${ARTIFACT}_generation_started`,
  progress: `${ARTIFACT}_generation_progress`,
  complete: `${ARTIFACT}_generation_complete`,
  error: `${ARTIFACT}_generation_error`,
} as const;

export interface UsePersonaAiConfig {
  /** Filter incoming events by group_id. */
  groupId?: string | null;
  /** Filter by entity_id. */
  entityId?: string | null;
  /** Called when a generation finishes (success or failure). */
  onComplete?: (result: { success: boolean }) => void;
  /** When true, surface a loading→success/error toast for each generation. */
  withToast?: boolean;
}

export interface UsePersonaAiReturn {
  isGenerating: boolean;
  /** Latest progress payload streamed during generation. */
  partial: Record<string, unknown> | null;
  /** Latest complete payload. */
  complete: Record<string, unknown> | null;
  /** Latest error payload. */
  error: Record<string, unknown> | null;
  /**
   * Emit a persona generation. Returns the runId for caller correlation.
   * The transport response promise can be awaited or ignored.
   */
  generate: (
    payload?: Record<string, unknown>,
  ) => { runId: string; response: Promise<Record<string, unknown>> };
}

export function usePersonaAi(
  config: UsePersonaAiConfig = {},
): UsePersonaAiReturn {
  const { groupId = null, entityId = null, onComplete, withToast } = config;

  const events = useGenerationEvents({
    events: EVENTS,
    scope: { groupId, entityId },
  });

  const { emit } = useGenerationEmit();
  const toaster = useGenerationToast();

  // Notify caller exactly once per finishing event.
  const completeSeenRef = useRef(events.complete);
  const errorSeenRef = useRef(events.error);

  useEffect(() => {
    if (events.complete && events.complete !== completeSeenRef.current) {
      completeSeenRef.current = events.complete;
      onComplete?.({ success: true });
    }
  }, [events.complete, onComplete]);

  useEffect(() => {
    if (events.error && events.error !== errorSeenRef.current) {
      errorSeenRef.current = events.error;
      onComplete?.({ success: false });
    }
  }, [events.error, onComplete]);

  // Bind toast lifecycle to whichever runId the latest emit issued.
  // Toast logic stays opt-in and isolated from event/state semantics.
  const generate: UsePersonaAiReturn["generate"] = (payload = {}) => {
    const result = emit(`${ARTIFACT}.generate`, payload);
    if (withToast) {
      toaster.showLoading(result.runId, { label: `Generating persona…` });
      result.response
        .then(() => toaster.markComplete(result.runId))
        .catch((err: unknown) =>
          toaster.markError(
            result.runId,
            err instanceof Error ? err.message : "Generation failed",
          ),
        );
    }
    return result;
  };

  return {
    isGenerating: events.isGenerating,
    partial: events.partial as Record<string, unknown> | null,
    complete: events.complete as Record<string, unknown> | null,
    error: events.error as Record<string, unknown> | null,
    generate,
  };
}
