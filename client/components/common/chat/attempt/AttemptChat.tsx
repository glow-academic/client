/**
 * AttemptChat.tsx
 * Used to display the attempt chat. Will wrap the AttemptInput and AttemptMessages components, creating the unified look. This page will add the header, and timer, as well as toggle the TableRubric in the correct mode. The simulation-context.tsx will be the one that wraps this with the necessary functions to call websocket events.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImperativePanelGroupHandle } from "react-resizable-panels";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

// Icons
import {
  CheckCircle2,
  Clock,
  FileText,
  Infinity as InfinityIcon,
  ListChecks,
  Table,
} from "lucide-react";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import DocumentSelect from "@/components/common/chat/DocumentSelect";
import DocumentViewer from "@/components/common/chat/viewers/DocumentViewer";
import { useSimulation } from "@/contexts/simulation-context";
import { formatTime } from "@/utils/time";

import TableRubric from "@/components/common/rubric/TableRubric";
import { Progress } from "@/components/ui/progress";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import AttemptInput from "./AttemptInput";
import AttemptMessages from "./AttemptMessages";

export default function AttemptChat() {
  const router = useRouter();
  const simulationContext = useSimulation();
  const { effectiveProfile, activeProfile } = useProfile();

  // Infer types directly from simulation context
  type Chat = NonNullable<
    NonNullable<typeof simulationContext>["chats"][number]
  >;
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const queryClient = useQueryClient();
  const updateChatCreatedAtMutation = useMutation({
    mutationFn: async (request: { chatId: string; createdAt: string }) =>
      api.post("/attempts/chats/update-created-at", { body: request }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.attempts.all });
    },
  });
  const updateChatCreatedAt = updateChatCreatedAtMutation.mutateAsync;
  const isMobile = useIsMobile();

  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
  const [inputPanelHeight, setInputPanelHeight] = useState<number>(70); // Default height in pixels
  const [showObjectives, setShowObjectives] = useState<boolean>(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);

  // Create a ref for the panel group
  const inputPanelGroupRef = useRef<ImperativePanelGroupHandle>(null);

  // Track which chats have had their timestamps reset to prevent infinite loops
  const resetChatTimestampsRef = useRef<Set<string>>(new Set());

  // Get attempt profile ID from context (v2 single source of truth)
  const attemptProfileId = simulationContext?.attemptProfileId;

  // Check if current user is the owner of this attempt (activeProfile, effectiveProfile, and attempt.profileId must all match)
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

  // Set breadcrumb context when attempt data is loaded
  useEffect(() => {
    if (simulationContext?.simulation?.title && simulationContext?.attemptId) {
      const displayName = `${simulationContext.simulation.title}`;
      setEntityMetadata({
        entityId: simulationContext.attemptId,
        entityName: displayName,
        entityType: "attempt",
      });
    }
    return () => clearEntityMetadata();
  }, [
    simulationContext?.simulation?.title,
    simulationContext?.attemptId,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Get current chat from context
  const displayChat =
    simulationContext?.chats[simulationContext.currentChatIndex];

  // Get UI state from context (persists across chat switches)
  const showGrades = simulationContext?.showGrades ?? false;
  const showDocuments = simulationContext?.showDocuments ?? true;

  // Chat picker component - reusable Select component for chat selection
  const chatPicker = useMemo(() => {
    if (simulationContext?.isSingleChatAttempt) return null;

    return (
      <Select
        value={
          simulationContext?.chats[simulationContext.currentChatIndex]?.id || ""
        }
        onValueChange={(chatId) => {
          const chatIndex = simulationContext?.chats.findIndex(
            (chat) => chat.id === chatId
          );
          if (chatIndex !== undefined && chatIndex >= 0) {
            simulationContext?.setCurrentChatIndex(chatIndex);
          }
        }}
      >
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select chat to view results" />
        </SelectTrigger>
        <SelectContent>
          {simulationContext?.chats?.map((chat: Chat) => {
            // Find rubric result for this chat
            const rubricResult = simulationContext?.allDynamicRubrics.find(
              (rubric) => rubric.chatId === chat.id
            );

            return (
              <SelectItem key={chat.id} value={chat.id}>
                <div className="flex items-center gap-2">
                  {chat.completed && !rubricResult ? (
                    <Badge variant="secondary" className="text-xs">
                      Incomplete
                    </Badge>
                  ) : rubricResult ? (
                    <Badge
                      variant={rubricResult.passed ? "default" : "destructive"}
                      className={`text-xs ${
                        rubricResult.passed
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      }`}
                    >
                      {rubricResult.passed ? "Pass" : "Fail"}
                    </Badge>
                  ) : null}
                  <span>{chat.title}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }, [simulationContext]);

  // Get selected scenario from context (v2 single source of truth)
  const selectedScenario = useMemo(() => {
    if (!displayChat?.id || !simulationContext?.scenariosByChatId) {
      return simulationContext?.scenario;
    }
    return (
      simulationContext.scenariosByChatId[displayChat.id] ||
      simulationContext.scenario
    );
  }, [
    displayChat?.id,
    simulationContext?.scenariosByChatId,
    simulationContext?.scenario,
  ]);

  // Helper function to calculate time taken from chat timestamps
  const calculateChatTimeTaken = useCallback((chat: Chat | null): number => {
    if (!chat?.completed || !chat.completedAt) return 0;

    const startTime = new Date(chat.createdAt).getTime();
    const endTime = new Date(chat.completedAt).getTime();
    const timeTakenSeconds = Math.floor((endTime - startTime) / 1000);

    return timeTakenSeconds;
  }, []);

  // Helper function to calculate adjusted time limit for multi-simulation attempts
  const calculateAdjustedTimeLimit = useCallback(
    (_chat: Chat | null): number => {
      if (
        !simulationContext?.simulation?.timeLimit ||
        !simulationContext?.chats
      ) {
        return 0;
      }

      const totalTimeLimitSeconds = simulationContext.simulation.timeLimit * 60;
      const totalChats = simulationContext.chats.length;

      // For multi-simulation attempts, split time evenly
      if (totalChats > 1) {
        return Math.floor(totalTimeLimitSeconds / totalChats);
      }

      // For single simulation attempts, use the full time limit
      return totalTimeLimitSeconds;
    },
    [simulationContext?.simulation?.timeLimit, simulationContext?.chats]
  );

  // Helper function to calculate how much time was exceeded for a chat
  const calculateTimeExceeded = useCallback(
    (chat: Chat | null): number => {
      if (!chat?.completed) return 0;

      const timeTaken = calculateChatTimeTaken(chat);
      const adjustedTimeLimit = calculateAdjustedTimeLimit(chat);

      return Math.max(0, timeTaken - adjustedTimeLimit);
    },
    [calculateChatTimeTaken, calculateAdjustedTimeLimit]
  );

  // Reset createdAt timestamp when chat is first loaded (if createdAt and updatedAt are the same)
  useEffect(() => {
    const resetChatTimestamp = async () => {
      if (!simulationContext?.currentChat || !isAttemptOwner) return;

      const chat = simulationContext.currentChat;

      // Don't reset timestamps for completed chats
      if (chat.completed) return;

      // Check if we've already reset timestamps for this chat to prevent infinite loops
      if (resetChatTimestampsRef.current.has(chat.id)) return;

      const createdAt = new Date(chat.createdAt);
      const updatedAt = new Date(chat.updatedAt);

      // Check if createdAt and updatedAt are the same (within 1 second tolerance)
      const timeDiff = Math.abs(createdAt.getTime() - updatedAt.getTime());
      if (timeDiff <= 1000) {
        // Mark this chat as processed to prevent infinite loops
        resetChatTimestampsRef.current.add(chat.id);

        // Reset createdAt to current time ONLY - never update updatedAt
        const now = new Date();

        try {
          await updateChatCreatedAt({
            chatId: chat.id,
            createdAt: now.toISOString(),
          });
        } catch {
          // Error handling - timestamp reset failed silently
        }
      }
    };

    resetChatTimestamp();
  }, [
    simulationContext?.currentChat,
    isAttemptOwner,
    simulationContext?.attemptId,
    updateChatCreatedAt,
  ]);

  // Auto-select first chat when results show and default to showing rubric if all chats completed
  useEffect(() => {
    if (
      simulationContext?.showResults &&
      simulationContext?.chats &&
      simulationContext?.chats.length > 0 &&
      simulationContext.currentChatIndex === 0
    ) {
      // Ensure we're on the first chat
      if (
        simulationContext?.chats[0] &&
        simulationContext.currentChatIndex !== 0
      ) {
        simulationContext.setCurrentChatIndex(0);
      }

      // If all chats are completed, default to showing rubric (only if user hasn't manually toggled)
      const completedChats = simulationContext?.chats.filter(
        (chat: Chat) => chat.completed
      );
      if (
        completedChats.length === simulationContext?.chats.length &&
        !simulationContext?.userHasManuallyToggledGrades
      ) {
        simulationContext?.setShowGrades(true);
      }
    }
  }, [
    simulationContext?.showResults,
    simulationContext?.chats,
    simulationContext?.currentChatIndex,
    simulationContext?.setCurrentChatIndex,
    simulationContext?.setShowGrades,
    simulationContext,
  ]);

  // Reset selected document when chat changes - scope to current chat's documents
  useEffect(() => {
    if (!displayChat || !simulationContext?.scenarioDocuments) {
      setSelectedDocumentId(null);
      return;
    }

    // Filter documents to only include current chat's documents
    const currentChatDocIds = displayChat.documentIds || [];
    const filteredDocs = simulationContext.scenarioDocuments.filter((doc) =>
      currentChatDocIds.includes(doc.document_id)
    );

    // Set to first document of current chat, or null if no documents
    if (filteredDocs.length > 0) {
      // Only update if current selection is not valid for this chat
      if (
        !selectedDocumentId ||
        !currentChatDocIds.includes(selectedDocumentId)
      ) {
        const firstDoc = filteredDocs[0];
        if (firstDoc) {
          setSelectedDocumentId(firstDoc.document_id);
        }
      }
    } else {
      setSelectedDocumentId(null);
    }
  }, [
    displayChat,
    simulationContext?.currentChatIndex,
    simulationContext?.scenarioDocuments,
    selectedDocumentId,
  ]);

  if (simulationContext?.isLoadingChats) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (!simulationContext?.chats || simulationContext?.chats.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Attempt Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The attempt you're looking for doesn't exist or has no chats
              available.
            </p>
            <Button onClick={() => router.push("/home")}>
              Return To Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // In infinite mode, force chat view until time has expired
  const isAttemptInfinite = Boolean(simulationContext?.attempt?.infiniteMode);
  const hasTimeLimit = Boolean(simulationContext?.simulation?.timeLimit);
  const timeRemaining = simulationContext?.timer.remaining;
  const shouldForceChatView =
    isAttemptInfinite && (!hasTimeLimit || (timeRemaining ?? 1) > 0);

  // Show results screen (but not during active infinite mode)
  if (simulationContext?.showResults && !shouldForceChatView) {
    const isInfiniteMode = simulationContext?.attempt?.infiniteMode;
    const infiniteLimitMinutes =
      simulationContext?.simulation?.timeLimit ?? null;
    return (
      <div className="h-[calc(100vh-4rem)]">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Main Results Area */}
          <ResizablePanel
            defaultSize={
              showDocuments && simulationContext?.scenarioDocuments.length > 0
                ? 70
                : 100
            }
            className="md:flex-none"
          >
            <Card className="h-full flex flex-col py-4">
              <div className="h-full flex flex-col">
                {/* Timer and Controls Header - consistent with main chat layout */}
                <Collapsible
                  open={showObjectives}
                  onOpenChange={setShowObjectives}
                  className="border-b"
                >
                  <div className="p-4 pt-0 flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        {/* Show scenario information */}
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {selectedScenario?.problemStatement ||
                              simulationContext?.scenario?.problemStatement ||
                              "Session Results"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {/* Buttons and timer row */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-4">
                            {displayChat && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={
                                        showGrades ? "default" : "outline"
                                      }
                                      size="sm"
                                      onClick={() => {
                                        simulationContext?.setShowGrades(
                                          !showGrades
                                        );
                                        simulationContext?.setUserHasManuallyToggledGrades(
                                          true
                                        );
                                      }}
                                      className={`p-2 ${showGrades ? "bg-primary text-primary-foreground" : ""}`}
                                    >
                                      <Table className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {showGrades
                                        ? "Hide Rubric"
                                        : "Show Rubric"}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Documents Toggle - only show if current chat has documents */}
                            {(() => {
                              const currentChatDocIds =
                                displayChat?.documentIds || [];
                              const hasDocumentsForCurrentChat =
                                simulationContext?.scenarioDocuments?.some(
                                  (doc) =>
                                    currentChatDocIds.includes(doc.document_id)
                                );
                              return hasDocumentsForCurrentChat;
                            })() && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={
                                        showDocuments ? "default" : "outline"
                                      }
                                      size="sm"
                                      onClick={() => {
                                        // Mobile: open modal, Desktop: toggle panel
                                        if (isMobile) {
                                          setShowDocumentModal(true);
                                        } else {
                                          simulationContext?.setShowDocuments(
                                            !showDocuments
                                          );
                                        }
                                      }}
                                      className={`p-2 ${showDocuments ? "bg-primary text-primary-foreground" : ""}`}
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {showDocuments
                                        ? "Hide Documents"
                                        : "Show Documents"}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* Objectives Toggle - only show if simulation has objectives enabled and current chat scenario has objectives, hide in grading mode and results view */}
                            {simulationContext?.simulation?.objectivesEnabled &&
                              (() => {
                                const currentScenario = displayChat?.id
                                  ? simulationContext?.scenariosByChatId[
                                      displayChat.id
                                    ]
                                  : null;
                                const hasObjectives =
                                  currentScenario?.objectives &&
                                  currentScenario.objectives.length > 0;
                                return hasObjectives;
                              })() &&
                              !showGrades &&
                              !simulationContext?.showResults && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <CollapsibleTrigger asChild>
                                        <Button
                                          variant={
                                            showObjectives
                                              ? "default"
                                              : "outline"
                                          }
                                          size="sm"
                                          onClick={(e) => {
                                            // Mobile: open modal, Desktop: use collapsible
                                            if (isMobile) {
                                              e.preventDefault();
                                              setShowObjectivesModal(true);
                                            }
                                          }}
                                          className={`p-2 ${showObjectives ? "bg-primary text-primary-foreground" : ""}`}
                                        >
                                          <ListChecks className="h-4 w-4" />
                                        </Button>
                                      </CollapsibleTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {showObjectives
                                          ? "Hide Objectives"
                                          : "Show Objectives"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                                      displayChat &&
                                      simulationContext?.allDynamicRubrics.find(
                                        (rubric) =>
                                          rubric.chatId === displayChat.id
                                      )
                                        ? simulationContext?.allDynamicRubrics.find(
                                            (rubric) =>
                                              rubric.chatId === displayChat.id
                                          )?.passed
                                          ? "bg-green-100 dark:bg-green-900/30"
                                          : "bg-red-100 dark:bg-red-900/30"
                                        : displayChat && !displayChat.completed
                                          ? "bg-red-100 dark:bg-red-900/30"
                                          : simulationContext?.aggregatedResults
                                            ? simulationContext
                                                ?.aggregatedResults.passed
                                              ? "bg-green-100 dark:bg-green-900/30"
                                              : "bg-red-100 dark:bg-red-900/30"
                                            : "bg-muted"
                                    }`}
                                  >
                                    {isInfiniteMode ? (
                                      <InfinityIcon className="h-4 w-4" />
                                    ) : (
                                      <Clock className="h-4 w-4" />
                                    )}
                                    <span
                                      className={`text-sm font-medium ${
                                        displayChat && displayChat.completed
                                          ? calculateTimeExceeded(displayChat) >
                                              0 &&
                                            simulationContext?.simulation
                                              ?.timeLimit
                                            ? "text-red-500"
                                            : ""
                                          : ""
                                      }`}
                                      data-testid="timer"
                                    >
                                      {displayChat && displayChat.completed
                                        ? formatTime(
                                            calculateChatTimeTaken(displayChat)
                                          )
                                        : isInfiniteMode
                                          ? infiniteLimitMinutes
                                            ? formatTime(
                                                infiniteLimitMinutes * 60
                                              )
                                            : formatTime(
                                                simulationContext?.timer
                                                  .elapsed || 0
                                              )
                                          : simulationContext?.simulation
                                                ?.timeLimit && displayChat
                                            ? formatTime(
                                                calculateAdjustedTimeLimit(
                                                  displayChat
                                                )
                                              )
                                            : "No time limit"}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                {displayChat &&
                                showGrades &&
                                simulationContext?.allDynamicRubrics.find(
                                  (rubric) => rubric.chatId === displayChat.id
                                ) ? (
                                  <TooltipContent>
                                    <p className="flex items-center flex-wrap gap-x-0">
                                      <span>
                                        {simulationContext?.allDynamicRubrics.find(
                                          (rubric) =>
                                            rubric.chatId === displayChat.id
                                        )?.passed
                                          ? "Passed"
                                          : "Failed"}
                                        (
                                        {
                                          simulationContext?.allDynamicRubrics.find(
                                            (rubric) =>
                                              rubric.chatId === displayChat.id
                                          )?.score
                                        }
                                        /
                                        {
                                          simulationContext?.allDynamicRubrics.find(
                                            (rubric) =>
                                              rubric.chatId === displayChat.id
                                          )?.totalPossiblePoints
                                        }
                                        )
                                      </span>
                                      {calculateTimeExceeded(displayChat) > 0 &&
                                        simulationContext?.simulation
                                          ?.timeLimit && (
                                          <span className="text-xs text-muted-foreground ml-2">
                                            +
                                            {formatTime(
                                              calculateTimeExceeded(displayChat)
                                            )}
                                          </span>
                                        )}
                                    </p>
                                  </TooltipContent>
                                ) : displayChat && !displayChat.completed ? (
                                  <TooltipContent>
                                    <p>Incomplete</p>
                                  </TooltipContent>
                                ) : simulationContext?.aggregatedResults ? (
                                  <TooltipContent>
                                    <p>
                                      {((
                                        simulationContext?.aggregatedResults as {
                                          overallPassed?: boolean;
                                          passed?: boolean;
                                        }
                                      )?.overallPassed ??
                                      (
                                        simulationContext?.aggregatedResults as {
                                          overallPassed?: boolean;
                                          passed?: boolean;
                                        }
                                      )?.passed)
                                        ? "Passed"
                                        : "Failed"}{" "}
                                      (
                                      {Math.round(
                                        (
                                          simulationContext?.aggregatedResults as {
                                            averageScore?: number;
                                            percentage?: number;
                                          }
                                        )?.averageScore ??
                                          (
                                            simulationContext?.aggregatedResults as {
                                              averageScore?: number;
                                              percentage?: number;
                                            }
                                          )?.percentage ??
                                          0
                                      )}
                                      /
                                      {simulationContext?.allDynamicRubrics?.[0]
                                        ?.totalPossiblePoints || 100}{" "}
                                      points)
                                    </p>
                                  </TooltipContent>
                                ) : null}
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                        {/* Chat picker row - show when multi-chat attempt */}
                        {!simulationContext?.isSingleChatAttempt &&
                          chatPicker && (
                            <div className="flex justify-end">{chatPicker}</div>
                          )}
                      </div>
                    </div>

                    {/* Objectives Collapsible Content - Desktop Only, hide in grading mode */}
                    {simulationContext?.simulation?.objectivesEnabled &&
                      (() => {
                        const currentScenario = displayChat?.id
                          ? simulationContext?.scenariosByChatId[displayChat.id]
                          : null;
                        const objectives = currentScenario?.objectives || [];
                        return objectives.length > 0;
                      })() &&
                      !showGrades && (
                        <CollapsibleContent className="pt-2 hidden md:block">
                          <div className="px-4 pb-2">
                            <ul className="space-y-2 list-none">
                              {(() => {
                                const currentScenario = displayChat?.id
                                  ? simulationContext?.scenariosByChatId[
                                      displayChat.id
                                    ]
                                  : null;
                                const objectives =
                                  currentScenario?.objectives || [];
                                return objectives.map((objective, index) => (
                                  <li
                                    key={index}
                                    className="font-normal flex items-start gap-2"
                                  >
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                    <span className="flex-1 -mt-0.5">
                                      {objective}
                                    </span>
                                  </li>
                                ));
                              })()}
                            </ul>
                          </div>
                        </CollapsibleContent>
                      )}
                  </div>
                </Collapsible>

                <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                  <ScrollArea className="flex-1 px-4 min-h-0">
                    <div className="space-y-4 py-4">
                      {/* Show rubric when toggle is on */}
                      {showGrades &&
                      displayChat &&
                      simulationContext?.rubricStructure ? (
                        <div className="space-y-4 py-4">
                          <TableRubric
                            standardGroups={
                              simulationContext.rubricStructure.standardGroups
                            }
                            standardGroupsMapping={
                              simulationContext.rubricStructure
                                .standardGroupsMapping
                            }
                            standardsMapping={
                              simulationContext.rubricStructure
                                .standardsMapping as Parameters<
                                typeof TableRubric
                              >[0]["standardsMapping"]
                            }
                            {...(displayChat?.id &&
                              simulationContext.gradingStatesByChatId[
                                displayChat.id
                              ] && {
                                gradingState: simulationContext
                                  .gradingStatesByChatId[
                                  displayChat.id
                                ] as NonNullable<
                                  Parameters<
                                    typeof TableRubric
                                  >[0]["gradingState"]
                                >,
                              })}
                          />
                        </div>
                      ) : displayChat ? (
                        /* Show chat messages for both single and multi-chat attempts */
                        <div className="space-y-4">
                          <AttemptMessages
                            chatId={displayChat.id}
                            isAttemptOwner={isAttemptOwner}
                          />
                        </div>
                      ) : (
                        /* Fallback content when no chat is selected */
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">
                            Select a chat to view its conversation and results.
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </div>
            </Card>
          </ResizablePanel>

          {/* Right Panel - Documents */}
          {showDocuments &&
            (() => {
              // Filter documents for current chat's scenario
              const currentChatDocIds = displayChat?.documentIds || [];
              const filteredDocs =
                simulationContext?.scenarioDocuments.filter((doc) =>
                  currentChatDocIds.includes(doc.document_id)
                ) || [];

              return (
                filteredDocs.length > 0 && (
                  <>
                    <ResizableHandle className="bg-transparent hidden md:block" />
                    <ResizablePanel
                      defaultSize={30}
                      minSize={20}
                      maxSize={50}
                      className="hidden md:block"
                    >
                      <Card className="h-full flex flex-col ml-4 p-0">
                        <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
                          {/* Select dropdown directly above document */}
                          {filteredDocs.length > 1 && (
                            <div className="p-3 pb-2 border-b">
                              <DocumentSelect
                                documents={filteredDocs}
                                selectedDocumentId={selectedDocumentId}
                                onDocumentSelect={setSelectedDocumentId}
                              />
                            </div>
                          )}
                          {/* Document viewer with minimal padding */}
                          <div className="flex-1 min-h-0 p-2">
                            {selectedDocumentId &&
                              (() => {
                                const document =
                                  filteredDocs.find(
                                    (doc) =>
                                      doc.document_id === selectedDocumentId
                                  ) || filteredDocs[0];
                                return document ? (
                                  <DocumentViewer
                                    key={selectedDocumentId}
                                    document={document}
                                  />
                                ) : null;
                              })()}
                          </div>
                        </CardContent>
                      </Card>
                    </ResizablePanel>
                  </>
                )
              );
            })()}
        </ResizablePanelGroup>

        {/* Document Modal - Mobile Only */}
        <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
          <DialogContent
            className="sm:max-w-4xl max-h-[80vh] md:overflow-hidden overflow-auto flex flex-col"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <DialogHeader>
              <DialogTitle>
                {(() => {
                  const currentChatDocIds = displayChat?.documentIds || [];
                  const filteredDocs =
                    simulationContext?.scenarioDocuments.filter((doc) =>
                      currentChatDocIds.includes(doc.document_id)
                    ) || [];
                  return (
                    filteredDocs.find(
                      (doc) => doc.document_id === selectedDocumentId
                    )?.name ||
                    filteredDocs[0]?.name ||
                    "Document"
                  );
                })()}
              </DialogTitle>
              <DialogDescription>View scenario document</DialogDescription>
            </DialogHeader>

            {/* Document selector (if multiple documents) */}
            {(() => {
              const currentChatDocIds = displayChat?.documentIds || [];
              const filteredDocs =
                simulationContext?.scenarioDocuments.filter((doc) =>
                  currentChatDocIds.includes(doc.document_id)
                ) || [];
              return filteredDocs.length > 1 ? (
                <div className="pb-3">
                  <DocumentSelect
                    documents={filteredDocs}
                    selectedDocumentId={selectedDocumentId}
                    onDocumentSelect={setSelectedDocumentId}
                  />
                </div>
              ) : null;
            })()}

            {/* Document viewer */}
            {selectedDocumentId && (
              <div className="flex-1 overflow-auto">
                {(() => {
                  const currentChatDocIds = displayChat?.documentIds || [];
                  const filteredDocs =
                    simulationContext?.scenarioDocuments.filter((doc) =>
                      currentChatDocIds.includes(doc.document_id)
                    ) || [];
                  const document =
                    filteredDocs.find(
                      (doc) => doc.document_id === selectedDocumentId
                    ) || filteredDocs[0];
                  return document ? (
                    <DocumentViewer document={document} bare={true} />
                  ) : null;
                })()}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDocumentModal(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Objectives Modal - Mobile Only */}
        <Dialog
          open={showObjectivesModal}
          onOpenChange={setShowObjectivesModal}
        >
          <DialogContent
            className="sm:max-w-2xl max-h-[80vh] overflow-auto flex flex-col"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <DialogHeader>
              <DialogTitle>Learning Objectives</DialogTitle>
              <DialogDescription>
                View the learning objectives for this scenario
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto py-4">
              {(() => {
                const currentScenario = displayChat?.id
                  ? simulationContext?.scenariosByChatId[displayChat.id]
                  : null;
                const objectives = currentScenario?.objectives || [];

                if (objectives.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground italic">
                      No objectives defined for this scenario.
                    </p>
                  );
                }

                return (
                  <ul className="space-y-2 list-none">
                    {objectives.map((objective, index) => (
                      <li
                        key={index}
                        className="font-normal flex items-start gap-2"
                      >
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span className="flex-1 -mt-0.5">{objective}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowObjectivesModal(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Main Chat Area */}
        <ResizablePanel
          defaultSize={
            showDocuments && simulationContext?.scenarioDocuments.length > 0
              ? 70
              : 100
          }
          className="md:flex-none"
        >
          <Card className="h-full flex flex-col py-4">
            <TooltipProvider>
              <ResizablePanelGroup
                ref={inputPanelGroupRef}
                direction="vertical"
                className="h-full"
              >
                <ResizablePanel defaultSize={88} minSize={70}>
                  <div className="h-full flex flex-col">
                    {/* Timer and Controls Header */}
                    <Collapsible
                      open={showObjectives}
                      onOpenChange={setShowObjectives}
                      className="border-b"
                    >
                      <div className="p-4 pt-0 flex flex-col gap-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-start gap-2">
                              <span className="font-medium">
                                {simulationContext?.scenario
                                  ?.problemStatement ||
                                  simulationContext?.scenario?.name ||
                                  simulationContext?.currentChat?.title}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-start justify-end gap-2">
                            <div className="flex items-center gap-4">
                              {/* Hide completed badge logic in infinite mode */}
                              {!simulationContext?.attempt?.infiniteMode &&
                                simulationContext?.currentChat?.completed &&
                                simulationContext?.expectedChatCount ===
                                  simulationContext?.chats.filter(
                                    (chat: Chat) => chat.completed
                                  ).length && (
                                  <Badge variant="default">Completed</Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                              {(() => {
                                const currentChatDocIds =
                                  displayChat?.documentIds || [];
                                const hasDocumentsForCurrentChat =
                                  simulationContext?.scenarioDocuments?.some(
                                    (doc) =>
                                      currentChatDocIds.includes(
                                        doc.document_id
                                      )
                                  );
                                return hasDocumentsForCurrentChat;
                              })() && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={
                                        showDocuments ? "default" : "outline"
                                      }
                                      size="sm"
                                      onClick={() => {
                                        // Mobile: open modal, Desktop: toggle panel
                                        if (window.innerWidth < 768) {
                                          setShowDocumentModal(true);
                                        } else {
                                          simulationContext?.setShowDocuments(
                                            !showDocuments
                                          );
                                        }
                                      }}
                                      className={`p-2 ${showDocuments ? "bg-primary text-primary-foreground" : ""}`}
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {showDocuments
                                        ? "Hide Documents"
                                        : "Show Documents"}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              {/* Objectives Toggle - only show if simulation has objectives enabled and current chat scenario has objectives */}
                              {simulationContext?.simulation
                                ?.objectivesEnabled &&
                                (() => {
                                  const currentScenario = displayChat?.id
                                    ? simulationContext?.scenariosByChatId[
                                        displayChat.id
                                      ]
                                    : null;
                                  const hasObjectives =
                                    currentScenario?.objectives &&
                                    currentScenario.objectives.length > 0;
                                  return hasObjectives;
                                })() && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <CollapsibleTrigger asChild>
                                        <Button
                                          variant={
                                            showObjectives
                                              ? "default"
                                              : "outline"
                                          }
                                          size="sm"
                                          onClick={(e) => {
                                            // Mobile: open modal, Desktop: use collapsible
                                            if (window.innerWidth < 768) {
                                              e.preventDefault();
                                              setShowObjectivesModal(true);
                                            }
                                          }}
                                          className={`p-2 ${showObjectives ? "bg-primary text-primary-foreground" : ""}`}
                                        >
                                          <ListChecks className="h-4 w-4" />
                                        </Button>
                                      </CollapsibleTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {showObjectives
                                          ? "Hide Objectives"
                                          : "Show Objectives"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                                      !simulationContext?.attempt
                                        ?.infiniteMode &&
                                      simulationContext?.currentChat
                                        ?.completed &&
                                      simulationContext?.currentDynamicRubric &&
                                      simulationContext?.expectedChatCount ===
                                        simulationContext?.chats.filter(
                                          (chat: Chat) => chat.completed
                                        ).length
                                        ? simulationContext
                                            ?.currentDynamicRubric.passed
                                          ? "bg-green-100 dark:bg-green-900/30"
                                          : "bg-red-100 dark:bg-red-900/30"
                                        : "bg-muted"
                                    }`}
                                  >
                                    {simulationContext?.attempt
                                      ?.infiniteMode ? (
                                      <InfinityIcon className="h-4 w-4" />
                                    ) : (
                                      <Clock className="h-4 w-4" />
                                    )}
                                    <span
                                      className={`text-sm font-medium ${
                                        simulationContext?.attempt?.infiniteMode
                                          ? ""
                                          : simulationContext?.simulation
                                                ?.timeLimit &&
                                              simulationContext?.timer
                                                .remaining !== null &&
                                              simulationContext?.timer
                                                .remaining < 0
                                            ? "text-red-500"
                                            : ""
                                      }`}
                                      data-testid="timer"
                                    >
                                      {simulationContext?.attempt?.infiniteMode
                                        ? simulationContext?.simulation
                                            ?.timeLimit
                                          ? formatTime(
                                              Math.max(
                                                simulationContext?.timer
                                                  .remaining || 0,
                                                0
                                              )
                                            )
                                          : formatTime(
                                              simulationContext?.timer.elapsed
                                            )
                                        : simulationContext?.simulation
                                              ?.timeLimit &&
                                            simulationContext?.timer
                                              .remaining !== null
                                          ? formatTime(
                                              simulationContext?.timer.remaining
                                            )
                                          : formatTime(
                                              simulationContext?.timer.elapsed
                                            )}
                                    </span>
                                    {/* In infinite mode, we don't show negative state; we auto-finish on expiry */}
                                  </div>
                                </TooltipTrigger>
                                {!simulationContext?.attempt?.infiniteMode &&
                                  simulationContext?.currentChat?.completed &&
                                  simulationContext?.currentDynamicRubric &&
                                  simulationContext?.expectedChatCount ===
                                    simulationContext?.chats.filter(
                                      (chat: Chat) => chat.completed
                                    ).length && (
                                    <TooltipContent>
                                      <p>
                                        {simulationContext?.currentDynamicRubric
                                          .passed
                                          ? "Passed"
                                          : "Failed"}
                                        (
                                        {
                                          simulationContext
                                            ?.currentDynamicRubric.score
                                        }
                                        /
                                        {
                                          simulationContext
                                            ?.currentDynamicRubric
                                            .totalPossiblePoints
                                        }
                                        )
                                      </p>
                                    </TooltipContent>
                                  )}
                              </Tooltip>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Objectives Collapsible Content - hide in grading mode */}
                      {simulationContext?.simulation?.objectivesEnabled &&
                        (() => {
                          const currentScenario = displayChat?.id
                            ? simulationContext?.scenariosByChatId[
                                displayChat.id
                              ]
                            : null;
                          const objectives = currentScenario?.objectives || [];
                          return objectives.length > 0;
                        })() &&
                        !showGrades && (
                          <CollapsibleContent className="pt-2">
                            <div className="px-4 pb-2">
                              <ul className="space-y-2 list-none">
                                {(() => {
                                  const currentScenario = displayChat?.id
                                    ? simulationContext?.scenariosByChatId[
                                        displayChat.id
                                      ]
                                    : null;
                                  const objectives =
                                    currentScenario?.objectives || [];
                                  return objectives.map((objective, index) => (
                                    <li
                                      key={index}
                                      className="font-normal flex items-start gap-2"
                                    >
                                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                      <span className="flex-1 -mt-0.5">
                                        {objective}
                                      </span>
                                    </li>
                                  ));
                                })()}
                              </ul>
                            </div>
                          </CollapsibleContent>
                        )}
                    </Collapsible>

                    {/* Messages Area */}
                    {/* Progress Bar at the very top */}
                    {/* Hide progress bar in infinite mode */}
                    {!simulationContext?.attempt?.infiniteMode &&
                      simulationContext?.expectedChatCount > 1 && (
                        <div className="p-0">
                          <Progress
                            value={(() => {
                              // Count unique scenarios with at least one graded chat
                              // A scenario is considered complete only if it has at least one chat with a grade
                              const scenariosWithGrades = new Set<string>();
                              simulationContext?.attemptData?.chats?.forEach(
                                (chatData) => {
                                  if (
                                    chatData.chat.completed &&
                                    chatData.scenario?.id
                                  ) {
                                    scenariosWithGrades.add(
                                      chatData.scenario.id
                                    );
                                  }
                                }
                              );
                              return (
                                (scenariosWithGrades.size /
                                  simulationContext?.expectedChatCount) *
                                100
                              );
                            })()}
                            className="w-full bg-transparent rounded-none [&>div]:rounded-none [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-purple-500"
                          />
                        </div>
                      )}
                    <AttemptMessages isAttemptOwner={isAttemptOwner} />
                  </div>
                </ResizablePanel>

                <ResizableHandle disabled />
                {/* Input Area */}
                <div
                  style={{
                    height: `${inputPanelHeight}px`,
                    minHeight: "70px",
                    maxHeight: "160px",
                  }}
                >
                  <AttemptInput
                    isAttemptOwner={isAttemptOwner}
                    onHeightChange={setInputPanelHeight}
                  />
                </div>
              </ResizablePanelGroup>
            </TooltipProvider>
          </Card>
        </ResizablePanel>

        {/* Right Panel - Documents */}
        {showDocuments &&
          (() => {
            // Filter documents for current chat's scenario
            const currentChatDocIds = displayChat?.documentIds || [];
            const filteredDocs =
              simulationContext?.scenarioDocuments.filter((doc) =>
                currentChatDocIds.includes(doc.document_id)
              ) || [];

            return (
              filteredDocs.length > 0 && (
                <>
                  <ResizableHandle className="bg-transparent hidden md:block" />
                  <ResizablePanel
                    defaultSize={30}
                    minSize={20}
                    maxSize={50}
                    className="hidden md:block"
                  >
                    <Card className="h-full flex flex-col ml-4 p-0">
                      <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
                        {/* Select dropdown directly above document */}
                        {filteredDocs.length > 1 && (
                          <div className="p-3 pb-2 border-b">
                            <DocumentSelect
                              documents={filteredDocs}
                              selectedDocumentId={selectedDocumentId}
                              onDocumentSelect={setSelectedDocumentId}
                            />
                          </div>
                        )}
                        {/* Document viewer with minimal padding */}
                        <div className="flex-1 min-h-0 p-2">
                          {selectedDocumentId &&
                            (() => {
                              const document =
                                filteredDocs.find(
                                  (doc) =>
                                    doc.document_id === selectedDocumentId
                                ) || filteredDocs[0];
                              return document ? (
                                <DocumentViewer
                                  key={selectedDocumentId}
                                  document={document}
                                />
                              ) : null;
                            })()}
                        </div>
                      </CardContent>
                    </Card>
                  </ResizablePanel>
                </>
              )
            );
          })()}
      </ResizablePanelGroup>

      {/* Document Modal - Mobile Only */}
      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent
          className="sm:max-w-4xl max-h-[80vh] md:overflow-hidden overflow-auto flex flex-col"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <DialogHeader>
            <DialogTitle>
              {(() => {
                const currentChatDocIds = displayChat?.documentIds || [];
                const filteredDocs =
                  simulationContext?.scenarioDocuments.filter((doc) =>
                    currentChatDocIds.includes(doc.document_id)
                  ) || [];
                return (
                  filteredDocs.find(
                    (doc) => doc.document_id === selectedDocumentId
                  )?.name ||
                  filteredDocs[0]?.name ||
                  "Document"
                );
              })()}
            </DialogTitle>
            <DialogDescription>View scenario document</DialogDescription>
          </DialogHeader>

          {/* Document selector (if multiple documents) */}
          {(() => {
            const currentChatDocIds = displayChat?.documentIds || [];
            const filteredDocs =
              simulationContext?.scenarioDocuments.filter((doc) =>
                currentChatDocIds.includes(doc.document_id)
              ) || [];
            return filteredDocs.length > 1 ? (
              <div className="pb-3">
                <DocumentSelect
                  documents={filteredDocs}
                  selectedDocumentId={selectedDocumentId}
                  onDocumentSelect={setSelectedDocumentId}
                />
              </div>
            ) : null;
          })()}

          {/* Document viewer */}
          {selectedDocumentId && (
            <div className="flex-1 overflow-auto">
              {(() => {
                const currentChatDocIds = displayChat?.documentIds || [];
                const filteredDocs =
                  simulationContext?.scenarioDocuments.filter((doc) =>
                    currentChatDocIds.includes(doc.document_id)
                  ) || [];
                const document =
                  filteredDocs.find(
                    (doc) => doc.document_id === selectedDocumentId
                  ) || filteredDocs[0];
                return document ? (
                  <DocumentViewer document={document} bare={true} />
                ) : null;
              })()}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDocumentModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Objectives Modal - Mobile Only */}
      <Dialog open={showObjectivesModal} onOpenChange={setShowObjectivesModal}>
        <DialogContent
          className="sm:max-w-2xl max-h-[80vh] overflow-auto flex flex-col"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <DialogHeader>
            <DialogTitle>Learning Objectives</DialogTitle>
            <DialogDescription>
              View the learning objectives for this scenario
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            {(() => {
              const currentScenario = displayChat?.id
                ? simulationContext?.scenariosByChatId[displayChat.id]
                : null;
              const objectives = currentScenario?.objectives || [];

              if (objectives.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground italic">
                    No objectives defined for this scenario.
                  </p>
                );
              }

              return (
                <ul className="space-y-2 list-none">
                  {objectives.map((objective, index) => (
                    <li
                      key={index}
                      className="font-medium flex items-start gap-2"
                    >
                      <span className="text-primary mt-1.5 flex-shrink-0">
                        •
                      </span>
                      <span className="flex-1">{objective}</span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowObjectivesModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
