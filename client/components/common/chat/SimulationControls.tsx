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
    attemptData,
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

            // Check if current chat has previous chats for same scenario
            const currentChatData = attemptData?.chats.find(
              (c) => c.chat.id === currentChat?.id
            );
            const previousChats = currentChatData?.previousChats || [];

            if (previousChats.length > 0) {
              // Show dialog to select previous chat
              setShowPreviousChatsDialog(true);
              setSelectedPreviousChatId(""); // Default to "continue normally"
            } else {
              // No previous chats, proceed normally
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
            }
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
                (c) => c.chat.id === currentChat?.id
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
                      chatId: currentChat?.id,
                      attemptId: attemptId,
                    },
                  })
                );
                setShowPreviousChatsDialog(false);
                setEndingAction("endChat");
                endChat(
                  undefined,
                  selectedPreviousChatId && selectedPreviousChatId !== ""
                    ? selectedPreviousChatId
                    : undefined
                );
                setSelectedPreviousChatId(null);
              }}
              disabled={false}
            >
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
