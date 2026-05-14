import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Transport } from "@/lib/transport/types";
import type { components } from "@/lib/api/schema";

type MessageData = components["schemas"]["MessageData"];
type PersonaEntry = components["schemas"]["PersonaEntry"];

// Server payloads are loosely typed — the transport delivers Record<string, unknown>.
type AnyEventData = Record<string, unknown>;

interface UseAttemptMessagesConfig {
  transport: Transport;
  chatIdRef: React.RefObject<string | null>;
  personas: Record<string, PersonaEntry> | undefined;
  /** The user's persona for this attempt — applied to optimistic user messages. */
  userPersonaId?: string | null;
  /** Assistant personas active in this chat. If there's exactly one, the
   *  streaming optimistic assistant message adopts it immediately; if
   *  multiple, it stays generic until args.persona_id parses in. */
  assistantPersonaIds?: string[] | null;
  /** Per-attempt hints capability. When false, `chat_hints` is not
   *  added to the reply-gen op list — the AI produces no hints at
   *  all. Undefined falls back to enabled (hints_enabled on ChatData
   *  is nullable; absent = "not configured", which we keep on). */
  hintsEnabled?: boolean | null;
  onRefresh: () => void;
  onUserComplete?: (data: AnyEventData) => void;
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
    personaId?: string,
    // Opts out of the server's auto-link-to-latest behavior when
    // parentMessageId is absent. Fork of a root message passes
    // { autoLinkParent: false } so the new message becomes an
    // explicit sibling root instead of chaining to the latest.
    opts?: { autoLinkParent?: boolean },
  ) => void;
  stopMessage: () => void;
  submitResponse: (
    chatId: string,
    questionId: string,
    optionIds: string[],
  ) => void;
}

/**
 * Attempt messages hook.
 *
 * Subscribes to the narrow set of per-operation events that describe a chat
 * message's lifecycle — the same channel works for text, audio, and realtime
 * because every flow ends in the same `Attempt_Chat_Message` tool call.
 *
 *   attempt.chat_message.progress  — AI streaming tool-call args (the text)
 *   attempt.chat_message.completed — message persisted to DB
 *   attempt.chat_message.failed    — persist failed
 *   attempt.generate.completed     — whole generation done (clear isSending)
 *   attempt.generate.failed        — generation errored
 *   attempt.stop.completed         — user stopped (clear isSending/isStopping)
 */
export function useAttemptMessages({
  transport,
  chatIdRef,
  personas,
  userPersonaId,
  assistantPersonaIds,
  hintsEnabled,
  onRefresh,
  onUserComplete,
}: UseAttemptMessagesConfig): UseAttemptMessagesResult {
  const userPersona =
    userPersonaId && personas ? personas[userPersonaId] ?? null : null;
  const defaultAssistantPersona =
    assistantPersonaIds && assistantPersonaIds.length === 1 && personas
      ? personas[assistantPersonaIds[0]] ?? null
      : null;
  const [streamingContent, setStreamingContent] = useState<Map<string, string>>(
    new Map(),
  );
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

  const scheduleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      onRefresh();
      refreshTimeoutRef.current = null;
    }, 500);
  }, [onRefresh]);

  useEffect(() => {
    // Streaming args for Attempt_Chat_Message — build up the optimistic
    // assistant message as the AI writes the `text` argument. The server
    // unpacks parsed args to top-level, so `data.text` / `data.persona_id`
    // are available directly (as well as under `data.arguments`).
    const handleChatMessageProgress = (data: AnyEventData) => {
      const chatId = data.chat_id as string | undefined;
      if (chatId && chatId !== chatIdRef.current) return;

      // ``call_id`` is the server's pre-minted DB row id — the unified
      // handle carried by streaming progress AND audit .started/.completed.
      // Keying the optimistic bubble by call_id means the bubble naturally
      // dedups: on .completed we swap the key from call_id to message_id,
      // and the refetched real message shares that same message_id.
      const callId = data.call_id as string | undefined;
      if (!callId) return;
      const args = (data.arguments as Record<string, unknown> | null) ?? {};
      const text = ((data.text ?? args.text) as string | undefined) ?? "";
      // Don't early-return on empty text — the UI shows a LoadingDots
      // placeholder bubble (with persona card) while the AI is still
      // streaming args before the `text` field appears.

      // Persona resolution order:
      //   1. Streamed args.persona_id (most specific)
      //   2. Previously-resolved persona on the existing optimistic entry
      //   3. Default assistant persona (if this chat has exactly one)
      //   4. null → generic fallback in UI
      const streamedPersonaId = (data.persona_id ?? args.persona_id) as
        | string
        | undefined;
      const streamedPersona =
        streamedPersonaId && personas ? personas[streamedPersonaId] : null;

      setIsSending(true);
      setStreamingContent((prev) => {
        const next = new Map(prev);
        next.set(callId, text);
        return next;
      });
      setOptimisticMessages((prev) => {
        const next = new Map(prev);
        const existing = next.get(callId);
        const prevContent = existing?.contents?.[0];
        const persona =
          streamedPersona ??
          (prevContent?.name
            ? { name: prevContent.name, color: prevContent.color, icon: prevContent.icon }
            : null) ??
          defaultAssistantPersona;
        next.set(callId, {
          id: callId,
          type: "response",
          created_at: existing?.created_at ?? new Date().toISOString(),
          completed: false,
          contents: [
            {
              content: text,
              name: persona?.name ?? null,
              color: persona?.color ?? null,
              icon: persona?.icon ?? null,
            },
          ],
        });
        return next;
      });
    };

    // Canonical: tool call executed → message persisted. Works for text,
    // audio, and realtime (all paths end in this tool call).
    const handleChatMessageCompleted = (data: AnyEventData) => {
      const chatId = data.chat_id as string | undefined;
      if (chatId && chatId !== chatIdRef.current) return;

      // Let the parent do voice-specific cleanup (e.g. match optimistic
      // voice messages by item_id).
      onUserComplete?.(data);

      // Dedup: the optimistic bubble is keyed by call_id (pre-minted at
      // streaming start; matches the audit payload's call_id). Swap its
      // key to the real message_id so the refetched real message — which
      // shares that same message_id — dominates the id-based merge in
      // MessagesView. No duplicate bubble.
      const callId = data.call_id as string | undefined;
      const messageId = data.message_id as string | undefined;
      if (callId && messageId && callId !== messageId) {
        setOptimisticMessages((prev) => {
          const existing = prev.get(callId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.delete(callId);
          next.set(messageId, { ...existing, id: messageId, completed: true });
          return next;
        });
        setStreamingContent((prev) => {
          const streaming = prev.get(callId);
          if (streaming === undefined) return prev;
          const next = new Map(prev);
          next.delete(callId);
          next.set(messageId, streaming);
          return next;
        });
      }

      scheduleRefresh();
    };

    const handleChatMessageFailed = (data: AnyEventData) => {
      setIsSending(false);
      const msg = (data.message as string | undefined) ?? "Failed to send message";
      toast.error(msg);
    };

    const handleChatMessageStarted = (_data: AnyEventData) => {
      setIsSending(true);
    };

    const handleGenerateCompleted = (_data: AnyEventData) => {
      setIsSending(false);
      scheduleRefresh();
    };

    const handleGenerateFailed = (data: AnyEventData) => {
      setIsSending(false);
      toast.error((data.message as string) || "AI response failed");
    };

    const handleStopCompleted = (data: AnyEventData) => {
      setIsSending(false);
      setIsStopping(false);
      if (data.success && data.message) {
        toast.success(data.message as string);
      } else if (data.success === false) {
        toast.error((data.message as string) ?? "Failed to stop");
      }
    };

    const unsubs = [
      transport.on("attempt.chat_message.started", handleChatMessageStarted),
      transport.on("attempt.chat_message.progress", handleChatMessageProgress),
      transport.on("attempt.chat_message.completed", handleChatMessageCompleted),
      transport.on("attempt.chat_message.failed", handleChatMessageFailed),
      transport.on("attempt.generate.completed", handleGenerateCompleted),
      transport.on("attempt.generate.failed", handleGenerateFailed),
      transport.on("attempt.stop.completed", handleStopCompleted),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [
    transport,
    chatIdRef,
    personas,
    defaultAssistantPersona,
    onUserComplete,
    scheduleRefresh,
  ]);

  // --- Emission methods ---

  const sendMessage = useCallback(
    async (
      chatId: string,
      attemptId: string,
      message: string,
      parentMessageId?: string,
      personaId?: string,
      opts?: { autoLinkParent?: boolean; audiosId?: string },
    ) => {
      setIsSending(true);

      // Optimistic user message — appears instantly with the user's
      // persona card (name/color/icon) if set on the attempt. MessagesView
      // deduplicates ``optimistic-user-*`` entries against the real
      // message once it lands via refetch.
      const optimisticUserId = `optimistic-user-${crypto.randomUUID()}`;
      const resolvedUserPersona =
        personaId && personas ? personas[personaId] : userPersona;
      setOptimisticMessages((prev) => {
        const next = new Map(prev);
        next.set(optimisticUserId, {
          id: optimisticUserId,
          type: "query",
          created_at: new Date().toISOString(),
          completed: true,
          contents: [
            {
              content: message,
              name: resolvedUserPersona?.name ?? null,
              color: resolvedUserPersona?.color ?? null,
              icon: resolvedUserPersona?.icon ?? null,
            },
          ],
        });
        return next;
      });

      // Part 1: Persist the user message. The response returns the
      // canonical message_id — swap the optimistic entry's key to it
      // immediately so the refetch merges cleanly (id match) without
      // relying on content-based dedup.
      const persistResult = await transport.send("/attempt/chat_message", {
        chat_id: chatId,
        text: message,
        ...(parentMessageId ? { parent_message_id: parentMessageId } : {}),
        ...(personaId ? { persona_id: personaId } : {}),
        // Only send the flag when we're explicitly opting out of the
        // default — keeps the payload minimal for normal sends.
        ...(opts?.autoLinkParent === false ? { auto_link_parent: false } : {}),
        // Ride-along audio attachment. When the user message came from
        // an unedited mic transcription, the server atomically writes
        // ``attempt_audio_entry`` linking message → audios_resource so
        // the chat MV surfaces ``audios_id`` for bubble playback.
        ...(opts?.audiosId ? { audios_id: opts.audiosId } : {}),
      });
      const realMessageId = persistResult?.["message_id"] as string | undefined;
      if (realMessageId && realMessageId !== optimisticUserId) {
        setOptimisticMessages((prev) => {
          const existing = prev.get(optimisticUserId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.delete(optimisticUserId);
          next.set(realMessageId, { ...existing, id: realMessageId });
          return next;
        });
      }

      // Part 2: Trigger AI response via canonical generate.
      // `chat_hints` is added when hints are enabled for this chat —
      // matches the scenario author's opt-in and prevents wasted
      // token spend when the feature is off.
      //
      // ``generate`` op is conditionally added when the user's message
      // rides with an ``audios_id`` (voice-input chat send): the agent's
      // least-privilege tool surface then includes
      // ``Attempt_Audio_Generate``, so the assistant can synthesize a
      // matching voice clip for its reply. Plain text sends skip this
      // to keep the surface minimal — and the STT round-trip in
      // ``use-attempt-transcribe.ts`` doesn't set ``operations`` at
      // all, so it stays on the canonical STT executor path.
      const operations = ["chat_message", "get"];
      if (hintsEnabled !== false) operations.push("chat_hints");
      if (opts?.audiosId) operations.push("generate");

      const generateResult = await transport.send("/attempt/generate", {
        instructions: ["Respond to the user's latest message in character."],
        config: {
          operations,
          params: {
            attempt_id: attemptId,
            chat_id: chatId,
          },
        },
      });
      activeGroupIdRef.current = (generateResult["group_id"] as string) ?? null;
    },
    [transport, personas, userPersona, hintsEnabled],
  );

  const stopMessage = useCallback(() => {
    if (!activeGroupIdRef.current) return;
    setIsStopping(true);
    transport.send("/attempt/stop", { group_id: activeGroupIdRef.current });
  }, [transport]);

  const submitResponse = useCallback(
    (chatId: string, questionId: string, optionIds: string[]) => {
      transport.send("/attempt/chat_response", {
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
