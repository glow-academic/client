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

      setEndChatLoading(true);
      setEndingAction("endAll");

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
    socket.on("simulation_grading_progress", handleSimulationGradingProgress);

    return () => {
      socket.off("simulation_continued", handleSimulationContinued);
      socket.off("continue_simulation_error", handleSimulationError);
      socket.off(
        "simulation_grading_progress",
        handleSimulationGradingProgress
      );
    };
  }, [socket, currentChatId]);

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

  // Get previous chats for current chat
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

  // Don't show buttons if attemptData is not available
  if (!attemptData) {
    return null;
  }

  // Don't show buttons if server says not to (not all scenarios have completed chats)
  if (shouldShowControls === false) {
    return null;
  }

  // Don't show if no current chat
  if (!currentChat) {
    return null;
  }

  // Note: We still show buttons even when showResults is true or timer expired
  // They will be disabled instead (handled by isActive check)

  // Handle Next Chat button click (moves to next chat)
  const handleNextChat = () => {
    const totalMessages = currentMessages.length;

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
          chatId: currentChat.id,
          attemptId: attemptId,
        },
      })
    );
    endChat();
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
            {isGrading && gradingProgress ? (
              <span
                className="absolute inset-0 bg-blue-500/20 transition-all duration-100 ease-out"
                style={{
                  width: `${gradingProgress.displayedProgress}%`,
                }}
              />
            ) : null}

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
                      attemptId: attemptId,
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
                endAllChats(previousChatMap);
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
                      chatId: currentChat.id,
                      attemptId: attemptId,
                    },
                  })
                );
                setConfirmEndChatOpen(false);
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
              to reuse its score, or{" "}
              {isLastRemainingScenario ? "end normally" : "continue normally"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            {(() => {
              // Use the same previousChats logic as the red dot indicator
              // Get from allSimulationScenarios using the parent scenario ID
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
                      chatId: currentChat.id,
                      attemptId: attemptId,
                    },
                  })
                );
                setShowPreviousChatsDialog(false);
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
              {isLastRemainingScenario ? "End" : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
