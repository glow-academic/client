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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useProfile } from "@/contexts/profile-context";
import { useSimulation } from "@/contexts/simulation-context";
import { formatTime } from "@/utils/time";
import { useEffect, useMemo, useState } from "react";

export function SimulationControls() {
  const simulationContext = useSimulation();
  const { effectiveProfile, activeProfile } = useProfile();

  // Get data from context (v2 single source of truth)
  const currentChatMessages = simulationContext?.currentMessages || [];
  const attemptProfileId = simulationContext?.attemptProfileId;

  // Check if current user is the owner of this attempt
  // Allow buttons to show even if profile IDs aren't loaded yet (they'll be disabled by isActive)
  const isAttemptOwner = useMemo(() => {
    // If no attemptProfileId yet, assume owner (will be disabled by isActive if not)
    if (!attemptProfileId) {
      return true; // Show buttons, will be disabled if actually not owner
    }
    if (!activeProfile?.id || !effectiveProfile?.id) {
      return true; // Show buttons, will be disabled if actually not owner
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
  const [selectedPermutation, setSelectedPermutation] = useState<string>("");

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
    currentChat,
    attemptId,
    endAllChats,
    attemptData,
    isLoadingChats,
    shouldShowControls,
  } = simulationContext || {};

  // Generate permutations for End All dialog
  // Must be computed before early returns to maintain hook order
  type PermutationOption = {
    scenarioId: string;
    chatId: string | null; // null means "continue normally"
    previousChatId: string | null;
    title: string;
    score: number | null;
    percentage: number | null;
    timeTaken: number | null;
  };

  type Permutation = {
    id: string;
    options: PermutationOption[];
    totalScore: number;
    totalPercentage: number | null;
    totalTimeTaken: number;
  };

  // Get all simulation scenarios with their previous chats for permutation generation
  const allSimulationScenarios = useMemo(() => {
    // Early return if attemptData is not available
    if (!attemptData) {
      return [];
    }

    if (
      !attemptData.allSimulationScenarios ||
      !Array.isArray(attemptData.allSimulationScenarios)
    ) {
      return [];
    }

    // Map to include chatId if a chat exists for this scenario
    return attemptData.allSimulationScenarios.map((scenarioData) => {
      // Find all chats for this scenario in the current attempt
      const scenarioChats =
        attemptData.chats?.filter((c) => c.scenario?.id === scenarioData.id) ||
        [];

      // Check if this scenario has at least one chat with a grade (completed and graded)
      const hasGradedChat = scenarioChats.some(
        (c) => c.chat.completed && c.gradingState !== null
      );

      // Get the first chat ID if any exist
      const firstChat = scenarioChats[0];

      return {
        scenarioId: scenarioData.id,
        scenarioName: scenarioData.name || "Scenario",
        chatId: firstChat?.chat.id || null,
        hasCompletedChat: hasGradedChat,
        // previousChats comes from allSimulationScenarios (v3)
        previousChats:
          scenarioData.previousChats || firstChat?.previousChats || [],
      };
    });
  }, [attemptData]);

  // Filter to only include scenarios without completed chats for End All permutations
  const remainingScenarios = useMemo(() => {
    return allSimulationScenarios.filter(
      (scenario) => !scenario.hasCompletedChat
    );
  }, [allSimulationScenarios]);

  const permutations = useMemo(() => {
    // Only generate permutations for remaining scenarios (without completed chats)
    if (remainingScenarios.length === 0) return [];

    // Generate all permutations using cartesian product
    const generatePermutations = (
      scenarios: typeof remainingScenarios,
      index: number = 0,
      currentPermutation: PermutationOption[] = []
    ): PermutationOption[][] => {
      if (index >= scenarios.length) {
        return [currentPermutation];
      }

      const scenario = scenarios[index];
      if (!scenario) return [];

      const options: PermutationOption[] = [
        // Option 1: Skip/End without score (always available when ending session)
        {
          scenarioId: scenario.scenarioId,
          chatId: scenario.chatId,
          previousChatId: null,
          title: "Skip (no score)",
          score: null,
          percentage: null,
          timeTaken: null,
        },
        // Options 2+: Each previous chat (reuse score from previous attempt)
        ...scenario.previousChats.map((prevChat) => ({
          scenarioId: scenario.scenarioId,
          chatId: scenario.chatId,
          previousChatId: prevChat.chatId,
          title: prevChat.title,
          score: prevChat.score,
          percentage: prevChat.percentage,
          timeTaken: prevChat.timeTaken,
        })),
      ];

      const results: PermutationOption[][] = [];
      for (const option of options) {
        const newPermutation = [...currentPermutation, option];
        results.push(
          ...generatePermutations(scenarios, index + 1, newPermutation)
        );
      }

      return results;
    };

    const allPermutations = generatePermutations(remainingScenarios);

    // Calculate total scores and percentages for each permutation
    const permutationsWithScores: Permutation[] = allPermutations.map(
      (perm, idx) => {
        const totalScore = perm.reduce((sum, opt) => sum + (opt.score || 0), 0);
        const totalTimeTaken = perm.reduce(
          (sum, opt) => sum + (opt.timeTaken || 0),
          0
        );

        // Calculate total percentage - include skipped sessions as 0 in the average
        // Skipped sessions (null percentage) count as 0 and are included in the average
        const totalPercentage =
          perm.length > 0
            ? Math.round(
                perm.reduce((sum, opt) => sum + (opt.percentage || 0), 0) /
                  perm.length
              )
            : null;

        return {
          id: `perm-${idx}`,
          options: perm,
          totalScore,
          totalPercentage,
          totalTimeTaken,
        };
      }
    );

    // Sort by total score (descending), then by total percentage (descending)
    return permutationsWithScores.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      if (a.totalPercentage === null && b.totalPercentage === null) return 0;
      if (a.totalPercentage === null) return 1;
      if (b.totalPercentage === null) return -1;
      return b.totalPercentage - a.totalPercentage;
    });
  }, [remainingScenarios]);

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
  const currentGrade = currentChatData?.dynamicRubric;
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

  // Don't show buttons while data is still loading
  if (isLoadingChats) {
    return null;
  }

  // Don't show buttons if attemptData is not available
  if (!attemptData) {
    return null;
  }

  // Don't show buttons if server says not to (not all scenarios have completed chats)
  if (shouldShowControls === false) {
    return null;
  }

  // After this point, simulationContext is guaranteed to exist
  // TypeScript doesn't know this, so we need to assert or use the values directly
  const safeEndChat = endChat!;
  const safeEndAllChats = endAllChats!;
  const safeAttemptId = attemptId!;
  const safeCurrentChat = currentChat!;

  // Don't show if user is not the owner
  if (!isAttemptOwner) {
    return null;
  }

  // Note: We still show buttons even when showResults is true or timer expired
  // They will be disabled instead (handled by isActive check)

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
    // Use the actual count of remaining scenarios (without completed chats)
    const remainingSessions = remainingScenarios.length;
    setEndAllRemainingSessions(remainingSessions);

    // If there are permutations available, select the best one by default
    if (permutations && permutations.length > 0) {
      setSelectedPermutation(permutations[0]!.id);
    }

    setConfirmEndAllOpen(true);
  };

  // Determine if we should show combined button (1 remaining scenario) or separate buttons (2+ remaining)
  const isLastRemainingScenario = remainingScenarios.length === 1;

  return (
    <>
      <div className="flex gap-2">
        {/* If only 1 remaining scenario, show "Next Chat" button styled but with "End Session" text */}
        {isLastRemainingScenario && shouldShowControls ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleNextChat}
            disabled={endChatLoading}
            className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
            data-tour-end-chat
          >
            {/* Red dot indicator for previous chats - overlays on top right corner */}
            {hasPreviousChats && (
              <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3 border-2 border-white shadow-sm z-10" />
            )}

            {/* Grading progress overlay - fills from left to right */}
            {(() => {
              const isGrading = simulationContext?.isGrading;
              const progress = simulationContext?.gradingProgress;
              return isGrading && progress ? (
                <span
                  className="absolute inset-0 bg-blue-500/20 transition-all duration-100 ease-out"
                  style={{
                    width: `${progress.displayedProgress}%`,
                  }}
                />
              ) : null;
            })()}

            {/* Button text - "End Session" but functionally it's Next Chat */}
            <span className="relative z-10">
              {endChatLoading && endingAction === "endChat"
                ? "Ending..."
                : "End Session"}
            </span>
          </Button>
        ) : (
          <>
            {/* Next Chat button - only show if there are 2+ remaining scenarios */}
            {shouldShowControls && remainingScenarios.length > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleNextChat}
                disabled={endChatLoading}
                className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
                data-tour-end-chat
              >
                {/* Red dot indicator for previous chats - overlays on top right corner */}
                {hasPreviousChats && (
                  <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3 border-2 border-white shadow-sm z-10" />
                )}

                {/* Grading progress overlay - fills from left to right */}
                {(() => {
                  const isGrading = simulationContext?.isGrading;
                  const progress = simulationContext?.gradingProgress;
                  return isGrading && progress ? (
                    <span
                      className="absolute inset-0 bg-blue-500/20 transition-all duration-100 ease-out"
                      style={{
                        width: `${progress.displayedProgress}%`,
                      }}
                    />
                  ) : null;
                })()}

                {/* Button text */}
                <span className="relative z-10">
                  {endChatLoading && endingAction === "endChat"
                    ? "Ending..."
                    : "Next Chat"}
                </span>
              </Button>
            )}

            {/* End Session button - show when there are remaining scenarios OR when all scenarios have graded chats */}
            {(shouldShowControls && remainingScenarios.length >= 1) ||
            !shouldShowControls ? (
              <Button
                type="button"
                variant={shouldShowControls ? "destructive" : "outline"}
                onClick={handleEndSession}
                disabled={endChatLoading}
                className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
                data-tour-end-all
              >
                {/* Red dot indicator for better previous attempts - overlays on top right corner */}
                {hasBetterPreviousAttempt && (
                  <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3 border-2 border-white shadow-sm z-10" />
                )}

                {endChatLoading && endingAction === "endAll"
                  ? "Ending..."
                  : "End Session"}
              </Button>
            ) : null}
          </>
        )}
      </div>

      {/* Confirm End All Dialog with Permutation Selection */}
      <AlertDialog open={confirmEndAllOpen} onOpenChange={setConfirmEndAllOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>End all remaining sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              {permutations.length > 0
                ? `Choose which previous attempts to use for the ${endAllRemainingSessions} remaining session${endAllRemainingSessions === 1 ? "" : "s"}. Permutations are sorted by highest total score.`
                : `This will mark ${endAllRemainingSessions} remaining session${endAllRemainingSessions === 1 ? "" : "s"} as incomplete, and their scores will not count.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {permutations.length > 0 ? (
            <div className="flex-1 overflow-auto">
              <RadioGroup
                value={selectedPermutation}
                onValueChange={setSelectedPermutation}
                className="space-y-3 pr-4"
              >
                {permutations.map((perm) => (
                  <div
                    key={perm.id}
                    className={`rounded-lg border-2 transition-colors ${
                      selectedPermutation === perm.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Label htmlFor={perm.id} className="cursor-pointer block">
                      {/* Header row with radio button and cumulative info */}
                      <div className="flex items-center gap-3 p-3 pb-2">
                        <RadioGroupItem
                          value={perm.id}
                          id={perm.id}
                          className="flex-shrink-0"
                        />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-medium">
                            Total: {perm.totalScore} pts
                          </span>
                          {perm.totalPercentage !== null && (
                            <Badge variant="secondary">
                              {perm.totalPercentage}%
                            </Badge>
                          )}
                          {perm.totalTimeTaken > 0 && (
                            <span className="text-sm text-muted-foreground">
                              ({formatTime(perm.totalTimeTaken)})
                            </span>
                          )}
                          {perm.id === permutations[0]?.id && (
                            <Badge variant="default" className="ml-auto">
                              Best
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* Individual chat cases below */}
                      <div className="space-y-1 px-3 pb-3 pl-11">
                        {perm.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className="text-sm text-muted-foreground"
                          >
                            <span>{opt.title}</span>
                            {opt.score !== null && (
                              <>
                                {" ("}
                                {opt.percentage !== null
                                  ? `${opt.percentage}%`
                                  : `${opt.score} pts`}
                                {opt.timeTaken !== null &&
                                  ` - ${formatTime(opt.timeTaken)}`}
                                {")"}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ) : null}

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

                // Extract permutation map if one is selected
                let previousChatMap: Record<string, string | null> | undefined;
                if (selectedPermutation && permutations.length > 0) {
                  const selectedPerm = permutations.find(
                    (p) => p.id === selectedPermutation
                  );
                  if (selectedPerm) {
                    previousChatMap = {};
                    selectedPerm.options.forEach((opt) => {
                      if (opt.previousChatId !== null) {
                        previousChatMap![opt.scenarioId] = opt.previousChatId;
                      }
                    });
                  }
                }

                setConfirmEndAllOpen(false);
                setEndingAction("endAll");
                safeEndAllChats(previousChatMap);
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
              to reuse its score, or{" "}
              {isLastRemainingScenario ? "end normally" : "continue normally"}.
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
                        {isLastRemainingScenario
                          ? "End normally"
                          : "Continue normally"}{" "}
                        (don't reuse score)
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
                                ? `${prevChat.percentage ?? "N/A"}% (${prevChat.passed ? "Passed" : "Failed"})${prevChat.timeTaken !== null ? ` - ${formatTime(prevChat.timeTaken)}` : ""}`
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
              {isLastRemainingScenario ? "End" : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
