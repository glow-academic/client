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
import { useAttemptLifecycle } from "@/hooks/use-attempt-lifecycle";
import type { AttemptErrorEvent } from "@/hooks/use-attempt-lifecycle";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export interface SimulationControlsProps {
  attemptId: string;
  currentChatId: string;
  hasMessages: boolean;
}

export function SimulationControls({
  attemptId,
  currentChatId,
  hasMessages,
}: SimulationControlsProps) {
  const { socket } = useSocket();

  // Confirmation dialog state
  const [confirmEndChatOpen, setConfirmEndChatOpen] = useState(false);

  // Loading state for End Session button
  const [endingLoading, setEndingLoading] = useState(false);

  // Listen for WebSocket lifecycle events to reset loading state
  const { endChat } = useAttemptLifecycle({
    socket,
    onError: useCallback((data: AttemptErrorEvent) => {
      if (data.type === "end" || data.type === "grade") {
        setEndingLoading(false);
      }
    }, []),
    onGradeComplete: useCallback(() => {
      setEndingLoading(false);
    }, []),
    onChatEnded: useCallback(() => {
      setEndingLoading(false);
    }, []),
  });

  // Handle End Session button click
  const handleEndSession = useCallback(() => {
    // No messages: show confirmation → emit attempt_end without grading
    if (!hasMessages) {
      setConfirmEndChatOpen(true);
      return;
    }

    // Has messages: emit attempt_end with grade=true
    if (!currentChatId) return;
    setEndingLoading(true);
    endChat(attemptId, currentChatId, { grade: true });
  }, [hasMessages, currentChatId, attemptId, endChat]);

  // Confirm end session with 0 messages
  const handleConfirmEnd = useCallback(() => {
    if (!currentChatId || !socket) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    setConfirmEndChatOpen(false);
    setEndingLoading(true);
    endChat(attemptId, currentChatId, { grade: false });
  }, [attemptId, currentChatId, socket, endChat]);

  return (
    <>
      <div className="flex gap-2">
        {/* End Session button */}
        <Button
          type="button"
          variant="default"
          onClick={handleEndSession}
          disabled={endingLoading}
          className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
          data-tour-end-all
        >
          {endingLoading ? "Ending..." : "End Session"}
        </Button>
      </div>

      {/* Confirm End Chat (no messages) Dialog */}
      <AlertDialog
        open={confirmEndChatOpen}
        onOpenChange={setConfirmEndChatOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End session now?</AlertDialogTitle>
            <AlertDialogDescription>
              You have not sent any messages in this chat. Ending the session now
              will mark this chat as incomplete and the score will not count.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEnd}>
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
