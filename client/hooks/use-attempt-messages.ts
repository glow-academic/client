import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AppSocket } from "@/contexts/socket-context";
import type { components } from "@/lib/api/schema";
import type { ServerToClientEvents } from "@/lib/ws/types";

type MessageData = components["schemas"]["MessageData"];
type PersonaEntry = components["schemas"]["PersonaEntry"];

type AttemptAssistantStartEvent =
  Parameters<ServerToClientEvents["attempt_assistant_start"]>[0];
type AttemptAssistantDeltaEvent =
  Parameters<ServerToClientEvents["attempt_assistant_delta"]>[0];
type AttemptAssistantCompleteEvent =
  Parameters<ServerToClientEvents["attempt_assistant_complete"]>[0];
type AttemptUserCompleteEvent =
  Parameters<ServerToClientEvents["attempt_user_complete"]>[0];
type AttemptCompleteEvent =
  Parameters<ServerToClientEvents["attempt_complete"]>[0];
type AttemptStoppedEvent =
  Parameters<ServerToClientEvents["attempt_stopped"]>[0];
type AttemptErrorEvent = Parameters<ServerToClientEvents["attempt_error"]>[0];

interface UseAttemptMessagesConfig {
  socket: AppSocket | null;
  chatIdRef: React.RefObject<string | null>;
  personas: Record<string, PersonaEntry> | undefined;
  onRefresh: () => void;
  onUserComplete?: (data: AttemptUserCompleteEvent) => void;
}

interface UseAttemptMessagesResult {
  streamingContent: Map<string, string>;
  setStreamingContent: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  optimisticMessages: Map<string, MessageData>;
  setOptimisticMessages: React.Dispatch<React.SetStateAction<Map<string, MessageData>>>;
  isSending: boolean;
  isStopping: boolean;
  setIsSending: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStopping: React.Dispatch<React.SetStateAction<boolean>>;
  clearStreamingState: () => void;
}

export function useAttemptMessages({
  socket,
  chatIdRef,
  personas,
  onRefresh,
  onUserComplete,
}: UseAttemptMessagesConfig): UseAttemptMessagesResult {
  const [streamingContent, setStreamingContent] = useState<
    Map<string, string>
  >(new Map());
  const [optimisticMessages, setOptimisticMessages] = useState<
    Map<string, MessageData>
  >(new Map());
  const [isSending, setIsSending] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearStreamingState = useCallback(() => {
    setStreamingContent(new Map());
    setOptimisticMessages(new Map());
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleAssistantStart = (data: AttemptAssistantStartEvent) => {
      if (data.chat_id !== chatIdRef.current) return;

      setIsSending(true);

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.message_id, {
          id: data.message_id,
          type: "response",
          created_at: data.created_at,
          completed: false,
          contents: [{ content: "" }],
        });
        return newMap;
      });
    };

    const handleAssistantDelta = (data: AttemptAssistantDeltaEvent) => {
      if (
        data.chat_id === chatIdRef.current &&
        data.content !== undefined
      ) {
        setStreamingContent((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.message_id, data.content);
          return newMap;
        });
      }
    };

    const handleAssistantComplete = (data: AttemptAssistantCompleteEvent) => {
      if (data.chat_id !== chatIdRef.current) return;

      const persona =
        data.persona_id && personas
          ? personas[data.persona_id]
          : null;

      if (data.content !== undefined) {
        setStreamingContent((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.message_id, data.content);
          return newMap;
        });
      }

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        const existingMessage = newMap.get(data.message_id);
        const existingContent = existingMessage?.contents?.[0];

        newMap.set(data.message_id, {
          id: data.message_id,
          type: "response",
          created_at:
            data.created_at ||
            existingMessage?.created_at ||
            new Date().toISOString(),
          completed: true,
          contents: [
            {
              content:
                data.content ?? existingContent?.content ?? "",
              name: persona?.name ?? existingContent?.name ?? null,
              color: persona?.color ?? existingContent?.color ?? null,
              icon: persona?.icon ?? existingContent?.icon ?? null,
            },
          ],
        });
        return newMap;
      });

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        onRefresh();
        refreshTimeoutRef.current = null;
      }, 500);
    };

    const handleUserComplete = (data: AttemptUserCompleteEvent) => {
      if (data.chat_id !== chatIdRef.current) return;

      // Let parent handle voice-specific cleanup
      onUserComplete?.(data);

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.message_id, {
          id: data.message_id,
          type: "query",
          created_at: data.created_at,
          completed: true,
          contents: [{ content: data.content, name: "You" }],
        });
        return newMap;
      });
    };

    const handleAttemptComplete = (data: AttemptCompleteEvent) => {
      if (data.chat_id !== chatIdRef.current) return;
      setIsSending(false);
    };

    const handleStopped = (data: AttemptStoppedEvent) => {
      if (data.chat_id === chatIdRef.current) {
        setIsSending(false);
        setIsStopping(false);
      }

      if (data.success && data.message) {
        toast.success(data.message);
      } else if (!data.success) {
        toast.error(data.message);
      }
    };

    const handleError = (data: AttemptErrorEvent) => {
      setIsSending(false);
      setIsStopping(false);
      toast.error(data.message);
    };

    socket.on("attempt_assistant_start", handleAssistantStart);
    socket.on("attempt_assistant_delta", handleAssistantDelta);
    socket.on("attempt_assistant_complete", handleAssistantComplete);
    socket.on("attempt_user_complete", handleUserComplete);
    socket.on("attempt_complete", handleAttemptComplete);
    socket.on("attempt_stopped", handleStopped);
    socket.on("attempt_error", handleError);

    return () => {
      socket.off("attempt_assistant_start", handleAssistantStart);
      socket.off("attempt_assistant_delta", handleAssistantDelta);
      socket.off("attempt_assistant_complete", handleAssistantComplete);
      socket.off("attempt_user_complete", handleUserComplete);
      socket.off("attempt_complete", handleAttemptComplete);
      socket.off("attempt_stopped", handleStopped);
      socket.off("attempt_error", handleError);

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [socket, chatIdRef, personas, onRefresh, onUserComplete]);

  return {
    streamingContent,
    setStreamingContent,
    optimisticMessages,
    setOptimisticMessages,
    isSending,
    isStopping,
    setIsSending,
    setIsStopping,
    clearStreamingState,
  };
}
