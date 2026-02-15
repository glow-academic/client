"use client";

import { useSocket } from "@/contexts/socket-context";
import { useCallback, useEffect, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketEventData = any;

/**
 * Shared hook for resource-level AI suggestion state management.
 * Listens to socket events for generation started/complete/error,
 * manages isGenerating + suggestion state, and provides accept/reject.
 */
export function useResourceAi<TSuggestion>(config: {
  /** Socket event prefix, e.g. "names" -> listens to "names_generation_*" */
  resourceType: string;
  /** Group ID for filtering socket events */
  groupId: string | null | undefined;
  /** Extract a typed suggestion from the generation_complete event payload */
  extractSuggestion: (data: SocketEventData) => TSuggestion | null;
  /** When true, accumulate suggestions into an array (for multi-value resources like Departments) */
  accumulate?: boolean;
}): {
  isGenerating: boolean;
  aiSuggestion: TSuggestion | null;
  aiSuggestions: TSuggestion[];
  accept: () => void;
  reject: () => void;
} {
  const { socket, isConnected } = useSocket();
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<TSuggestion | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<TSuggestion[]>([]);

  // Keep extractSuggestion stable via ref to avoid re-subscribing on every render
  const extractRef = useRef(config.extractSuggestion);
  extractRef.current = config.extractSuggestion;

  const accumulate = config.accumulate ?? false;
  const resourceType = config.resourceType;
  const groupId = config.groupId;

  useEffect(() => {
    if (!socket || !isConnected) return;

    const startedEvent = `${resourceType}_generation_started`;
    const completeEvent = `${resourceType}_generation_complete`;
    const errorEvent = `${resourceType}_generation_error`;

    const handleStarted = (data: SocketEventData) => {
      if (groupId && data.group_id !== groupId) return;
      setIsGenerating(true);
    };

    const handleComplete = (data: SocketEventData) => {
      if (groupId && data.group_id !== groupId) return;
      setIsGenerating(false);
      const suggestion = extractRef.current(data);
      if (suggestion !== null) {
        if (accumulate) {
          setAiSuggestions((prev) => [...prev, suggestion]);
        } else {
          setAiSuggestion(suggestion);
        }
      }
    };

    const handleError = (data: SocketEventData) => {
      if (groupId && data.group_id !== groupId) return;
      setIsGenerating(false);
    };

    // Type-safe socket.on requires exact event names from ServerToClientEvents.
    // Since resourceType is dynamic, we cast to use the generic listener API.
    const s = socket as unknown as {
      on: (event: string, handler: (data: SocketEventData) => void) => void;
      off: (event: string, handler: (data: SocketEventData) => void) => void;
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
