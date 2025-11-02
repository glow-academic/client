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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useProfile } from "@/contexts/profile-context";
import { useSimulation } from "@/contexts/simulation-context";
import { useEffect, useMemo, useState } from "react";

export function SimulationControls() {
  const simulationContext = useSimulation();
  const { effectiveProfile, activeProfile } = useProfile();

  // Get data from context (v2 single source of truth)
  const currentChatMessages = simulationContext?.currentMessages || [];
  const attemptProfileId = simulationContext?.attemptProfileId;

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
  const [showPreviousChatsDialog, setShowPreviousChatsDialog] = useState(false);
  const [selectedPreviousChatId, setSelectedPreviousChatId] = useState<
    string | null
  >(null);

  // Track which action is ending, so only that button shows "Ending..."
  const [endingAction, setEndingAction] = useState<"endAll" | "endChat" | null>(
    null
  );

  useEffect(() => {
    if (!simulationContext?.endChatLoading) {
      setEndingAction(null);
    }
  }, [simulationContext?.endChatLoading]);

  // Extract data from context (must be before early returns to maintain hook order)
  const {
    endChat,
    endChatLoading,
    isLastAttempt,
    simulation,
    isActive,
    showResults,
    chats,
    expectedChatCount,
    currentChat,
    attemptId,
    endAllChats,
    attemptData,
  } = simulationContext || {};

  // Get previous chats for current chat to show red dot indicator
  // Must be computed before early returns to maintain hook order
  const currentChatData = useMemo(() => {
    return attemptData?.chats.find((c) => c.chat.id === currentChat?.id);
  }, [attemptData?.chats, currentChat?.id]);

  const previousChats = useMemo(() => {
    return currentChatData?.previousChats || [];
  }, [currentChatData?.previousChats]);

  const hasPreviousChats = previousChats.length > 0;

  // Check if there's a better previous attempt (higher score or passed when current failed)
  // Must be before early returns to maintain hook order
  const currentGrade = currentChatData?.grade;
  const hasBetterPreviousAttempt = useMemo(() => {
    if (!hasPreviousChats || !currentGrade) return false;

    const currentScore = currentGrade.score || 0;
    const currentPassed = currentGrade.passed || false;

    // Check if any previous chat has better score or passed when current failed
    return previousChats.some((prevChat) => {
      const prevScore = prevChat.score || 0;
      const prevPassed = prevChat.passed || false;

      // Better if: previous passed and current didn't, OR previous has higher score
      return (prevPassed && !currentPassed) || prevScore > currentScore;
    });
  }, [hasPreviousChats, currentGrade, previousChats]);

  // If no simulation context, don't render anything
  if (!simulationContext) {
    return null;
  }

  // After this point, simulationContext is guaranteed to exist
  // TypeScript doesn't know this, so we need to assert or use the values directly
  const safeEndChat = endChat!;
  const safeEndAllChats = endAllChats!;
  const safeChats = chats!;
  const safeExpectedChatCount = expectedChatCount!;
  const safeAttemptId = attemptId!;
  const safeCurrentChat = currentChat!;

  // Don't show if results are showing or user is not the owner
  if (showResults || !isAttemptOwner) {
    return null;
  }

  // Handle Next Chat button click (moves to next chat)
  const handleNextChat = () => {
    const totalMessages = currentChatMessages.length;

    // If there are previous chats available, bypass the "no messages" warning
    // and go directly to the previous chats selection dialog
    if (hasPreviousChats) {
      setShowPreviousChatsDialog(true);
      setSelectedPreviousChatId(""); // Default to "continue normally"
      return;
    }

    // Only show "no messages" warning if no previous chats exist
    if (totalMessages < 2) {
      setConfirmEndChatOpen(true);
      return;
    }

    // No previous chats and has messages, proceed normally
    // Dispatch endChatButtonPressed event for tour progression and navigating state management
    window.dispatchEvent(
      new CustomEvent("endChatButtonPressed", {
        detail: {
          chatId: safeCurrentChat?.id,
          attemptId: safeAttemptId,
        },
      })
    );
    setEndingAction("endChat");
    safeEndChat();
  };

  // Handle End Session button click (ends whole session)
  const handleEndSession = () => {
    const incompleteChats = safeChats.filter((chat) => !chat.completed).length;
    const createdChats = safeChats.length;
    const remainingScenarios = safeExpectedChatCount - createdChats;
    const remainingSessions = incompleteChats + remainingScenarios;
    setEndAllRemainingSessions(remainingSessions);
    setConfirmEndAllOpen(true);
  };

  return (
    <>
      <div className="flex gap-2">
        {/* Next Chat button - only show if not last attempt */}
        {!isLastAttempt && (
          <Button
            type="button"
            variant="outline"
            onClick={handleNextChat}
            disabled={
              endChatLoading || (simulation?.timeLimit ? !isActive : false)
            }
            className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
            data-tour-end-chat
          >
            {/* Red dot indicator for previous chats - overlays on top right corner */}
            {hasPreviousChats && (
              <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3 border-2 border-white shadow-sm z-10" />
            )}

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
                : "Next Chat"}
            </span>
          </Button>
        )}

        {/* End Session button - always show, outline variant when last attempt */}
        <Button
          type="button"
          variant={isLastAttempt ? "outline" : "destructive"}
          onClick={handleEndSession}
          disabled={endChatLoading}
          className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
          data-tour-end-all
        >
          {/* Red dot indicator for better previous attempts (only on last attempt) - overlays on top right corner */}
          {isLastAttempt && hasBetterPreviousAttempt && (
            <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3 border-2 border-white shadow-sm z-10" />
          )}

          {endChatLoading && endingAction === "endAll"
            ? "Ending..."
            : "End Session"}
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
                      attemptId: safeAttemptId,
                      remainingSessions: endAllRemainingSessions,
                    },
                  })
                );
                setConfirmEndAllOpen(false);
                setEndingAction("endAll");
                safeEndAllChats();
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Dispatch endChatButtonPressed event for tour progression and navigating state management
                window.dispatchEvent(
                  new CustomEvent("endChatButtonPressed", {
                    detail: {
                      chatId: safeCurrentChat?.id,
                      attemptId: safeAttemptId,
                    },
                  })
                );
                setConfirmEndChatOpen(false);
                setEndingAction("endChat");
                safeEndChat();
              }}
            >
              End Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Previous Chats Selection Dialog */}
      <AlertDialog
        open={showPreviousChatsDialog}
        onOpenChange={setShowPreviousChatsDialog}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reuse score from previous attempt?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have completed this scenario before. Select a previous attempt
              to reuse its score, or continue normally.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            {(() => {
              const currentChatData = attemptData?.chats.find(
                (c) => c.chat.id === safeCurrentChat?.id
              );
              const previousChats = currentChatData?.previousChats || [];

              if (previousChats.length === 0) {
                return null;
              }

              return (
                <RadioGroup
                  value={selectedPreviousChatId || ""}
                  onValueChange={setSelectedPreviousChatId}
                >
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="" id="none" />
                      <Label htmlFor="none" className="cursor-pointer">
                        Continue normally (don't reuse score)
                      </Label>
                    </div>
                    {previousChats.map((prevChat) => (
                      <div
                        key={prevChat.chatId}
                        className="flex items-center space-x-2"
                      >
                        <RadioGroupItem
                          value={prevChat.chatId}
                          id={prevChat.chatId}
                        />
                        <Label
                          htmlFor={prevChat.chatId}
                          className="cursor-pointer flex-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {prevChat.title}
                            </span>
                            <span className="text-sm text-muted-foreground ml-2">
                              {prevChat.score !== null &&
                              prevChat.passed !== null
                                ? `${prevChat.score} pts (${prevChat.passed ? "Passed" : "Failed"})`
                                : "No score"}
                            </span>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              );
            })()}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowPreviousChatsDialog(false);
                setSelectedPreviousChatId(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Dispatch endChatButtonPressed event for tour progression
                window.dispatchEvent(
                  new CustomEvent("endChatButtonPressed", {
                    detail: {
                      chatId: safeCurrentChat?.id,
                      attemptId: safeAttemptId,
                    },
                  })
                );
                setShowPreviousChatsDialog(false);
                setEndingAction("endChat");
                safeEndChat(
                  undefined,
                  selectedPreviousChatId && selectedPreviousChatId !== ""
                    ? selectedPreviousChatId
                    : undefined
                );
                setSelectedPreviousChatId(null);
              }}
              disabled={false}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
