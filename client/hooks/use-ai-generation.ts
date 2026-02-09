import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";

/**
 * Manages WebSocket AI generation state and socket event listeners.
 *
 * Handles:
 * - generatingResources Set tracking which resources are currently being generated
 * - aiFormData state for pending AI suggestions (diff view workflow)
 * - Socket listeners for _complete, _progress, _error events
 * - clearAiResource helper to dismiss pending suggestions
 */
export function useAiGeneration<
  RT extends string,
  AiFormData extends Record<string, unknown>,
>(config: {
  socket: Socket | null;
  isConnected: boolean;
  artifactType: string;
  groupId: string | null | undefined;
  eventPrefix: string;
  validResourceTypes: RT[];
  onComplete: (data: Record<string, unknown>) => {
    aiUpdates: Partial<AiFormData>;
    formStateUpdates?: Record<string, unknown>;
    /** For complex merging that needs access to prev state (e.g. array dedup) */
    formStateUpdater?: (
      prev: Record<string, unknown>,
    ) => Record<string, unknown>;
  };
  setFormState?: Dispatch<SetStateAction<Record<string, unknown>>>;
}) {
  const {
    socket,
    isConnected,
    artifactType,
    groupId,
    eventPrefix,
    validResourceTypes,
    onComplete,
    setFormState,
  } = config;

  const [generatingResources, setGeneratingResources] = useState<Set<RT>>(
    new Set(),
  );

  const [aiFormData, setAiFormData] = useState<AiFormData>({} as AiFormData);

  const clearAiResource = useCallback((key: keyof AiFormData) => {
    setAiFormData((prev) => ({
      ...prev,
      [key]: undefined,
    }));
  }, []);

  const isGenerating = useCallback(
    (resourceType: RT) => generatingResources.has(resourceType),
    [generatingResources],
  );

  useEffect(() => {
    if (!socket || !isConnected) return;

    const currentGroupId = groupId;

    const handleGenerationComplete = (data: Record<string, unknown>) => {
      if (
        data.artifact_type !== artifactType ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as RT)
      ) {
        const { aiUpdates, formStateUpdates, formStateUpdater } =
          onComplete(data);

        setAiFormData((prev) => ({ ...prev, ...aiUpdates }));

        if (setFormState) {
          if (formStateUpdater) {
            setFormState(formStateUpdater);
          } else if (formStateUpdates) {
            setFormState((prev: Record<string, unknown>) => ({
              ...prev,
              ...formStateUpdates,
            }));
          }
        }

        setGeneratingResources((prev) => {
          const next = new Set(prev);
          next.delete(data.resource_type as RT);
          return next;
        });

        if (data.success) {
          toast.success(
            (data.message as string) ||
              `${data.resource_type as string} generated successfully`,
          );
        } else {
          toast.error(
            (data.message as string) ||
              `Failed to generate ${data.resource_type as string}`,
          );
        }
      }
    };

    const handleGenerationProgress = (data: Record<string, unknown>) => {
      if (
        data.artifact_type !== artifactType ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }
      // Progress updates handled by caller if needed
    };

    const handleGenerationError = (data: Record<string, unknown>) => {
      if (
        data.artifact_type !== artifactType ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const resourceTypes =
        (data.resource_types as string[]) ||
        (data.resource_type ? [data.resource_type as string] : []);
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt as RT)) {
            next.delete(rt as RT);
          }
        });
        return next;
      });
      toast.error((data.message as string) || "Generation failed");
    };

    socket.on(`${eventPrefix}_progress`, handleGenerationProgress);
    socket.on(`${eventPrefix}_complete`, handleGenerationComplete);
    socket.on(`${eventPrefix}_error`, handleGenerationError);

    return () => {
      socket.off(`${eventPrefix}_progress`, handleGenerationProgress);
      socket.off(`${eventPrefix}_complete`, handleGenerationComplete);
      socket.off(`${eventPrefix}_error`, handleGenerationError);
    };
    // validResourceTypes and onComplete are typically stable (memoized by caller)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    socket,
    isConnected,
    groupId,
    artifactType,
    eventPrefix,
    validResourceTypes,
    onComplete,
    setFormState,
  ]);

  return {
    generatingResources,
    setGeneratingResources,
    isGenerating,
    aiFormData,
    setAiFormData,
    clearAiResource,
  };
}
