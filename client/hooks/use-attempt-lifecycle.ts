import { useCallback, useEffect, useRef } from "react";
import type { AppSocket } from "@/contexts/socket-context";
import type { ServerToClientEvents } from "@/lib/ws/types";

// Re-export event types for consumer convenience
export type AttemptStartedEvent =
  Parameters<ServerToClientEvents["attempt_started"]>[0];
export type AttemptChatStartedEvent =
  Parameters<ServerToClientEvents["attempt_chat_started"]>[0];
export type AttemptChatEndedEvent =
  Parameters<ServerToClientEvents["attempt_chat_ended"]>[0];
export type AttemptEndedEvent =
  Parameters<ServerToClientEvents["attempt_ended"]>[0];
export type AttemptGradedEvent =
  Parameters<ServerToClientEvents["attempt_graded"]>[0];
export type AttemptErrorEvent =
  Parameters<ServerToClientEvents["attempt_error"]>[0];
export type AttemptResponseResultEvent =
  Parameters<ServerToClientEvents["attempt_response_result"]>[0];

interface UseAttemptLifecycleConfig {
  socket: AppSocket | null;
  attemptId?: string | null;
  chatId?: string | null;
  chatIdRef?: React.RefObject<string | null>;
  onStarted?: (data: AttemptStartedEvent) => void;
  onChatStarted?: (data: AttemptChatStartedEvent) => void;
  onChatEnded?: (data: AttemptChatEndedEvent) => void;
  onEnded?: (data: AttemptEndedEvent) => void;
  onGradeComplete?: (data: AttemptGradedEvent) => void;
  onError?: (data: AttemptErrorEvent) => void;
  onResponseResult?: (data: AttemptResponseResultEvent) => void;
}

export interface UseAttemptLifecycleReturn {
  startAttempt: (
    trainingEntryId: string,
    opts?: { infiniteMode?: boolean },
  ) => void;
  continueAttempt: (
    attemptId: string,
    opts?: { draftId?: string; userInstructions?: string[] },
  ) => void;
  endChat: (
    attemptId: string,
    chatId: string,
    opts?: { grade?: boolean },
  ) => void;
  endAll: (attemptId: string) => void;
  usePrevious: (
    attemptId: string,
    previousChatMap: Record<string, string>,
  ) => void;
  gradeChat: (
    simulationId: string,
    attemptId: string,
    chatId: string,
  ) => void;
}

export function useAttemptLifecycle({
  socket,
  attemptId,
  chatId,
  chatIdRef,
  onStarted,
  onChatStarted,
  onChatEnded,
  onEnded,
  onGradeComplete,
  onError,
  onResponseResult,
}: UseAttemptLifecycleConfig): UseAttemptLifecycleReturn {
  // Store callbacks in refs to avoid re-registering socket listeners on every render
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
    if (!socket) return;

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

    socket.on("attempt_started", handleStarted);
    socket.on("attempt_chat_started", handleChatStarted);
    socket.on("attempt_chat_ended", handleChatEnded);
    socket.on("attempt_ended", handleEnded);
    socket.on("attempt_graded", handleGradeComplete);
    socket.on("attempt_error", handleError);
    socket.on("attempt_response_result", handleResponseResult);

    return () => {
      socket.off("attempt_started", handleStarted);
      socket.off("attempt_chat_started", handleChatStarted);
      socket.off("attempt_chat_ended", handleChatEnded);
      socket.off("attempt_ended", handleEnded);
      socket.off("attempt_graded", handleGradeComplete);
      socket.off("attempt_error", handleError);
      socket.off("attempt_response_result", handleResponseResult);
    };
  }, [socket, attemptId, chatId, chatIdRef]);

  // --- Emission methods ---

  const startAttempt = useCallback(
    (
      trainingEntryId: string,
      opts?: { infiniteMode?: boolean },
    ) => {
      if (!socket) return;
      socket.emit("attempt_start", {
        training_entry_id: trainingEntryId,
        infinite_mode: opts?.infiniteMode ?? false,
      });
    },
    [socket],
  );

  const continueAttempt = useCallback(
    (
      attemptIdArg: string,
      opts?: { draftId?: string; userInstructions?: string[] },
    ) => {
      if (!socket) return;
      socket.emit("attempt_continue", {
        attempt_id: attemptIdArg,
        ...(opts?.draftId && { draft_id: opts.draftId }),
        ...(opts?.userInstructions && {
          user_instructions: opts.userInstructions,
        }),
      });
    },
    [socket],
  );

  const endChat = useCallback(
    (
      attemptIdArg: string,
      chatIdArg: string,
      opts?: { grade?: boolean },
    ) => {
      if (!socket) return;
      socket.emit("attempt_end", {
        attempt_id: attemptIdArg,
        chat_id: chatIdArg,
        grade: opts?.grade ?? true,
      });
    },
    [socket],
  );

  const endAll = useCallback(
    (attemptIdArg: string) => {
      if (!socket) return;
      socket.emit("attempt_end_all", {
        attempt_id: attemptIdArg,
      });
    },
    [socket],
  );

  const usePrevious = useCallback(
    (attemptIdArg: string, previousChatMap: Record<string, string>) => {
      if (!socket) return;
      socket.emit("attempt_use_previous", {
        attempt_id: attemptIdArg,
        previous_chat_map: previousChatMap,
      });
    },
    [socket],
  );

  const gradeChat = useCallback(
    (simulationId: string, attemptIdArg: string, chatIdArg: string) => {
      if (!socket) return;
      socket.emit("attempt_grade", {
        simulation_id: simulationId,
        attempt_id: attemptIdArg,
        chat_id: chatIdArg,
      });
    },
    [socket],
  );

  return {
    startAttempt,
    continueAttempt,
    endChat,
    endAll,
    usePrevious,
    gradeChat,
  };
}
