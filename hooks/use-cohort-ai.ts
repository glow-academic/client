/**
 * useCohortAi — Cohort-specific facade over the shared generation
 * listener.
 *
 * Was previously a bespoke composition. That all moved up into
 * ``useArtifactGeneration`` / ``GenerationListenerProvider`` so every
 * artifact gets per-resource granularity from one canonical primitive.
 * This file is now a thin shim that preserves the existing call-site
 * shape while reading state from the shared listener. Mirror of
 * ``use-scenario-ai.ts`` / ``use-simulation-ai.ts``.
 */
"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { useSharedGenerationListener } from "./use-artifact-generation-context";

export interface UseCohortAiConfig {
  /** Called when a generation finishes (success or failure). */
  onComplete?: (result: { success: boolean }) => void;
  /** When true, surface a toast on generate failure. Default: true. */
  withToast?: boolean;
}

export interface UseCohortAiReturn {
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

export function useCohortAi(
  config: UseCohortAiConfig = {},
): UseCohortAiReturn {
  const { onComplete, withToast = true } = config;
  const listener = useSharedGenerationListener();

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
