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
  /** True for video/quiz-style chats — grading scoped to score only (no feedback/strengths/improvements). */
  isStructuredMode?: boolean;
  /**
   * Per-attempt capability flags from ChatData. When set to false the
   * corresponding grading op is omitted from the generate call so the
   * AI never produces content that the scenario author turned off.
   * Undefined = treat as enabled (safe default — matches the flag's
   * nullable contract on ChatData).
   */
  chatFlags?: {
    strengths_enabled?: boolean | null | undefined;
    improvements_enabled?: boolean | null | undefined;
    analyses_enabled?: boolean | null | undefined;
  };
}

const BASE_GRADE_OPERATIONS = [
  "chat_grade",
  "chat_feedback",
  "chat_complete",
  "get",
];

const STRUCTURED_GRADE_OPERATIONS = [
  "chat_grade",
  "chat_complete",
  "get",
];

const STRUCTURED_GRADE_INSTRUCTIONS = [
  "Grade this attempt chat. Call attempt/get to fetch the rubric, questions with their options (including is_correct flags), and the user's picks (marked '← user picked'). Default to equal weight per question (total_points divided by question count) unless the rubric indicates otherwise. Award full credit when the user picked the correct option, partial credit for near-misses that are reasonable or directionally good, and zero for clearly wrong picks. Sum across questions and call chat_grade with the chat_id and your integer score.",
];

export function SimulationControls({
  attemptId,
  currentChatId,
  hasMessages,
  isStructuredMode = false,
  chatFlags,
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

    // Structured mode (quiz/video): fixed narrow op list, no per-flag
    // gating — grading is just a score computation against the rubric.
    if (isStructuredMode) {
      grade({
        attemptId,
        chatId: currentChatId,
        endAfter: true,
        operations: STRUCTURED_GRADE_OPERATIONS,
        instructions: STRUCTURED_GRADE_INSTRUCTIONS,
      });
      return;
    }

    // Free-form grading: always-on base ops plus per-flag additions.
    // `undefined`/`null` flags are treated as "enabled" since the flag
    // is nullable on ChatData; an absent value means "not configured",
    // which we preserve as on (matches the scenario's defaults).
    const operations = [...BASE_GRADE_OPERATIONS];
    if (chatFlags?.strengths_enabled !== false) operations.push("chat_strengths");
    if (chatFlags?.improvements_enabled !== false) operations.push("chat_improvements");
    if (chatFlags?.analyses_enabled !== false) operations.push("chat_analyses");

    grade({
      attemptId,
      chatId: currentChatId,
      endAfter: true,
      operations,
    });
  }, [hasMessages, currentChatId, attemptId, grade, isStructuredMode, chatFlags]);

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
