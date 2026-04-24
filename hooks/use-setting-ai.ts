/**
 * useSettingAi — per-artifact composition of the three generation primitives.
 *
 * Canonical template for per-artifact wrappers. Each artifact gets its own
 * ~80-line file that:
 *   1. Encodes the artifact name and event names (no caller magic strings)
 *   2. Composes useGenerationEvents + useGenerationEmit + useGenerationToast
 *   3. Tracks the handful of artifact-specific state pieces callers need —
 *      here: the Set of resource_types currently generating, so callers can
 *      ask `isGenerating(rt)` per resource.
 *
 * Replaces the setting-level call into the deprecated `useArtifactAi`. When
 * server event names canonicalize to `artifacts.setting.generate.*`, update
 * the EVENTS map below — no caller change required.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useGenerationEmit } from "./use-generation-emit";
import { useGenerationEvents } from "./use-generation-events";
import { useGenerationToast } from "./use-generation-toast";

const ARTIFACT = "setting";

const EVENTS = {
  started: `${ARTIFACT}_generation_started`,
  progress: `${ARTIFACT}_generation_progress`,
  complete: `${ARTIFACT}_generation_complete`,
  error: `${ARTIFACT}_generation_error`,
} as const;

const GENERATE_EVENT = "generate";

export interface UseSettingAiConfig {
  /** Filter incoming events by group_id. */
  groupId?: string | null;
  /** Filter by entity_id. */
  entityId?: string | null;
  /** Called when a generation finishes (success or failure). */
  onComplete?: (result: { success: boolean }) => void;
  /** When true, surface a loading→success/error toast for each generation. Default: true for parity with old useArtifactAi. */
  withToast?: boolean;
}

export interface UseSettingAiReturn {
  /** Any resource type currently generating. */
  isAnyGenerating: boolean;
  /** True if the given resource_type is currently generating. Called with no arg: any. */
  isGenerating: (resourceType?: string) => boolean;
  /** The full set of resource_types currently generating. */
  generatingResources: Set<string>;
  /** 0–100 progress from the latest progress event. */
  generationProgress: number;
  /** Latest progress payload. */
  partial: Record<string, unknown> | null;
  /** Emit a setting generation. `resourceTypes` is the list of resources to generate. */
  generate: (
    resourceTypes: string[],
    options?: Record<string, unknown>,
  ) => boolean;
  /** Build a callback that clears a single resource_type from the generating set. */
  makeOnGenerationComplete: (resourceType: string) => () => void;
}

function pickResourceTypes(raw: Record<string, unknown> | null): string[] {
  if (!raw) return [];
  const list = raw["resource_types"];
  if (Array.isArray(list)) return list.filter((v): v is string => typeof v === "string");
  const single = raw["resource_type"];
  return typeof single === "string" ? [single] : [];
}

export function useSettingAi(
  config: UseSettingAiConfig = {},
): UseSettingAiReturn {
  const { groupId = null, entityId = null, onComplete, withToast = true } = config;

  const events = useGenerationEvents({
    events: EVENTS,
    scope: { groupId, entityId },
  });

  const { emit } = useGenerationEmit();
  const toaster = useGenerationToast();

  // Per-artifact state: which resource_types are currently generating.
  // Seeded optimistically by generate(), reconciled by started/progress,
  // cleared by complete/error.
  const [generatingResources, setGeneratingResources] = useState<Set<string>>(
    () => new Set(),
  );
  const [generationProgress, setGenerationProgress] = useState(0);

  // React to started: add any resource_types the server reports.
  const startedRef = useRef(events.started);
  useEffect(() => {
    if (events.started && events.started !== startedRef.current) {
      startedRef.current = events.started;
      const rts = pickResourceTypes(events.started as Record<string, unknown>);
      if (rts.length > 0) {
        setGeneratingResources((prev) => {
          const next = new Set(prev);
          for (const rt of rts) next.add(rt);
          return next;
        });
      }
    }
  }, [events.started]);

  // React to progress: track percentage.
  const progressRef = useRef(events.progress);
  useEffect(() => {
    if (events.progress && events.progress !== progressRef.current) {
      progressRef.current = events.progress;
      const pct = (events.progress as Record<string, unknown>)["percentage"];
      if (typeof pct === "number") setGenerationProgress(pct);
    }
  }, [events.progress]);

  // React to complete: clear resource_types, reset progress, notify.
  const completeRef = useRef(events.complete);
  useEffect(() => {
    if (events.complete && events.complete !== completeRef.current) {
      completeRef.current = events.complete;
      const rts = pickResourceTypes(events.complete as Record<string, unknown>);
      setGeneratingResources((prev) => {
        if (rts.length === 0) return new Set();
        const next = new Set(prev);
        for (const rt of rts) next.delete(rt);
        return next;
      });
      setGenerationProgress(0);
      onComplete?.({ success: true });
    }
  }, [events.complete, onComplete]);

  // React to error: clear the same resource_types, notify failure.
  const errorRef = useRef(events.error);
  useEffect(() => {
    if (events.error && events.error !== errorRef.current) {
      errorRef.current = events.error;
      const rts = pickResourceTypes(events.error as Record<string, unknown>);
      setGeneratingResources((prev) => {
        if (rts.length === 0) return new Set();
        const next = new Set(prev);
        for (const rt of rts) next.delete(rt);
        return next;
      });
      setGenerationProgress(0);
      onComplete?.({ success: false });
    }
  }, [events.error, onComplete]);

  const isGenerating = useCallback(
    (resourceType?: string) => {
      if (resourceType === undefined) return generatingResources.size > 0;
      return generatingResources.has(resourceType);
    },
    [generatingResources],
  );

  const makeOnGenerationComplete = useCallback(
    (resourceType: string) => () => {
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        next.delete(resourceType);
        return next;
      });
    },
    [],
  );

  const generate = useCallback(
    (resourceTypes: string[], options: Record<string, unknown> = {}): boolean => {
      if (resourceTypes.length === 0) return false;

      // Seed the Set immediately so UI reflects the action before the
      // server's started event arrives.
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        for (const rt of resourceTypes) next.add(rt);
        return next;
      });

      const { runId, response } = emit(GENERATE_EVENT, {
        artifact_type: ARTIFACT,
        operations: ["get"],
        resource_types: resourceTypes,
        ...options,
      });

      if (withToast) {
        const label = `Generating ${resourceTypes.map((r) => r.replaceAll("_", " ")).join(", ")}…`;
        toaster.showLoading(runId, { label });
        response
          .then(() => toaster.markComplete(runId))
          .catch((err: unknown) => {
            toaster.markError(
              runId,
              err instanceof Error ? err.message : "Generation failed",
            );
            // Clear optimistic state on emit failure.
            setGeneratingResources((prev) => {
              const next = new Set(prev);
              for (const rt of resourceTypes) next.delete(rt);
              return next;
            });
          });
      }

      return true;
    },
    [emit, toaster, withToast],
  );

  return {
    isAnyGenerating: generatingResources.size > 0,
    isGenerating,
    generatingResources,
    generationProgress,
    partial: events.partial as Record<string, unknown> | null,
    generate,
    makeOnGenerationComplete,
  };
}
