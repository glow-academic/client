/**
 * useToolAi — per-artifact composition of the three generation primitives.
 *
 * Canonical template for per-artifact wrappers. Each artifact gets its own
 * ~80-line file that:
 *   1. Encodes the artifact name and event names (no caller magic strings)
 *   2. Composes useGenerationEvents + useGenerationEmit + useGenerationToast
 *   3. Tracks the handful of artifact-specific state pieces callers need —
 *      here: the Set of resource_types currently generating, so callers can
 *      ask `isGenerating(rt)` per resource.
 *
 * Replaces the tool-level call into the deprecated `useArtifactAi`. When
 * server event names canonicalize to `artifacts.tool.generate.*`, update
 * the EVENTS map below — no caller change required.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useTransport } from "@/lib/transport";
import { useGenerationEvents } from "./use-generation-events";
import { useGenerationToast } from "./use-generation-toast";

const ARTIFACT = "tool";

// Canonical event names — match what the server's audit pipeline emits via
// `{artifact}.generate.{phase}`. Prior values (`progress` / `error`) didn't
// match server emits and silently never fired. Using `text.progress` for the
// progress slot since that's the streaming event with payload data; `failed`
// for error since that's the canonical failure event name.
const EVENTS = {
  started: `${ARTIFACT}.generate.started`,
  progress: `${ARTIFACT}.generate.text.progress`,
  complete: `${ARTIFACT}.generate.completed`,
  error: `${ARTIFACT}.generate.failed`,
} as const;

// 120s safety net — if neither completed nor failed fires for a resource
// within this window, clear it so the spinner doesn't hang forever.
const GENERATION_TIMEOUT_MS = 120_000;

export interface UseToolAiConfig {
  /** Filter incoming events by group_id. */
  groupId?: string | null;
  /** Filter by entity_id. */
  entityId?: string | null;
  /** Called when a generation finishes (success or failure). */
  onComplete?: (result: { success: boolean }) => void;
  /** When true, surface a loading→success/error toast for each generation. Default: true for parity with old useArtifactAi. */
  withToast?: boolean;
}

export interface UseToolAiReturn {
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
  /** Emit a tool generation. `resourceTypes` is the list of resources to generate. */
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

export function useToolAi(
  config: UseToolAiConfig = {},
): UseToolAiReturn {
  const { groupId = null, entityId = null, onComplete, withToast = true } = config;

  const events = useGenerationEvents({
    events: EVENTS,
    scope: { groupId, entityId },
  });

  const transport = useTransport();
  const toaster = useGenerationToast();
  // Per-resource_type timeout timers — cleared on completed/failed for that rt.
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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

  // React to complete: clear resource_types, reset progress, notify, and
  // cancel any pending safety timeouts for those resources.
  const completeRef = useRef(events.complete);
  useEffect(() => {
    if (events.complete && events.complete !== completeRef.current) {
      completeRef.current = events.complete;
      const rts = pickResourceTypes(events.complete as Record<string, unknown>);
      // Cancel safety timeouts for any resource that completed.
      const rtsToCancel = rts.length > 0 ? rts : Array.from(timeoutsRef.current.keys());
      for (const rt of rtsToCancel) {
        const t = timeoutsRef.current.get(rt);
        if (t) {
          clearTimeout(t);
          timeoutsRef.current.delete(rt);
        }
      }
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

  // React to error: clear the same resource_types, notify failure, cancel timers.
  const errorRef = useRef(events.error);
  useEffect(() => {
    if (events.error && events.error !== errorRef.current) {
      errorRef.current = events.error;
      const rts = pickResourceTypes(events.error as Record<string, unknown>);
      const rtsToCancel = rts.length > 0 ? rts : Array.from(timeoutsRef.current.keys());
      for (const rt of rtsToCancel) {
        const t = timeoutsRef.current.get(rt);
        if (t) {
          clearTimeout(t);
          timeoutsRef.current.delete(rt);
        }
      }
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

  // Cleanup any pending timers on unmount.
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      for (const t of timeouts.values()) clearTimeout(t);
      timeouts.clear();
    };
  }, []);

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

      // Schedule a 120s safety timeout per resource_type. If neither
      // `tool.generate.completed` nor `tool.generate.failed` fires for a
      // resource within the window, clear it here so the spinner doesn't
      // hang forever (matches useArtifactGeneration's safety net).
      for (const rt of resourceTypes) {
        const existing = timeoutsRef.current.get(rt);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          setGeneratingResources((prev) => {
            const next = new Set(prev);
            next.delete(rt);
            return next;
          });
          timeoutsRef.current.delete(rt);
          if (withToast) {
            const label = rt.replaceAll("_", " ");
            toaster.markError(`timeout-${rt}-${Date.now()}`, `Generation of ${label} timed out`);
          }
          onComplete?.({ success: false });
        }, GENERATION_TIMEOUT_MS);
        timeoutsRef.current.set(rt, t);
      }

      const runId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

      // Canonical wire shape — matches persona/scenario/attempt: HTTP-route
      // path + nested `config:` envelope. Server reads `config.params` for
      // artifact_id resolution and `config.operations` for the resource types.
      const response = transport.send("/tool/generate", {
        instructions: [],
        config: {
          operations: resourceTypes,
          dangerous: true,
          group_id: groupId,
          params: { ...options },
        },
        client_run_id: runId,
      });

      if (withToast) {
        const label = `Generating ${resourceTypes.map((r) => r.replaceAll("_", " ")).join(", ")}…`;
        toaster.showLoading(runId, { label });
        response
          .then(() => toaster.markComplete(runId))
          .catch((err: unknown) => {
            // Send-side rejection: clear optimistic state + cancel timeouts.
            for (const rt of resourceTypes) {
              const t = timeoutsRef.current.get(rt);
              if (t) {
                clearTimeout(t);
                timeoutsRef.current.delete(rt);
              }
            }
            toaster.markError(
              runId,
              err instanceof Error ? err.message : "Generation failed",
            );
            setGeneratingResources((prev) => {
              const next = new Set(prev);
              for (const rt of resourceTypes) next.delete(rt);
              return next;
            });
          });
      }

      return true;
    },
    [transport, toaster, withToast, groupId, onComplete],
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
