/**
 * useScenarioAi — Scenario-specific facade over the shared generation
 * listener.
 *
 * Was previously a 300-line bespoke composition with its own
 * ``useGenerationEvents`` subscription, per-resource state tracking,
 * and timeouts. That all moved up into ``useArtifactGeneration`` /
 * ``GenerationListenerProvider`` so every artifact gets per-resource
 * granularity from one canonical primitive. This file is now a thin
 * shim that preserves the existing call-site shape
 * (``isGenerating(rt)`` / ``makeOnGenerationComplete(rt)`` /
 * ``generate(rts, opts)``) while reading state from the shared
 * listener.
 *
 * New artifacts should consume ``useSharedGenerationListener`` directly
 * — this shim exists for backwards compatibility with the two existing
 * Scenario call sites.
 */
"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { useSharedGenerationListener } from "./use-artifact-generation-context";

export interface UseScenarioAiConfig {
  /** Called when a generation finishes (success or failure). Preserved
   *  for the Scenarios list page which uses it to fire ``router.refresh()``
   *  on completion. */
  onComplete?: (result: { success: boolean }) => void;
  /** When true, surface a toast on generate failure. (The shared
   *  listener already handles success state via the right-side panel.)
   *  Default: true for parity with the prior implementation. */
  withToast?: boolean;
}

export interface UseScenarioAiReturn {
  isAnyGenerating: boolean;
  isGenerating: (resourceType?: string) => boolean;
  generatingResources: Set<string>;
  generationProgress: number;
  generate: (
    resourceTypes: string[],
    options?: Record<string, unknown>,
  ) => boolean;
  makeOnGenerationComplete: (resourceType: string) => () => void;
}

export function useScenarioAi(
  config: UseScenarioAiConfig = {},
): UseScenarioAiReturn {
  const { onComplete, withToast = true } = config;
  const listener = useSharedGenerationListener();

  // Edge-fire onComplete + error toast when generation transitions
  // from "active" → "idle". Two distinct edges: success (stage="idle")
  // and failure (stage="error"). The shared listener owns the state
  // machine; we just observe.
  const prevStageRef = useRef(listener.stage);
  useEffect(() => {
    const prev = prevStageRef.current;
    const curr = listener.stage;
    prevStageRef.current = curr;
    if (prev === "generating" && curr === "idle") {
      onComplete?.({ success: true });
    } else if (prev === "generating" && curr === "error") {
      onComplete?.({ success: false });
      if (withToast && listener.error) {
        toast.error(listener.error);
      }
    }
  }, [listener.stage, listener.error, onComplete, withToast]);

  const isGenerating = useCallback(
    (resourceType?: string) => {
      if (resourceType === undefined) return listener.generatingResources.size > 0;
      return listener.generatingResources.has(resourceType);
    },
    [listener.generatingResources],
  );

  // Wrap ``clearGeneratingResource`` so callers can build a per-resource
  // settle callback without re-binding to ``listener`` in their deps.
  const makeOnGenerationComplete = useCallback(
    (resourceType: string) => () => {
      listener.clearGeneratingResource(resourceType);
    },
    [listener],
  );

  const generate = useCallback(
    (resourceTypes: string[], options: Record<string, unknown> = {}): boolean => {
      return listener.generateResources(resourceTypes, options);
    },
    [listener],
  );

  return {
    isAnyGenerating: listener.generatingResources.size > 0,
    isGenerating,
    generatingResources: listener.generatingResources,
    generationProgress: listener.generationProgress,
    generate,
    makeOnGenerationComplete,
  };
}
