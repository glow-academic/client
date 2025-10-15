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
import { useProfile } from "@/contexts/profile-context";
import { useSimulation } from "@/contexts/simulation-context";
import { useAttemptProfilesByAttemptId } from "@/lib/api/v1/hooks/attempt_profiles";
import { useSimulationMessagesByChatId } from "@/lib/api/v1/hooks/simulation_messages";
import { useEffect, useMemo, useState } from "react";

export function SimulationControls() {
  const simulationContext = useSimulation();
  const { effectiveProfile, activeProfile } = useProfile();

  // All hooks must be called before any early returns
  const currentChatId = simulationContext?.currentChat?.id;
  const { data: currentChatMessages = [] } = useSimulationMessagesByChatId(
    currentChatId!
  );

  // Get attempt profile from junction table
  const { data: attemptProfileLinks = [] } = useAttemptProfilesByAttemptId(
    simulationContext?.attempt?.id || ""
  );
  const attemptProfileId = attemptProfileLinks.find(
    (ap) => ap.active
  )?.profileId;

  // Check if current user is the owner of this attempt
  const isAttemptOwner = useMemo(() => {
    if (!activeProfile?.id || !effectiveProfile?.id || !attemptProfileId) {
      return false;
    }
    return (
      (activeProfile.id === effectiveProfile.id &&
        activeProfile.id === attemptProfileId) ||
      activeProfile.role === "guest"
    );
  }, [
    activeProfile?.id,
    effectiveProfile?.id,
    attemptProfileId,
    activeProfile?.role,
  ]);

  // Confirmation dialogs state
  const [confirmEndAllOpen, setConfirmEndAllOpen] = useState(false);
  const [endAllRemainingSessions, setEndAllRemainingSessions] = useState(0);
  const [confirmEndChatOpen, setConfirmEndChatOpen] = useState(false);

  // Track which action is ending, so only that button shows "Ending..."
  const [endingAction, setEndingAction] = useState<"endAll" | "endChat" | null>(
    null
  );

  useEffect(() => {
    if (!simulationContext?.endChatLoading) {
      setEndingAction(null);
    }
  }, [simulationContext?.endChatLoading]);

  // If no simulation context, don't render anything
  if (!simulationContext) {
    return null;
  }

  const {
    endChat,
    endChatLoading,
    isSingleChatAttempt,
    isLastAttempt,
    simulation,
    isActive,
    showResults,
    chats,
    expectedChatCount,
    currentChat,
    attemptId,
    endAllChats,
  } = simulationContext;

  // Don't show if results are showing or user is not the owner
  if (showResults || !isAttemptOwner) {
    return null;
  }

  let buttonLabel = "End Chat";
  if (isSingleChatAttempt) {
    buttonLabel = "End Session";
  } else if (isLastAttempt) {
    buttonLabel = "End Session";
  } else {
    buttonLabel = "End & Next Chat";
  }

  // Check if there are at least 2 remaining sessions for End All button
  const incompleteChats = chats.filter((chat) => !chat.completed).length;
  const createdChats = chats.length;
  const remainingScenarios = expectedChatCount - createdChats;
  const remainingSessions = incompleteChats + remainingScenarios;
  const showEndAllButton = remainingSessions >= 2;

  return (
    <>
      <div className="flex gap-2">
        {showEndAllButton && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setEndAllRemainingSessions(remainingSessions);
              setConfirmEndAllOpen(true);
            }}
            disabled={endChatLoading}
            className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm"
            data-tour-end-all
          >
            {endChatLoading && endingAction === "endAll"
              ? "Ending..."
              : `End All (${remainingSessions})`}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const totalMessages = currentChatMessages.length;
            if (totalMessages < 2) {
              setConfirmEndChatOpen(true);
              return;
            }
            // Dispatch endChatButtonPressed event for tour progression and navigating state management
            window.dispatchEvent(
              new CustomEvent("endChatButtonPressed", {
                detail: {
                  chatId: currentChat?.id,
                  attemptId: attemptId,
                },
              })
            );
            setEndingAction("endChat");
            endChat();
          }}
          disabled={
            endChatLoading || (simulation?.timeLimit ? !isActive : false)
          }
          className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-hidden"
          data-tour-end-chat
        >
          {/* Grading progress overlay - fills from left to right */}
          {simulationContext?.isGrading &&
            simulationContext?.gradingProgress && (
              <span
                className="absolute inset-0 bg-blue-500/20 transition-all duration-300 ease-out"
                style={{
                  width: `${
                    (simulationContext.gradingProgress.completed /
                      simulationContext.gradingProgress.total) *
                    100
                  }%`,
                }}
              />
            )}

          {/* Button text */}
          <span className="relative z-10">
            {endChatLoading && endingAction === "endChat"
              ? "Ending..."
              : buttonLabel}
          </span>
        </Button>
      </div>

      {/* Confirm End All Dialog */}
      <AlertDialog open={confirmEndAllOpen} onOpenChange={setConfirmEndAllOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>End all remaining sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {endAllRemainingSessions} remaining session
              {endAllRemainingSessions === 1 ? "" : "s"} as incomplete, and
              their scores will not count.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Dispatch endAllChatsButtonPressed event for tour progression
                window.dispatchEvent(
                  new CustomEvent("endAllChatsButtonPressed", {
                    detail: {
                      attemptId: attemptId,
                      remainingSessions: endAllRemainingSessions,
                    },
                  })
                );
                setConfirmEndAllOpen(false);
                setEndingAction("endAll");
                endAllChats();
              }}
            >
              End All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm End Chat (no messages) Dialog */}
      <AlertDialog
        open={confirmEndChatOpen}
        onOpenChange={setConfirmEndChatOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End chat now?</AlertDialogTitle>
            <AlertDialogDescription>
              You have not sent any messages in this chat. Ending now will mark
              this chat as incomplete and the score will not count.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Chat</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Dispatch endChatButtonPressed event for tour progression and navigating state management
                window.dispatchEvent(
                  new CustomEvent("endChatButtonPressed", {
                    detail: {
                      chatId: currentChat?.id,
                      attemptId: attemptId,
                    },
                  })
                );
                setConfirmEndChatOpen(false);
                setEndingAction("endChat");
                endChat();
              }}
            >
              End Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
