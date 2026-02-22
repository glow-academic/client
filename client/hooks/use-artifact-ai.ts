/**
 * useArtifactAi
 * Canonical hook for artifact-level AI generation — handles both receive and emit.
 *
 * Receive: Listens to `{artifactType}_generation_*` socket events,
 *   tracks which resource types are currently generating (Set-based).
 *
 * Emit: Provides a typed `generate()` method that emits the unified
 *   `generate` event to the server with connection guards and
 *   automatic `startGenerating` bookkeeping.
 *
 * Follows the useAttemptLifecycle pattern: one hook owns both directions.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useSocket } from "@/contexts/socket-context";
import type { ClientToServerEvents } from "@/lib/ws/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The payload for the unified `generate` client-to-server event. */
type GeneratePayload = Parameters<ClientToServerEvents["generate"]>[0];

/**
 * Fields the caller passes to `generate()`.
 * `artifact_type` and `resource_types` are injected by the hook.
 */
type GenerateOptions = Omit<GeneratePayload, "artifact_type" | "resource_types">;

interface UseArtifactAiConfig {
  /** Registry key, e.g. "cohort", "persona", "tool" */
  artifactType: string;
  /** Group ID for filtering incoming socket events */
  groupId: string | null | undefined;
  /** Allowed resource types for this artifact */
  validResourceTypes: string[];
}

interface UseArtifactAiReturn {
  /** Set of resource types currently generating */
  generatingResources: Set<string>;
  /** Check if a specific resource type is generating */
  isGenerating: (resourceType: string) => boolean;
  /** True when any resource is generating */
  isAnyGenerating: boolean;
  /** Create a callback that clears a resource type from the generating set */
  makeOnGenerationComplete: (resourceType: string) => () => void;
  /** Manually mark resource types as generating (for external use) */
  startGenerating: (resourceTypes: string[]) => void;
  /** 0-100 progress from server progress events */
  generationProgress: number;
  /**
   * Emit the unified `generate` event to the server.
   * Handles connection guard + marks resources as generating.
   * Returns false if socket is not connected.
   */
  generate: (
    resourceTypes: string[],
    options?: GenerateOptions,
  ) => boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useArtifactAi({
  artifactType,
  groupId,
  validResourceTypes,
}: UseArtifactAiConfig): UseArtifactAiReturn {
  const { socket, isConnected } = useSocket();
  const [generatingResources, setGeneratingResources] = useState<Set<string>>(
    new Set(),
  );
  const [generationProgress, setGenerationProgress] = useState<number>(0);

  // Keep validResourceTypes in a ref so the effect doesn't re-register
  // listeners when the array reference changes but contents are the same.
  const validResourceTypesRef = useRef(validResourceTypes);
  validResourceTypesRef.current = validResourceTypes;

  // --- Derived state ---

  const isGenerating = useCallback(
    (resourceType: string) => generatingResources.has(resourceType),
    [generatingResources],
  );

  const isAnyGenerating = generatingResources.size > 0;

  // --- Manual state helpers ---

  const startGenerating = useCallback((resourceTypes: string[]) => {
    setGeneratingResources((prev) => {
      const next = new Set(prev);
      resourceTypes.forEach((rt) => next.add(rt));
      return next;
    });
  }, []);

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

  // --- Emit: unified generate event ---

  const generate = useCallback(
    (resourceTypes: string[], options?: GenerateOptions): boolean => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return false;
      }
      if (resourceTypes.length === 0) {
        toast.error("No resource types specified for generation");
        return false;
      }

      // Mark as generating in the UI immediately
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      // Emit the unified `generate` event
      socket.emit("generate", {
        artifact_type: artifactType,
        resource_types: resourceTypes,
        ...options,
      });

      return true;
    },
    [socket, isConnected, artifactType],
  );

  // --- Receive: socket event listeners ---

  useEffect(() => {
    if (!socket || !isConnected) return;

    const matchesGroup = (data: {
      group_id?: string | null;
      artifact_type?: string | null;
    }): boolean => {
      if (data.group_id && data.group_id !== groupId) return false;
      if (data.artifact_type && data.artifact_type !== artifactType)
        return false;
      return true;
    };

    const handleStarted = (data: {
      group_id?: string;
      artifact_type?: string;
      resource_types?: string[];
    }) => {
      if (!matchesGroup(data)) return;
      if (data.resource_types) {
        setGeneratingResources((prev) => {
          const next = new Set(prev);
          data.resource_types!.forEach((rt) => next.add(rt));
          return next;
        });
      }
      setGenerationProgress(0);
    };

    const handleComplete = (data: {
      group_id?: string;
      artifact_type?: string;
      resource_type?: string;
      resource_types?: string[];
      success?: boolean;
      message?: string;
    }) => {
      if (!matchesGroup(data)) return;

      const completedTypes =
        data.resource_types ||
        (data.resource_type ? [data.resource_type] : []);

      if (completedTypes.length > 0) {
        setGeneratingResources((prev) => {
          const next = new Set(prev);
          completedTypes.forEach((rt) => {
            if (validResourceTypesRef.current.includes(rt)) {
              next.delete(rt);
            }
          });
          return next;
        });
      } else {
        // No specific types mentioned — clear all
        setGeneratingResources(new Set());
        setGenerationProgress(0);
      }
    };

    const handleError = (data: {
      group_id?: string | null;
      artifact_type?: string;
      resource_type?: string | null;
      resource_types?: string[] | null;
      message?: string;
      success?: boolean;
    }) => {
      if (!matchesGroup(data)) return;

      const resourceTypes =
        data.resource_types ||
        (data.resource_type ? [data.resource_type] : []);
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypesRef.current.includes(rt)) {
            next.delete(rt);
          }
        });
        return next;
      });
      toast.error(data.message || "Generation failed");
    };

    const handleProgress = (data: {
      group_id?: string;
      artifact_type?: string;
      percentage?: number;
    }) => {
      if (!matchesGroup(data)) return;
      setGenerationProgress(data.percentage ?? 0);
    };

    const startedEvent = `${artifactType}_generation_started`;
    const completeEvent = `${artifactType}_generation_complete`;
    const errorEvent = `${artifactType}_generation_error`;
    const progressEvent = `${artifactType}_generation_progress`;

    // Cast to generic listener API since event names are constructed at runtime.
    const s = socket as unknown as {
      on: (
        event: string,
        handler: (data: Record<string, unknown>) => void,
      ) => void;
      off: (
        event: string,
        handler: (data: Record<string, unknown>) => void,
      ) => void;
    };

    s.on(startedEvent, handleStarted);
    s.on(completeEvent, handleComplete);
    s.on(errorEvent, handleError);
    s.on(progressEvent, handleProgress);

    return () => {
      s.off(startedEvent, handleStarted);
      s.off(completeEvent, handleComplete);
      s.off(errorEvent, handleError);
      s.off(progressEvent, handleProgress);
    };
  }, [socket, isConnected, groupId, artifactType]);

  return {
    generatingResources,
    isGenerating,
    isAnyGenerating,
    makeOnGenerationComplete,
    startGenerating,
    generationProgress,
    generate,
  };
}
