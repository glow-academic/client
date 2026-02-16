"use client";

import { useSocket } from "@/contexts/socket-context";
import { useCallback, useEffect, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketEventData = any;

/**
 * Thin hook for entry-level AI generation state.
 * Listens to `{entryType}_generation_complete` and `{entryType}_generation_error`
 * socket events, tracks isGenerating state and provides the entry_id on complete.
 *
 * Option A: No hydration — just entry_id. Designed for easy upgrade to
 * strongly-typed hydration later.
 */
export function useEntryAi(config: {
  /** Entry type, e.g. "contents" -> listens to "contents_generation_*" */
  entryType: string;
  /** Group ID for filtering socket events */
  groupId: string | null | undefined;
  /** Optional callback when generation completes */
  onComplete?: (entryId: string | null, data: SocketEventData) => void;
  /** Optional callback when generation errors */
  onError?: (data: SocketEventData) => void;
}): {
  isGenerating: boolean;
  lastEntryId: string | null;
  lastEvent: SocketEventData | null;
  clear: () => void;
} {
  const { socket, isConnected } = useSocket();
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastEntryId, setLastEntryId] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<SocketEventData | null>(null);

  // Keep callbacks stable via refs
  const onCompleteRef = useRef(config.onComplete);
  onCompleteRef.current = config.onComplete;
  const onErrorRef = useRef(config.onError);
  onErrorRef.current = config.onError;

  const entryType = config.entryType;
  const groupId = config.groupId;

  useEffect(() => {
    if (!socket || !isConnected) return;

    const completeEvent = `${entryType}_generation_complete`;
    const errorEvent = `${entryType}_generation_error`;

    const handleComplete = (data: SocketEventData) => {
      if (groupId && data.group_id !== groupId) return;
      setIsGenerating(false);
      const entryId = data.entry_id ?? null;
      setLastEntryId(entryId);
      setLastEvent(data);
      onCompleteRef.current?.(entryId, data);
    };

    const handleError = (data: SocketEventData) => {
      if (groupId && data.group_id !== groupId) return;
      setIsGenerating(false);
      onErrorRef.current?.(data);
    };

    // Dynamic event names require generic socket API
    const s = socket as unknown as {
      on: (event: string, handler: (data: SocketEventData) => void) => void;
      off: (event: string, handler: (data: SocketEventData) => void) => void;
    };

    s.on(completeEvent, handleComplete);
    s.on(errorEvent, handleError);

    return () => {
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
