/**
 * SimulationControls.tsx
 * Controls for ending chats and sessions during simulation attempts
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";

import type { AttemptDetailOut } from "@/app/(main)/home/[attemptId]/page";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export interface SimulationControlsProps {
  attemptId: string;
  attemptData: AttemptDetailOut;
}

export function SimulationControls({
  attemptId,
  attemptData,
}: SimulationControlsProps) {
  const { socket } = useSocket();

  // Extract data from attemptData
  const attempt = attemptData?.attempt || null;
  const currentChatIndex = attemptData?.current_chat_index ?? 0;
  const shouldShowControls = attemptData?.should_show_controls ?? true;
  const isPracticeSimulation =
    attemptData?.simulation?.practice_simulation ?? false;
  const isInfiniteMode = attemptData?.attempt?.infinite_mode ?? false;
  const showResults = attemptData?.show_results ?? false;
  const isActive = attemptData?.is_active ?? true;

  // Find current chat from server data (new flat structure)
  const currentChat = useMemo(() => {
    const chats = attemptData?.views?.simulation_chats ?? [];
    if (chats.length === 0) return null;
    return chats[currentChatIndex] || chats[0] || null;
  }, [attemptData, currentChatIndex]);

  const currentChatId = currentChat?.id || null;

  // Get current messages from server data (new flat structure)
  const currentMessages = useMemo(() => {
    const messages = attemptData?.views?.simulation_messages ?? [];
    if (!currentChat?.id) return [];
    const chatId = String(currentChat.id);
    return messages.filter(
      (message) => message.chat_id && String(message.chat_id) === chatId
    );
  }, [attemptData, currentChat]);

  // Grading state - listen to WebSocket events
  const [isGrading, setIsGrading] = useState(false);
  const [gradingProgress, setGradingProgress] = useState<{
    completed: number;
    total: number;
    displayedProgress: number;
    phase: "tools" | "summary" | null;
  } | null>(null);

  // Confirmation dialogs state
  const [confirmEndChatOpen, setConfirmEndChatOpen] = useState(false);
  const [isEndingSessionFromZeroMessages, setIsEndingSessionFromZeroMessages] =
    useState(false);
  // Use Previous state removed — now handled in AttemptLobby

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
      if (!attempt || !currentChatId || !socket) {
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
    [attempt, attemptId, socket],
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
      if (!currentChatId || data.chat_id !== currentChatId) return;
      setEndChatLoading(false);
      setEndingAction(null);
    };

    const handleAttemptEnded = (data: {
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

    const handleGraded = (data: {
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
      if (!currentChatId || data.chat_id !== currentChatId) return;

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

  // Get previous chats for current chat to show red dot indicator
  // Must be computed before early returns to maintain hook order
  // With new flat structure, currentChat IS the chatData
  const currentChatData = currentChat;

  // Check if current content is a video
  const isVideo = useMemo(() => {
    return currentChatData?.content_type === "video";
  }, [currentChatData]);

  // Continuation options (Use Previous) are now handled in AttemptLobby

  // Get previous chats for current chat (for red dot indicator)
  // For practice simulations, never show previous chats (must always go through manual grading)

  // Don't show buttons if attemptData is not available
  if (!attemptData) {
    return null;
  }

  // Don't show buttons if server says not to (unless in infinite mode)
  // In infinite mode, buttons should always be available for cycling/ending
  if (shouldShowControls === false && !isInfiniteMode) {
    return null;
  }

  // Don't show if no current chat
  if (!currentChat) {
    return null;
  }

  // Hide buttons when attempt is done (showResults is true or isActive is false)
  // This applies to both infinite mode and normal mode
  if (showResults || !isActive) {
    return null;
  }

  // Use Previous handling removed — now in AttemptLobby

  // Extract simulationId for grading
  const simulationId = attemptData?.simulation?.id;

  // Handle End Session button click (always does default end session logic)
  const handleEndSession = () => {
    const totalMessages = currentMessages.length;

    // N1: Show confirmation if current chat has 0 messages (skip grade)
    if (totalMessages === 0) {
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

  // Handle Next Video button click
  const handleNextVideo = async () => {
    if (!currentChatId || !socket) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    setEndChatLoading(true);
    setEndingAction("endChat");

    try {
      socket.emit("attempt_end", {
        chat_id: currentChatId,
      });
    } catch (error) {
      toast.error(`Failed to advance to next video: ${error}`);
      setEndChatLoading(false);
      setEndingAction(null);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {/* Video mode: Show Next Video button */}
        {isVideo ? (
          <Button
            type="button"
            variant="default"
            onClick={handleNextVideo}
            disabled={endChatLoading}
            className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
          >
            {endChatLoading && endingAction === "endChat"
              ? "Advancing..."
              : "Next Video"}
          </Button>
        ) : (
          /* End Session button */
          <Button
            type="button"
            variant={shouldShowControls ? "default" : "outline"}
            onClick={handleEndSession}
            disabled={endChatLoading}
            className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
            data-tour-end-all
          >
            {endChatLoading && endingAction === "endAll"
              ? "Ending..."
              : "End Session"}
          </Button>
        )}
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
