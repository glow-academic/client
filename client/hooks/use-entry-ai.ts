"use client";

import { useSocket } from "@/contexts/socket-context";
import type { ServerToClientEvents } from "@/lib/ws/types";
import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Type-level helpers: derive payload from ServerToClientEvents by entry name
// ---------------------------------------------------------------------------

/** Extract payload type from a server-to-client event handler. */
type EventPayload<E extends keyof ServerToClientEvents> =
  ServerToClientEvents[E] extends (payload: infer P) => void ? P : never;

/** Resolve the `*_generation_complete` event key for an entry type. */
type CompleteEvent<E extends string> =
  `${E}_generation_complete` extends keyof ServerToClientEvents
    ? `${E}_generation_complete`
    : never;

/** The payload type for an entry's generation events. */
export type EntryEventPayload<E extends string> =
  CompleteEvent<E> extends never ? never : EventPayload<CompleteEvent<E>>;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Typed hook for entry-level AI generation state.
 *
 * Listens to `{entryType}_generation_started/complete/error` socket events,
 * tracks isGenerating state and provides the typed payload on complete.
 *
 * The event payload is automatically typed from `ServerToClientEvents` —
 * no manual type parameter needed.
 *
 * @example
 * ```ts
 * const { lastEvent } = useEntryAi({
 *   entryType: "contents",
 *   groupId: group_id,
 * });
 * // lastEvent is typed as ContentsGenerationEvent (from OpenAPI)
 * // lastEvent?.content, lastEvent?.entry_id — fully typed
 * ```
 */
export function useEntryAi<E extends string>(config: {
  /** Entry type key, e.g. "contents" → listens to "contents_generation_*" */
  entryType: E;
  /** Group ID for filtering socket events */
  groupId: string | null | undefined;
  /** Optional callback when generation completes */
  onComplete?: (entryId: string | null, data: EntryEventPayload<E>) => void;
  /** Optional callback when generation errors */
  onError?: (data: EntryEventPayload<E>) => void;
}): {
  isGenerating: boolean;
  lastEntryId: string | null;
  lastEvent: EntryEventPayload<E> | null;
  clear: () => void;
} {
  type Payload = EntryEventPayload<E>;

  const { socket, isConnected } = useSocket();
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastEntryId, setLastEntryId] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<Payload | null>(null);

  // Keep callbacks stable via refs
  const onCompleteRef = useRef(config.onComplete);
  onCompleteRef.current = config.onComplete;
  const onErrorRef = useRef(config.onError);
  onErrorRef.current = config.onError;

  const entryType = config.entryType;
  const groupId = config.groupId;

  useEffect(() => {
    if (!socket || !isConnected) return;

    const startedEvent = `${entryType}_generation_started`;
    const completeEvent = `${entryType}_generation_complete`;
    const errorEvent = `${entryType}_generation_error`;

    const handleStarted = (data: Record<string, unknown>) => {
      if (groupId && data.group_id !== groupId) return;
      setIsGenerating(true);
    };

    const handleComplete = (data: Record<string, unknown>) => {
      if (groupId && data.group_id !== groupId) return;
      setIsGenerating(false);
      const payload = data as Payload;
      const entryId = (data.entry_id as string) ?? null;
      setLastEntryId(entryId);
      setLastEvent(payload);
      onCompleteRef.current?.(entryId, payload);
    };

    const handleError = (data: Record<string, unknown>) => {
      if (groupId && data.group_id !== groupId) return;
      setIsGenerating(false);
      onErrorRef.current?.(data as Payload);
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
  }, [socket, isConnected, entryType, groupId]);

  const clear = useCallback(() => {
    setLastEntryId(null);
    setLastEvent(null);
    setIsGenerating(false);
  }, []);

  return {
    isGenerating,
    lastEntryId,
    lastEvent,
    clear,
  };
}
