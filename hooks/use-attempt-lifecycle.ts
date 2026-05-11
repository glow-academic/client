import { useCallback, useEffect, useRef } from "react";
import type { Transport } from "@/lib/transport/types";
import { useGroupIdOptional } from "@/contexts/group-context";

// Event payload types — loosely typed to match Transport's Record<string, unknown>
export type AttemptStartedEvent = Record<string, unknown>;
export type AttemptChatStartedEvent = Record<string, unknown>;
export type AttemptChatEndedEvent = Record<string, unknown>;
export type AttemptEndedEvent = Record<string, unknown>;
export type AttemptGradedEvent = Record<string, unknown>;
export type AttemptErrorEvent = Record<string, unknown>;
export type AttemptResponseResultEvent = Record<string, unknown>;

interface UseAttemptLifecycleConfig {
  transport: Transport;
  attemptId?: string | null;
  chatId?: string | null;
  chatIdRef?: React.RefObject<string | null>;
  /**
   * Group id this attempt is scoped to. Used for SSE subscription routing —
   * the per-(artifact, group_id) stream model needs this to know which
   * `/attempt/stream?group_id=…` to open. WS mode ignores it.
   * Falls back to the surrounding GroupProviderClient context if omitted.
   */
  groupId?: string | null;
  onStarted?: (data: AttemptStartedEvent) => void;
  onChatStarted?: (data: AttemptChatStartedEvent) => void;
  onChatEnded?: (data: AttemptChatEndedEvent) => void;
  onEnded?: (data: AttemptEndedEvent) => void;
  onGradeComplete?: (data: AttemptGradedEvent) => void;
  onError?: (data: AttemptErrorEvent) => void;
  onResponseResult?: (data: AttemptResponseResultEvent) => void;
}

export interface UseAttemptLifecycleReturn {
  startAttempt: (opts: {
    homeId?: string;
    practiceId?: string;
    infiniteMode?: boolean;
  }) => void;
  completeChat: (chatId: string) => void;
  completeAttempt: (attemptId: string) => void;
}

export function useAttemptLifecycle({
  transport,
  attemptId,
  chatId,
  chatIdRef,
  groupId: groupIdProp,
  onStarted,
  onChatStarted,
  onChatEnded,
  onEnded,
  onGradeComplete,
  onError,
  onResponseResult,
}: UseAttemptLifecycleConfig): UseAttemptLifecycleReturn {
  const groupCtx = useGroupIdOptional();
  const groupId = groupIdProp ?? groupCtx?.groupId ?? null;

  // Store callbacks in refs to avoid re-registering listeners on every render
  const callbacksRef = useRef({
    onStarted,
    onChatStarted,
    onChatEnded,
    onEnded,
    onGradeComplete,
    onError,
    onResponseResult,
  });

  // Update refs on every render
  callbacksRef.current = {
    onStarted,
    onChatStarted,
    onChatEnded,
    onEnded,
    onGradeComplete,
    onError,
    onResponseResult,
  };

  useEffect(() => {
    const handleStarted = (data: AttemptStartedEvent) => {
      callbacksRef.current.onStarted?.(data);
    };

    const handleChatStarted = (data: AttemptChatStartedEvent) => {
      if (attemptId && data.attempt_id !== attemptId) return;
      callbacksRef.current.onChatStarted?.(data);
    };

    const handleChatEnded = (data: AttemptChatEndedEvent) => {
      const filterChatId = chatIdRef?.current ?? chatId;
      if (filterChatId && data.chat_id !== filterChatId) return;
      callbacksRef.current.onChatEnded?.(data);
    };

    const handleEnded = (data: AttemptEndedEvent) => {
      if (attemptId && data.attempt_id !== attemptId) return;
      callbacksRef.current.onEnded?.(data);
    };

    const handleGradeComplete = (data: AttemptGradedEvent) => {
      callbacksRef.current.onGradeComplete?.(data);
    };

    const handleError = (data: AttemptErrorEvent) => {
      callbacksRef.current.onError?.(data);
    };

    const handleResponseResult = (data: AttemptResponseResultEvent) => {
      callbacksRef.current.onResponseResult?.(data);
    };

    const scope = groupId ? { groupId } : undefined;
    const unsubs = [
      transport.on("attempt.start.completed", handleStarted, scope),
      transport.on("attempt.chat.started", handleChatStarted, scope),
      transport.on("attempt.chat.ended", handleChatEnded, scope),
      transport.on("attempt.complete.completed", handleEnded, scope),
      transport.on("attempt.chat_grade.completed", handleGradeComplete, scope),
      transport.on("attempt.error", handleError, scope),
      transport.on("attempt.chat.response_result", handleResponseResult, scope),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [transport, attemptId, chatId, chatIdRef, groupId]);

  // --- Emission methods ---

  const startAttempt = useCallback(
    (opts: {
      homeId?: string;
      practiceId?: string;
      infiniteMode?: boolean;
    }) => {
      transport.send("/attempt/start", {
        ...(opts.homeId && { home_id: opts.homeId }),
        ...(opts.practiceId && { practice_id: opts.practiceId }),
        infinite_mode: opts.infiniteMode ?? false,
      });
    },
    [transport],
  );

  const completeChat = useCallback(
    (chatIdArg: string) => {
      transport.send("/attempt/chat_complete", {
        chat_id: chatIdArg,
      });
    },
    [transport],
  );

  const completeAttempt = useCallback(
    (attemptIdArg: string) => {
      transport.send("/attempt/complete", {
        attempt_id: attemptIdArg,
      });
    },
    [transport],
  );

  return {
    startAttempt,
    completeChat,
    completeAttempt,
  };
}
