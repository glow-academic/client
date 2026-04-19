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
  stopMessage: () => void;
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
  const activeGroupIdRef = useRef<string | null>(null);

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

    // Listen for canonical generate events (AI response) + legacy attempt events
    const handleGenerateTextProgress = (data: Record<string, unknown>) => {
      const delta = data.delta as string;
      if (!delta) return;
      // Use a stable message ID for the streaming response
      const msgId = (data.run_id as string) || "streaming";
      setStreamingContent((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(msgId) || "";
        newMap.set(msgId, existing + delta);
        return newMap;
      });
      // Ensure we have an optimistic message for the AI response
      setOptimisticMessages((prev) => {
        if (prev.has(msgId)) return prev;
        const newMap = new Map(prev);
        newMap.set(msgId, {
          id: msgId,
          type: "response",
          created_at: new Date().toISOString(),
          completed: false,
          contents: [{ content: "" }],
        });
        return newMap;
      });
    };

    const handleGenerateTextComplete = (data: Record<string, unknown>) => {
      const text = data.text as string;
      const role = data.role as string;
      if (!text || role === "system" || role === "developer") return;
      if (role === "user") return; // user messages handled by user_complete
      const msgId = (data.run_id as string) || "streaming";
      setStreamingContent((prev) => {
        const newMap = new Map(prev);
        newMap.set(msgId, text);
        return newMap;
      });
      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        newMap.set(msgId, {
          id: msgId,
          type: "response",
          created_at: new Date().toISOString(),
          completed: true,
          contents: [{ content: text }],
        });
        return newMap;
      });
    };

    const handleGenerateCompleted = (_data: Record<string, unknown>) => {
      setIsSending(false);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => {
        onRefresh();
        refreshTimeoutRef.current = null;
      }, 500);
    };

    const handleGenerateFailed = (data: Record<string, unknown>) => {
      setIsSending(false);
      toast.error((data.message as string) || "AI response failed");
    };

    // Canonical: message persisted via tool call
    const handleChatSendCompleted = (data: Record<string, unknown>) => {
      const result = (data.result ?? data) as Record<string, unknown>;
      const msgId = (result.message_id as string) || crypto.randomUUID();
      const contentIds = (result.content_ids as string[]) || [];

      // Mark the message as complete with the persisted content
      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        // Find the streaming message and finalize it, or create new
        const streamingId = Array.from(prev.keys()).find(
          (k) => !prev.get(k)?.completed && prev.get(k)?.type === "response"
        );
        const key = streamingId || msgId;
        const existing = newMap.get(key);
        newMap.set(key, {
          id: msgId,
          type: "response",
          created_at: existing?.created_at || new Date().toISOString(),
          completed: true,
          contents: existing?.contents || [{ content: "" }],
        });
        return newMap;
      });
    };

    const unsubs = [
      // Canonical generate events (AI response streaming)
      transport.on("attempt.generate.text.progress", handleGenerateTextProgress),
      transport.on("attempt.generate.text.complete", handleGenerateTextComplete),
      transport.on("attempt.generate.completed", handleGenerateCompleted),
      transport.on("attempt.generate.failed", handleGenerateFailed),
      // Canonical: message persisted
      transport.on("attempt.chat_send.completed", handleChatSendCompleted),
      // Legacy attempt events (user message, stop, error)
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
    async (chatId: string, attemptId: string, message: string, parentMessageId?: string, personaId?: string) => {
      setIsSending(true);

      // Part 1: Persist the user message
      await transport.send("/attempt/chat/send", {
        attempt_id: attemptId,
        chat_id: chatId,
        text: message,
        ...(parentMessageId ? { parent_message_id: parentMessageId } : {}),
        ...(personaId ? { persona_id: personaId } : {}),
      });

      // Part 2: Trigger AI response via canonical generate
      // Model calls Attempt_Chat_Send tool to persist its response as an attempt message
      const generateResult = await transport.send("/attempt/generate", {
        instructions: ["Respond to the user's latest message in character."],
        config: {
          operations: ["chat_send", "get"],
          params: {
            attempt_id: attemptId,
            chat_id: chatId,
          },
        },
      });
      activeGroupIdRef.current = (generateResult["group_id"] as string) ?? null;
    },
    [transport],
  );

  const stopMessage = useCallback(
    () => {
      if (!activeGroupIdRef.current) return;
      setIsStopping(true);
      transport.send("/stop", { group_id: activeGroupIdRef.current });
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
