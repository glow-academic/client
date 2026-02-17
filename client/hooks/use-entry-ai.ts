"use client";

import { useSocket } from "@/contexts/socket-context";
import type { ServerToClientEvents } from "@/lib/ws/types";
import { useCallback, useEffect, useState } from "react";

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
 * tracks isGenerating state and accumulates typed payloads until clear().
 *
 * The event payload is automatically typed from `ServerToClientEvents` —
 * no manual type parameter needed.
 *
 * @example
 * ```ts
 * const { events } = useEntryAi({
 *   entryType: "contents",
 *   groupId: group_id,
 * });
 * // events is typed as ContentsGenerationEvent[]
 * // events[0]?.content, events[0]?.entry_id — fully typed
 * ```
 */
export function useEntryAi<E extends string>(config: {
  /** Entry type key, e.g. "contents" → listens to "contents_generation_*" */
  entryType: E;
  /** Group ID for filtering socket events */
  groupId: string | null | undefined;
}): {
  isGenerating: boolean;
  events: EntryEventPayload<E>[];
  clear: () => void;
} {
  type Payload = EntryEventPayload<E>;

  const { socket, isConnected } = useSocket();
  const [isGenerating, setIsGenerating] = useState(false);
  const [events, setEvents] = useState<Payload[]>([]);

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
      if (data.success === false) return;
      setEvents((prev) => [...prev, data as Payload]);
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
  }, [socket, isConnected, entryType, groupId]);

  const clear = useCallback(() => {
    setEvents([]);
    setIsGenerating(false);
  }, []);

  return {
    isGenerating,
    events,
    clear,
  };
}
