import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Transport } from "@/lib/transport/types";
import type { components } from "@/lib/api/schema";

type MessageData = components["schemas"]["MessageData"];
type PersonaEntry = components["schemas"]["PersonaEntry"];

// Event payload types — loosely typed to match Transport's Record<string, unknown>
type AttemptAssistantStartEvent = Record<string, unknown>;
type AttemptAssistantDeltaEvent = Record<string, unknown>;
type AttemptAssistantCompleteEvent = Record<string, unknown>;
type AttemptUserCompleteEvent = Record<string, unknown>;
type AttemptCompleteEvent = Record<string, unknown>;
type AttemptStoppedEvent = Record<string, unknown>;
type AttemptErrorEvent = Record<string, unknown>;

interface UseAttemptMessagesConfig {
  transport: Transport;
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
  sendMessage: (
    chatId: string,
    attemptId: string,
    message: string,
    parentMessageId?: string,
  ) => void;
  stopMessage: (chatId: string) => void;
  submitResponse: (
    chatId: string,
    questionId: string,
    optionIds: string[],
  ) => void;
}

export function useAttemptMessages({
  transport,
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
    const handleAssistantStart = (data: AttemptAssistantStartEvent) => {
      if (data.chat_id !== chatIdRef.current) return;

      setIsSending(true);

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.message_id as string, {
          id: data.message_id as string,
          type: "response",
          created_at: data.created_at as string,
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
          newMap.set(data.message_id as string, data.content as string);
          return newMap;
        });
      }
    };

    const handleAssistantComplete = (data: AttemptAssistantCompleteEvent) => {
      if (data.chat_id !== chatIdRef.current) return;

      const persona =
        data.persona_id && personas
          ? personas[data.persona_id as string]
          : null;

      if (data.content !== undefined) {
        setStreamingContent((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.message_id as string, data.content as string);
          return newMap;
        });
      }

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        const existingMessage = newMap.get(data.message_id as string);
        const existingContent = existingMessage?.contents?.[0];

        newMap.set(data.message_id as string, {
          id: data.message_id as string,
          type: "response",
          created_at:
            (data.created_at as string) ||
            existingMessage?.created_at ||
            new Date().toISOString(),
          completed: true,
          contents: [
            {
              content:
                (data.content as string) ?? existingContent?.content ?? "",
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
        newMap.set(data.message_id as string, {
          id: data.message_id as string,
          type: "query",
          created_at: data.created_at as string,
          completed: true,
          contents: [{ content: data.content as string, name: "You" }],
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
        toast.success(data.message as string);
      } else if (!data.success) {
        toast.error(data.message as string);
      }
    };

    const handleError = (data: AttemptErrorEvent) => {
      setIsSending(false);
      setIsStopping(false);
      toast.error(data.message as string);
    };

    const unsubs = [
      transport.on("attempt.chat.assistant_start", handleAssistantStart),
      transport.on("attempt.chat.assistant_progress", handleAssistantDelta),
      transport.on("attempt.chat.assistant_complete", handleAssistantComplete),
      transport.on("attempt.chat.user_complete", handleUserComplete),
      transport.on("attempt.complete", handleAttemptComplete),
      transport.on("attempt.chat.stopped", handleStopped),
      transport.on("attempt.error", handleError),
    ];

    return () => {
      unsubs.forEach((fn) => fn());

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [transport, chatIdRef, personas, onRefresh, onUserComplete]);

  // --- Emission methods ---

  const sendMessage = useCallback(
    (chatId: string, attemptId: string, message: string, parentMessageId?: string) => {
      setIsSending(true);
      transport.send("/attempt/chat/send", {
        attempt_id: attemptId,
        chat_id: chatId,
        text: message,
        ...(parentMessageId ? { parent_message_id: parentMessageId } : {}),
      });
    },
    [transport],
  );

  const stopMessage = useCallback(
    (chatId: string) => {
      setIsStopping(true);
      transport.send("/attempt/chat/stop", { chat_id: chatId });
    },
    [transport],
  );

  const submitResponse = useCallback(
    (chatId: string, questionId: string, optionIds: string[]) => {
      transport.send("/attempt/chat/response", {
        chat_id: chatId,
        question_id: questionId,
        option_ids: optionIds,
      });
    },
    [transport],
  );

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
    sendMessage,
    stopMessage,
    submitResponse,
  };
}
