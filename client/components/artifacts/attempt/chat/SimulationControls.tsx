/**
 * SimulationControls.tsx
 * Controls for ending chats and sessions during simulation attempts
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/contexts/socket-context";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface SimulationControlsProps {
  attemptId: string;
  currentChatId: string;
  simulationId: string;
  hasMessages: boolean;
}

export function SimulationControls({
  attemptId,
  currentChatId,
  simulationId,
  hasMessages,
}: SimulationControlsProps) {
  const { socket } = useSocket();

  // Grading state - listen to WebSocket events (values tracked for timeout flow)
  const [, setIsGrading] = useState(false);
  const [, setGradingProgress] = useState<{
    completed: number;
    total: number;
    displayedProgress: number;
    phase: "tools" | "summary" | null;
  } | null>(null);

  // Confirmation dialogs state
  const [confirmEndChatOpen, setConfirmEndChatOpen] = useState(false);
  const [isEndingSessionFromZeroMessages, setIsEndingSessionFromZeroMessages] =
    useState(false);

  // Track which action is ending, so only that button shows "Ending..."
  const [endingAction, setEndingAction] = useState<"endAll" | "endChat" | null>(
    null,
  );
  const [endChatLoading, setEndChatLoading] = useState(false);

  // Refs for grade-then-end chain
  const pendingEndAfterGradeRef = useRef(false);
  const gradingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // End chat function
  const endChat = useCallback(
    async (chatId?: string, previousChatId?: string) => {
      const targetChatId = chatId || currentChatId;
      if (!targetChatId || !socket) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setEndChatLoading(true);
      setEndingAction("endChat");

      try {
        socket.emit("attempt_end", {
          chat_id: targetChatId,
          ...(previousChatId ? { previous_chat_id: previousChatId } : {}),
        });
      } catch (error) {
        toast.error(`Failed to end chat: ${error}`);
        setEndChatLoading(false);
        setEndingAction(null);
      }
    },
    [currentChatId, socket],
  );

  // End all chats function
  const endAllChats = useCallback(
    async (previousChatMap?: Record<string, string | null>) => {
      if (!currentChatId || !socket) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      try {
        socket.emit("attempt_end_all", {
          attempt_id: attemptId,
          ...(previousChatMap ? { previous_chat_map: previousChatMap } : {}),
        });
      } catch (error) {
        toast.error(`Failed to end all chats: ${error}`);
        setEndChatLoading(false);
        setEndingAction(null);
      }
    },
    [attemptId, currentChatId, socket],
  );

  // Listen for WebSocket events to reset loading state and handle grading
  useEffect(() => {
    if (!socket) return;

    const handleChatEnded = (data: {
      chat_id: string;
      next_chat_id: string | null;
      is_attempt_finished: boolean;
      grade_id: string | null;
    }) => {
      if (data.chat_id !== currentChatId) return;
      setEndChatLoading(false);
      setEndingAction(null);
    };

    const handleAttemptEnded = (_data: {
      attempt_id: string;
      success: boolean;
      message: string;
    }) => {
      setEndChatLoading(false);
      setEndingAction(null);
    };

    const handleAttemptError = (data: {
      chat_id: string | null;
      type: string;
      message: string;
    }) => {
      if (data.type === "end") {
        setEndChatLoading(false);
        setEndingAction(null);
      }
      if (data.type === "grade") {
        setIsGrading(false);
        setGradingProgress(null);
        setEndChatLoading(false);
        setEndingAction(null);
        if (gradingTimeoutRef.current) {
          clearTimeout(gradingTimeoutRef.current);
          gradingTimeoutRef.current = null;
        }
        pendingEndAfterGradeRef.current = false;
      }
    };

    const handleGraded = (_data: {
      attempt_id: string;
      chat_id: string | null;
      simulation_id: string;
    }) => {
      setIsGrading(false);
      setGradingProgress(null);
      if (gradingTimeoutRef.current) {
        clearTimeout(gradingTimeoutRef.current);
        gradingTimeoutRef.current = null;
      }
      if (pendingEndAfterGradeRef.current) {
        pendingEndAfterGradeRef.current = false;
        endAllChats();
      }
    };

    const handleGradingProgress = (data: {
      type: string;
      chat_id: string;
      completed_count?: number;
      total_count?: number;
    }) => {
      if (data.chat_id !== currentChatId) return;

      if (data.type === "complete") {
        setIsGrading(false);
        setGradingProgress(null);
        return;
      }

      if (
        data.completed_count !== undefined &&
        data.total_count !== undefined
      ) {
        const progress = Math.round(
          (data.completed_count / data.total_count) * 100,
        );
        setGradingProgress({
          completed: data.completed_count,
          total: data.total_count,
          displayedProgress: progress,
          phase:
            data.type === "tools"
              ? "tools"
              : data.type === "summary"
                ? "summary"
                : null,
        });
        setIsGrading(true);
      }
    };

    socket.on("attempt_chat_ended", handleChatEnded);
    socket.on("attempt_ended", handleAttemptEnded);
    socket.on("attempt_error", handleAttemptError);
    socket.on("attempt_graded", handleGraded);
    socket.on(
      "attempt_grading_progress",
      handleGradingProgress,
    );

    return () => {
      socket.off("attempt_chat_ended", handleChatEnded);
      socket.off("attempt_ended", handleAttemptEnded);
      socket.off("attempt_error", handleAttemptError);
      socket.off("attempt_graded", handleGraded);
      socket.off(
        "attempt_grading_progress",
        handleGradingProgress,
      );
    };
  }, [socket, currentChatId, endAllChats]);

  // Handle End Session button click
  const handleEndSession = () => {
    // N1: Show confirmation if current chat has 0 messages (skip grade)
    if (!hasMessages) {
      setIsEndingSessionFromZeroMessages(true);
      setConfirmEndChatOpen(true);
      return;
    }

    // N2: Has messages - grade first, then end all after grading completes
    if (!simulationId || !currentChatId || !socket) return;
    setEndChatLoading(true);
    setEndingAction("endAll");
    setIsGrading(true);
    pendingEndAfterGradeRef.current = true;
    gradingTimeoutRef.current = setTimeout(() => {
      pendingEndAfterGradeRef.current = false;
      setEndChatLoading(false);
      setEndingAction(null);
      setIsGrading(false);
      setGradingProgress(null);
      toast.error("Grading timed out. Please try again.");
    }, 60000);
    socket.emit("attempt_grade", {
      simulation_id: simulationId,
      attempt_id: attemptId,
      chat_id: currentChatId,
    });
  };

  return (
    <>
      <div className="flex gap-2">
        {/* End Session button */}
        <Button
          type="button"
          variant="default"
          onClick={handleEndSession}
          disabled={endChatLoading}
          className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
          data-tour-end-all
        >
          {endChatLoading && endingAction === "endAll"
            ? "Ending..."
            : "End Session"}
        </Button>
      </div>

      {/* Confirm End Chat (no messages) Dialog */}
      <AlertDialog
        open={confirmEndChatOpen}
        onOpenChange={(open) => {
          setConfirmEndChatOpen(open);
          if (!open) {
            setIsEndingSessionFromZeroMessages(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isEndingSessionFromZeroMessages
                ? "End session now?"
                : "End chat now?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isEndingSessionFromZeroMessages ? (
                <>
                  You have not sent any messages in this chat. Ending the
                  session now will mark this chat as incomplete and the score
                  will not count.
                </>
              ) : (
                <>
                  You have not sent any messages in this chat. Ending now will
                  mark this chat as incomplete and the score will not count.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (isEndingSessionFromZeroMessages) {
                  // End the entire session
                  setIsEndingSessionFromZeroMessages(false);
                  setConfirmEndChatOpen(false);
                  endAllChats();
                } else {
                  setConfirmEndChatOpen(false);
                  endChat();
                }
              }}
            >
              {isEndingSessionFromZeroMessages ? "End Session" : "End Chat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
