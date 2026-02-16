"use client";

import { useSocket } from "@/contexts/socket-context";
import type { ServerToClientEvents } from "@/lib/ws/types";
import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Type-level helpers: derive payload from ServerToClientEvents by resource name
// ---------------------------------------------------------------------------

/** Extract payload type from a server-to-client event handler. */
type EventPayload<E extends keyof ServerToClientEvents> =
  ServerToClientEvents[E] extends (payload: infer P) => void ? P : never;

/** Resolve the `*_generation_complete` event key for a resource type. */
type CompleteEvent<R extends string> =
  `${R}_generation_complete` extends keyof ServerToClientEvents
    ? `${R}_generation_complete`
    : never;

/** The payload type for a resource's generation events. */
export type ResourceEventPayload<R extends string> =
  CompleteEvent<R> extends never ? never : EventPayload<CompleteEvent<R>>;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Typed hook for resource-level AI suggestion state management.
 *
 * Listens to `{resourceType}_generation_started/complete/error` socket events,
 * manages isGenerating + suggestion state, and provides accept/reject.
 *
 * The suggestion payload is automatically typed from `ServerToClientEvents` —
 * no manual `extractSuggestion` callback or generic type parameter needed.
 *
 * @example
 * ```ts
 * const { aiSuggestion } = useResourceAi({
 *   resourceType: "names",
 *   groupId: group_id,
 * });
 * // aiSuggestion is typed as NamesGenerationEvent (from OpenAPI)
 * // aiSuggestion?.id, aiSuggestion?.name — fully typed
 * ```
 */
export function useResourceAi<R extends string>(config: {
  /** Resource type key, e.g. "names" → listens to "names_generation_*" */
  resourceType: R;
  /** Group ID for filtering socket events */
  groupId: string | null | undefined;
  /** When true, accumulate suggestions into an array (for multi-value resources) */
  accumulate?: boolean;
}): {
  isGenerating: boolean;
  aiSuggestion: ResourceEventPayload<R> | null;
  aiSuggestions: ResourceEventPayload<R>[];
  accept: () => void;
  reject: () => void;
} {
  type Payload = ResourceEventPayload<R>;

  const { socket, isConnected } = useSocket();
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<Payload | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Payload[]>([]);

  const accumulate = config.accumulate ?? false;
  const resourceType = config.resourceType;
  const groupId = config.groupId;

  useEffect(() => {
    if (!socket || !isConnected) return;

    const startedEvent = `${resourceType}_generation_started`;
    const completeEvent = `${resourceType}_generation_complete`;
    const errorEvent = `${resourceType}_generation_error`;

    const handleStarted = (data: Record<string, unknown>) => {
      if (groupId && data.group_id !== groupId) return;
      setIsGenerating(true);
    };

    const handleComplete = (data: Record<string, unknown>) => {
      if (groupId && data.group_id !== groupId) return;
      setIsGenerating(false);
      // Auto-filter failed events
      if (data.success === false) return;
      const payload = data as Payload;
      if (accumulate) {
        setAiSuggestions((prev) => [...prev, payload]);
      } else {
        setAiSuggestion(payload);
      }
    };

    const handleError = (data: Record<string, unknown>) => {
      if (groupId && data.group_id !== groupId) return;
      setIsGenerating(false);
    };

    // Event names are constructed at runtime so we cast to the generic listener API.
    const s = socket as unknown as {
      on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
      off: (event: string, handler: (data: Record<string, unknown>) => void) => void;
    };

    s.on(startedEvent, handleStarted);
    s.on(completeEvent, handleComplete);
    s.on(errorEvent, handleError);

    return () => {
      s.off(startedEvent, handleStarted);
      s.off(completeEvent, handleComplete);
      s.off(errorEvent, handleError);
    };
  }, [socket, isConnected, resourceType, groupId, accumulate]);

  const accept = useCallback(() => {
    setAiSuggestion(null);
    setAiSuggestions([]);
  }, []);

  const reject = useCallback(() => {
    setAiSuggestion(null);
    setAiSuggestions([]);
  }, []);

  return {
    isGenerating,
    aiSuggestion,
    aiSuggestions,
    accept,
    reject,
  };
}
