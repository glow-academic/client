/**
 * useArtifactGeneration
 * Shared hook for coarse-grained AI generation event handling.
 * Manages generatingResources Set via socket events, exposing:
 *   - isGenerating(type)
 *   - isAnyGenerating
 *   - makeOnGenerationComplete(type) — callback for children to clear their type
 *   - startGenerating(types) — explicitly mark types as generating
 *   - generationProgress — 0-100 from progress events
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useSocket } from "@/contexts/socket-context";

interface UseArtifactGenerationConfig {
  artifactType: string; // "persona", "tool", "setting", "eval", "scenario"
  groupId: string | null | undefined;
  validResourceTypes: string[]; // e.g. ["names", "descriptions", "args"]
}

interface UseArtifactGenerationReturn {
  generatingResources: Set<string>;
  isGenerating: (resourceType: string) => boolean;
  isAnyGenerating: boolean;
  makeOnGenerationComplete: (resourceType: string) => () => void;
  startGenerating: (resourceTypes: string[]) => void;
  generationProgress: number;
}

export function useArtifactGeneration({
  artifactType,
  groupId,
  validResourceTypes,
}: UseArtifactGenerationConfig): UseArtifactGenerationReturn {
  const { socket, isConnected } = useSocket();
  const [generatingResources, setGeneratingResources] = useState<Set<string>>(
    new Set(),
  );
  const [generationProgress, setGenerationProgress] = useState<number>(0);

  const isGenerating = useCallback(
    (resourceType: string) => generatingResources.has(resourceType),
    [generatingResources],
  );

  const isAnyGenerating = generatingResources.size > 0;

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

  // Socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    const matchesGroup = (data: {
      group_id?: string | null;
      artifact_type?: string | null;
    }): boolean => {
      // Filter by group_id
      if (data.group_id && data.group_id !== groupId) return false;
      // If artifact_type is present, it must match
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

      // Determine which types completed
      const completedTypes =
        data.resource_types ||
        (data.resource_type ? [data.resource_type] : []);

      if (completedTypes.length > 0) {
        // Clear specific completed types
        setGeneratingResources((prev) => {
          const next = new Set(prev);
          completedTypes.forEach((rt) => {
            if (validResourceTypes.includes(rt)) {
              next.delete(rt);
            }
          });
          return next;
        });
      } else {
        // No specific types mentioned — clear all (Persona/Scenario pattern)
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
          if (validResourceTypes.includes(rt)) {
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

    socket.on(startedEvent, handleStarted);
    socket.on(completeEvent, handleComplete);
    socket.on(errorEvent, handleError);
    socket.on(progressEvent, handleProgress);

    return () => {
      socket.off(startedEvent, handleStarted);
      socket.off(completeEvent, handleComplete);
      socket.off(errorEvent, handleError);
      socket.off(progressEvent, handleProgress);
    };
  }, [socket, isConnected, groupId, artifactType, validResourceTypes]);

  return {
    generatingResources,
    isGenerating,
    isAnyGenerating,
    makeOnGenerationComplete,
    startGenerating,
    generationProgress,
  };
}
