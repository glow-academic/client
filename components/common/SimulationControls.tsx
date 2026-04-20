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
import { useAttemptEnd } from "@/hooks/use-attempt-end";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export interface SimulationControlsProps {
  attemptId: string;
  currentChatId: string;
  hasMessages: boolean;
  isQuizMode?: boolean;
}

const QUIZ_GRADE_OPERATIONS = [
  "chat_grade",
  "chat_complete",
  "get",
  "chat_get",
];

const QUIZ_GRADE_INSTRUCTIONS = [
  "Grade this attempt chat. Call attempt/get to fetch the user's quiz responses and attempt/chat_get to fetch the rubric, questions, and options (including is_correct flags). Use the rubric standards to determine a score between 0 and the rubric's total_points, weighing how the user's chosen options align with the correct answers. Then call chat_grade with the chat_id and your score.",
];

export function SimulationControls({
  attemptId,
  currentChatId,
  hasMessages,
  isQuizMode = false,
}: SimulationControlsProps) {
  const { grade, endChat, stage } = useAttemptEnd();

  // Confirmation dialog state
  const [confirmEndChatOpen, setConfirmEndChatOpen] = useState(false);

  const endingLoading = stage !== "idle" && stage !== "error" && stage !== "done";

  // Handle End Session button click
  const handleEndSession = useCallback(() => {
    // No gradeable content: show confirmation → end without grading
    if (!hasMessages) {
      setConfirmEndChatOpen(true);
      return;
    }

    if (!currentChatId) return;
    grade({
      attemptId,
      chatId: currentChatId,
      endAfter: true,
      ...(isQuizMode
        ? {
            operations: QUIZ_GRADE_OPERATIONS,
            instructions: QUIZ_GRADE_INSTRUCTIONS,
          }
        : {}),
    });
  }, [hasMessages, currentChatId, attemptId, grade, isQuizMode]);

  // Confirm end session with 0 messages
  const handleConfirmEnd = useCallback(() => {
    if (!currentChatId) {
      toast.error("Unable to end session. Please refresh the page.");
      return;
    }

    setConfirmEndChatOpen(false);
    endChat({ attemptId, chatId: currentChatId });
  }, [attemptId, currentChatId, endChat]);

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
