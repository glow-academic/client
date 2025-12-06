/**
 * SimulationControls.tsx
 * Controls for ending chats and sessions during simulation attempts
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";

import type { AttemptFullOut } from "@/app/(main)/home/a/[attemptId]/page";
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
import { formatTime } from "@/utils/time";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export interface SimulationControlsProps {
  attemptId: string;
  attemptData: AttemptFullOut;
}

export function SimulationControls({
  attemptId,
  attemptData,
}: SimulationControlsProps) {
  const { socket } = useProfile();

  // Extract data from attemptData
  const attempt = attemptData?.attempt || null;
  const currentChatIndex = attemptData?.currentChatIndex ?? 0;
  const shouldShowControls = attemptData?.shouldShowControls ?? true;
  const isPracticeSimulation =
    attemptData?.simulation?.practiceSimulation ?? false;
  const isInfiniteMode = attemptData?.attempt?.infiniteMode ?? false;
  const showResults = attemptData?.showResults ?? false;
  const isActive = attemptData?.isActive ?? true;

  // Find current chat from server data
  const currentChat = useMemo(() => {
    if (!attemptData?.chats || attemptData.chats.length === 0) return null;
    const chatData = attemptData.chats[currentChatIndex];
    return chatData?.chat || attemptData.chats[0]?.chat || null;
  }, [attemptData, currentChatIndex]);

  const currentChatId = currentChat?.id || null;

  // Get current messages from server data
  const currentMessages = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return [];
    const chatData = attemptData.chats.find(
      (c) => c.chat.id === currentChat.id
    );
    return chatData?.messages ?? [];
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
  const [showUsePreviousDialog, setShowUsePreviousDialog] = useState(false);
  const [selectedContinuationPermutation, setSelectedContinuationPermutation] =
    useState<string>("");

  // Track which action is ending, so only that button shows "Ending..."
  const [endingAction, setEndingAction] = useState<"endAll" | "endChat" | null>(
    null
  );
  const [endChatLoading, setEndChatLoading] = useState(false);

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
        const continueData: {
          chat_id: string;
          attempt_id: string;
          end_all: boolean;
          previous_chat_id?: string;
        } = {
          chat_id: targetChatId,
          attempt_id: attemptId,
          end_all: false,
        };
        if (previousChatId) {
          continueData.previous_chat_id = previousChatId;
        }
        socket.emit("continue_simulation", continueData);
      } catch (error) {
        toast.error(`Failed to end chat: ${error}`);
        setEndChatLoading(false);
        setEndingAction(null);
      }
    },
    [currentChatId, socket, attemptId]
  );

  // End all chats function
  const endAllChats = useCallback(
    async (previousChatMap?: Record<string, string | null>) => {
      if (!attempt || !currentChatId || !socket) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      // Don't set local state here - let WebSocket events drive the state
      // Server will emit end_all_started event which all watchers will receive
      try {
        const continueData: {
          chat_id: string;
          attempt_id: string;
          end_all: boolean;
          previous_chat_map?: Record<string, string | null>;
        } = {
          chat_id: currentChatId!, // Non-null assertion: already checked above
          attempt_id: attemptId,
          end_all: true,
        };
        if (previousChatMap) {
          continueData.previous_chat_map = previousChatMap;
        }
        socket.emit("continue_simulation", continueData);
      } catch (error) {
        toast.error(`Failed to end all chats: ${error}`);
        // Only reset on error - success/completion handled by WebSocket events
        setEndChatLoading(false);
        setEndingAction(null);
      }
    },
    [attempt, currentChatId, attemptId, socket]
  );

  // Listen for WebSocket events to reset loading state and handle grading
  useEffect(() => {
    if (!socket) return;

    const handleSimulationContinued = () => {
      setEndChatLoading(false);
      setEndingAction(null);
    };

    const handleSimulationError = () => {
      setEndChatLoading(false);
      setEndingAction(null);
    };

    const handleEndAllStarted = (data: {
      chat_id: string;
      attempt_id: string;
    }) => {
      // Only handle if this event is for the current chat
      if (!currentChatId || data.chat_id !== currentChatId) return;

      // Set loading state - all watchers will see this
      setEndChatLoading(true);
      setEndingAction("endAll");
      // Close confirmation dialog if still open
      setConfirmEndAllOpen(false);
    };

    const handleEndChatStarted = (data: {
      chat_id: string;
      attempt_id: string;
    }) => {
      // Only handle if this event is for the current chat
      if (!currentChatId || data.chat_id !== currentChatId) return;

      // Set loading state - all watchers will see this
      setEndChatLoading(true);
      setEndingAction("endChat");
      // Close confirmation dialog if still open
      setConfirmEndChatOpen(false);
    };

    const handleEndAllCompleted = (data: {
      success: boolean;
      message: string;
      chat_id: string;
      attempt_id: string;
      completed_chat_ids?: string[];
      next_chat_ids?: (string | null)[];
      all_completed?: boolean;
    }) => {
      // Only handle if this event is for the current chat
      if (!currentChatId || data.chat_id !== currentChatId) return;

      // Reset loading state - all watchers will see this
      setEndChatLoading(false);
      setEndingAction(null);
    };

    const handleSimulationGradingProgress = (data: {
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
          (data.completed_count / data.total_count) * 100
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

    socket.on("simulation_continued", handleSimulationContinued);
    socket.on("continue_simulation_error", handleSimulationError);
    socket.on("end_all_started", handleEndAllStarted);
    socket.on("end_chat_started", handleEndChatStarted);
    socket.on("end_all_completed", handleEndAllCompleted);
    socket.on("simulation_grading_progress", handleSimulationGradingProgress);

    return () => {
      socket.off("simulation_continued", handleSimulationContinued);
      socket.off("continue_simulation_error", handleSimulationError);
      socket.off("end_all_started", handleEndAllStarted);
      socket.off("end_chat_started", handleEndChatStarted);
      socket.off("end_all_completed", handleEndAllCompleted);
      socket.off(
        "simulation_grading_progress",
        handleSimulationGradingProgress
      );
    };
  }, [socket, currentChatId]);

  // Get all simulation scenarios with their previous chats (for remaining scenarios calculation)
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
      // Use parentScenarioId to match correctly (child scenarios map to parent scenarios)
      const scenarioChats =
        attemptData.chats?.filter(
          (c) => c.chat.parentScenarioId === scenarioData.id
        ) || [];

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

  // Use server-side calculation for remaining scenarios
  // Filter to only include scenarios without completed chats
  const remainingScenarios = useMemo(() => {
    return allSimulationScenarios.filter(
      (scenario) => !scenario.hasCompletedChat
    );
  }, [allSimulationScenarios]);

  // Get previous chats for current chat to show red dot indicator
  // Must be computed before early returns to maintain hook order
  const currentChatData = useMemo(() => {
    return attemptData?.chats.find((c) => c.chat.id === currentChat?.id);
  }, [attemptData?.chats, currentChat?.id]);

  // Get available continuation options from server
  const continuationOptions = useMemo(() => {
    return attemptData?.availableContinuationOptions || null;
  }, [attemptData]);

  // Generate permutations from continuation options (sequential: 1, 1+2, 1+2+3, etc.)
  type ContinuationPermutationOption = {
    scenarioId: string;
    scenarioName: string;
    previousChatId: string | null;
    title: string;
    score: number | null;
    percentage: number | null;
    timeTaken: number | null;
  };

  type ContinuationPermutation = {
    id: string;
    options: ContinuationPermutationOption[];
    totalScore: number;
    totalPercentage: number | null;
    totalTimeTaken: number;
  };

  const continuationPermutations = useMemo(() => {
    if (!continuationOptions?.nextSequentialOptions?.length) return [];

    // Group options by scenario position
    const optionsByPosition = new Map<number, ContinuationPermutationOption[]>();
    continuationOptions.nextSequentialOptions.forEach((opt) => {
      const pos = opt.position || 0;
      if (!optionsByPosition.has(pos)) {
        optionsByPosition.set(pos, []);
      }
      optionsByPosition.get(pos)!.push({
        scenarioId: opt.scenarioId,
        scenarioName: opt.scenarioName,
        previousChatId: opt.previousChatId,
        title: opt.title,
        score: opt.score ?? null,
        percentage: opt.percentage ?? null,
        timeTaken: opt.timeTaken ?? null,
      });
    });

    // Generate sequential permutations (1, 1+2, 1+2+3, etc.)
    const positions = Array.from(optionsByPosition.keys()).sort((a, b) => a - b);
    const allPermutations: ContinuationPermutation[] = [];

    // For each sequence length (1, 2, 3, ...)
    for (let seqLen = 1; seqLen <= positions.length; seqLen++) {
      const seqPositions = positions.slice(0, seqLen);
      
      // Generate all permutations for this sequence using cartesian product
      const generatePermutations = (
        posIndex: number = 0,
        currentPerm: ContinuationPermutationOption[] = []
      ): ContinuationPermutationOption[][] => {
        if (posIndex >= seqPositions.length) {
          return [currentPerm];
        }

        const pos = seqPositions[posIndex]!;
        const options = optionsByPosition.get(pos) || [];
        const results: ContinuationPermutationOption[][] = [];

        for (const option of options) {
          results.push(...generatePermutations(posIndex + 1, [...currentPerm, option]));
        }

        return results;
      };

      const perms = generatePermutations();
      perms.forEach((perm, idx) => {
        const totalScore = perm.reduce((sum, opt) => sum + (opt.score || 0), 0);
        const totalTimeTaken = perm.reduce((sum, opt) => sum + (opt.timeTaken || 0), 0);
        const percentages = perm.map((opt) => opt.percentage).filter((p) => p !== null) as number[];
        const totalPercentage =
          percentages.length > 0
            ? Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length)
            : null;

        allPermutations.push({
          id: `perm-${seqLen}-${idx}`,
          options: perm,
          totalScore,
          totalPercentage,
          totalTimeTaken,
        });
      });
    }

    // Sort by total score (descending), then by total percentage (descending)
    return allPermutations.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      if (a.totalPercentage === null && b.totalPercentage === null) return 0;
      if (a.totalPercentage === null) return 1;
      if (b.totalPercentage === null) return -1;
      return b.totalPercentage - a.totalPercentage;
    });
  }, [continuationOptions]);

  // Check if "Use Previous" button should be shown
  const shouldShowUsePrevious = useMemo(() => {
    if (isPracticeSimulation) return false; // Practice simulations can't use previous chats
    return continuationPermutations.length > 0;
  }, [isPracticeSimulation, continuationPermutations]);

  // Get previous chats for current chat (for red dot indicator)
  // Prefer using previousChats directly from chat data (server-computed, uses parent scenario ID)
  // Fallback to allSimulationScenarios if chat data doesn't have previousChats
  const previousChats = useMemo(() => {
    if (!currentChatData) return [];

    // First try: Use previousChats directly from chat data (server-computed with parent scenario ID)
    const chatPreviousChats = currentChatData.previousChats || [];
    if (chatPreviousChats.length > 0) {
      return chatPreviousChats;
    }

    // Fallback: Use parentScenarioId from chat to find in allSimulationScenarios
    if (!allSimulationScenarios.length) return [];

    const parentScenarioId =
      currentChatData.chat.parentScenarioId || currentChatData.scenario?.id;

    if (!parentScenarioId) return [];

    // Find the matching scenario in allSimulationScenarios
    const matchingScenario = allSimulationScenarios.find(
      (s) => s.scenarioId === parentScenarioId
    );

    return matchingScenario?.previousChats || [];
  }, [currentChatData, allSimulationScenarios]);

  // For practice simulations, never show previous chats (must always go through manual grading)
  const hasPreviousChats = !isPracticeSimulation && previousChats.length > 0;

  // Check if there's a better previous attempt (higher score or passed when current failed)
  // Must be before early returns to maintain hook order
  // Practice simulations never have better previous attempts (must always go through manual grading)
  const currentGrade = currentChatData?.dynamicRubric;
  const hasBetterPreviousAttempt = useMemo(() => {
    if (isPracticeSimulation || !hasPreviousChats || !currentGrade)
      return false;

    const currentScore = currentGrade.score || 0;
    const currentPassed = currentGrade.passed || false;

    // Check if any previous chat has better score or passed when current failed
    return previousChats.some((prevChat) => {
      const prevScore = prevChat.score || 0;
      const prevPassed = prevChat.passed || false;

      // Better if: previous passed and current didn't, OR previous has higher score
      return (prevPassed && !currentPassed) || prevScore > currentScore;
    });
  }, [isPracticeSimulation, hasPreviousChats, currentGrade, previousChats]);

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

  // Handle Use Previous button click (shows continuation options)
  const handleUsePrevious = () => {
    const totalMessages = currentMessages.length;

    // Show confirmation if chat has 0 messages and no continuation options
    if (totalMessages === 0 && !shouldShowUsePrevious) {
      setConfirmEndChatOpen(true);
      return;
    }

    // Show unified dialog with continuation options
    if (shouldShowUsePrevious) {
      setShowUsePreviousDialog(true);
      // Select best permutation by default
      if (continuationPermutations.length > 0) {
        setSelectedContinuationPermutation(continuationPermutations[0]!.id);
      } else {
        setSelectedContinuationPermutation("");
      }
      return;
    }

    // No options available, proceed normally
    endChat();
  };

  // Handle End Session button click (always does default end session logic)
  const handleEndSession = () => {
    const totalMessages = currentMessages.length;

    // Show confirmation if current chat has 0 messages
    if (totalMessages === 0) {
      setIsEndingSessionFromZeroMessages(true);
      setConfirmEndChatOpen(true);
      return;
    }

    // In infinite mode, skip confirmation dialog and end directly
    if (isInfiniteMode) {
      endAllChats();
      return;
    }

    // Always end all chats with default behavior (no options)
    endAllChats();
  };

  // Use server-side calculation for isLastRemainingScenario
  const isLastRemainingScenario =
    attemptData?.isLastRemainingScenario ?? remainingScenarios.length === 1;

  return (
    <>
      <div className="flex gap-2">
        {/* Infinite mode: Always show both buttons for cycling/ending */}
        {isInfiniteMode ? (
          <>
            {/* Use Previous button - only show if options are available */}
            {shouldShowUsePrevious && (
              <Button
                type="button"
                variant={isGrading ? "outline" : "secondary"}
                onClick={handleUsePrevious}
                disabled={endChatLoading}
                className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
              >
                {/* Grading progress overlay - fills from left to right */}
                {isGrading && gradingProgress ? (
                  <span
                    className="absolute inset-0 bg-blue-500/20 transition-all duration-100 ease-out"
                    style={{
                      width: `${gradingProgress.displayedProgress}%`,
                    }}
                  />
                ) : null}

                {/* Button text */}
                <span className="relative z-10">
                  {endChatLoading && endingAction === "endChat"
                    ? "Ending..."
                    : "Use Previous"}
                </span>
              </Button>
            )}

            {/* End Session button - always visible in infinite mode to stop cycling */}
            <Button
              type="button"
              variant="default"
              onClick={handleEndSession}
              disabled={endChatLoading}
              className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
            >
              {endChatLoading && endingAction === "endAll"
                ? "Ending..."
                : "End Session"}
            </Button>
          </>
        ) : (
          <>
            {/* Normal mode */}
            {/* Use Previous button - only show if options are available */}
            {shouldShowUsePrevious && shouldShowControls && (
              <Button
                type="button"
                variant={isGrading ? "outline" : "secondary"}
                onClick={handleUsePrevious}
                disabled={endChatLoading}
                className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
                data-tour-end-chat
              >
                {/* Grading progress overlay - fills from left to right */}
                {isGrading && gradingProgress ? (
                  <span
                    className="absolute inset-0 bg-blue-500/20 transition-all duration-100 ease-out"
                    style={{
                      width: `${gradingProgress.displayedProgress}%`,
                    }}
                  />
                ) : null}

                {/* Button text */}
                <span className="relative z-10">
                  {endChatLoading && endingAction === "endChat"
                    ? "Ending..."
                    : "Use Previous"}
                </span>
              </Button>
            )}

            {/* End Session button - always visible */}
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
          </>
        )}
      </div>

      {/* Use Previous Dialog - Unified continuation options with permutation UI */}
      <AlertDialog
        open={showUsePreviousDialog}
        onOpenChange={setShowUsePreviousDialog}
      >
        <AlertDialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>Use Previous Attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              Choose which previous attempts to use. Permutations are sorted by highest total score.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {continuationPermutations.length > 0 ? (
            <div className="flex-1 overflow-auto">
              <RadioGroup
                value={selectedContinuationPermutation}
                onValueChange={setSelectedContinuationPermutation}
                className="space-y-3 pr-4"
              >
                {continuationPermutations.map((perm) => (
                  <div
                    key={perm.id}
                    className={`rounded-lg border-2 transition-colors ${
                      selectedContinuationPermutation === perm.id
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
                          {perm.id === continuationPermutations[0]?.id && (
                            <Badge variant="default" className="ml-auto">
                              Best
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* Individual scenario options below */}
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
                                  opt.timeTaken > 0 &&
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
            <AlertDialogCancel
              onClick={() => {
                setShowUsePreviousDialog(false);
                setSelectedContinuationPermutation("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowUsePreviousDialog(false);
                if (!selectedContinuationPermutation) {
                  // Continue normally if nothing selected
                  endChat();
                  setSelectedContinuationPermutation("");
                  return;
                }

                const selectedPerm = continuationPermutations.find(
                  (p) => p.id === selectedContinuationPermutation
                );

                if (selectedPerm && selectedPerm.options.length > 0) {
                  // Build previous_chat_map for multiple scenarios or use previous_chat_id for single
                  if (selectedPerm.options.length === 1) {
                    // Single scenario - use previous_chat_id
                    const option = selectedPerm.options[0]!;
                    if (option.previousChatId) {
                      endChat(undefined, option.previousChatId);
                    } else {
                      endChat();
                    }
                  } else {
                    // Multiple scenarios - build previous_chat_map and end all chats
                    const previousChatMap: Record<string, string | null> = {};
                    selectedPerm.options.forEach((opt) => {
                      if (opt.previousChatId) {
                        previousChatMap[opt.scenarioId] = opt.previousChatId;
                      }
                    });
                    endAllChats(Object.keys(previousChatMap).length > 0 ? previousChatMap : undefined);
                  }
                } else {
                  // Fallback: continue normally
                  endChat();
                }
                setSelectedContinuationPermutation("");
              }}
              disabled={!selectedContinuationPermutation}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
