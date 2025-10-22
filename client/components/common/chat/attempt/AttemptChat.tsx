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
import { Clock, FileText, Infinity as InfinityIcon, Table } from "lucide-react";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import DocumentSelect from "@/components/common/chat/DocumentSelect";
import DocumentViewer from "@/components/common/chat/DocumentViewer";
import { useSimulation } from "@/contexts/simulation-context";
import type { AttemptFullResponse } from "@/lib/api/v2/schemas/attempts";
import { formatTime } from "@/utils/time";

import { Progress } from "@/components/ui/progress";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useUpdateChatCreatedAt } from "@/lib/api/v2/hooks/attempts";
import { useLogger } from "@/lib/api/v2/hooks/logs";
import { useRouter } from "next/navigation";
import TableRubric from "../../rubric/TableRubric";
import AttemptInput from "./AttemptInput";
import AttemptMessages from "./AttemptMessages";

export default function AttemptChat() {
  const router = useRouter();
  const simulationContext = useSimulation();
  const { effectiveProfile, activeProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const log = useLogger();
  const { mutateAsync: updateChatCreatedAt } = useUpdateChatCreatedAt();

  const [showGrades, setShowGrades] = useState(false);
  const [showDocuments, setShowDocuments] = useState(true);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
  const [inputPanelHeight, setInputPanelHeight] = useState<number>(70); // Default height in pixels

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
  const calculateChatTimeTaken = useCallback(
    (chat: AttemptFullResponse["chats"][number]["chat"] | null): number => {
      if (!chat?.completed || !chat.completedAt) return 0;

      const startTime = new Date(chat.createdAt).getTime();
      const endTime = new Date(chat.completedAt).getTime();
      const timeTakenSeconds = Math.floor((endTime - startTime) / 1000);

      return timeTakenSeconds;
    },
    []
  );

  // Helper function to calculate adjusted time limit for multi-simulation attempts
  const calculateAdjustedTimeLimit = useCallback(
    (_chat: AttemptFullResponse["chats"][number]["chat"] | null): number => {
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
    (chat: AttemptFullResponse["chats"][number]["chat"] | null): number => {
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
        } catch (error) {
          log.error("chat.timestamp.reset.failed", {
            message: "Failed to reset chat timestamp",
            subject: { entityType: "simulation_chat", entityId: chat.id },
            context: {
              component: "AttemptChat",
              function: "resetChatTimestamp",
              attemptId: simulationContext?.attemptId,
            },
            error,
          });
        }
      }
    };

    resetChatTimestamp();
  }, [
    simulationContext?.currentChat,
    isAttemptOwner,
    simulationContext?.attemptId,
    updateChatCreatedAt,
    log,
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

      // If all chats are completed, default to showing rubric
      const completedChats = simulationContext?.chats.filter(
        (chat: AttemptFullResponse["chats"][number]["chat"]) => chat.completed
      );
      if (completedChats.length === simulationContext?.chats.length) {
        setShowGrades(true);
      }
    }
  }, [
    simulationContext?.showResults,
    simulationContext?.chats,
    simulationContext?.currentChatIndex,
    simulationContext?.setCurrentChatIndex,
    simulationContext,
  ]);

  // Set default selected document
  useEffect(() => {
    if (
      simulationContext?.scenarioDocuments &&
      simulationContext?.scenarioDocuments.length > 0 &&
      !selectedDocumentId &&
      simulationContext?.scenarioDocuments[0]
    ) {
      setSelectedDocumentId(
        simulationContext?.scenarioDocuments[0].document_id
      );
    }
  }, [simulationContext?.scenarioDocuments, selectedDocumentId]);

  // Reset selected document when chat changes
  useEffect(() => {
    if (
      simulationContext?.scenarioDocuments &&
      simulationContext?.scenarioDocuments.length > 0 &&
      simulationContext?.scenarioDocuments[0]
    ) {
      setSelectedDocumentId(
        simulationContext?.scenarioDocuments[0].document_id
      );
    }
  }, [
    simulationContext?.currentChatIndex,
    simulationContext?.currentChat?.id,
    simulationContext?.scenarioDocuments,
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
          >
            <Card className="h-full flex flex-col py-4">
              <div className="h-full flex flex-col">
                {/* Timer and Controls Header - consistent with main chat layout */}
                <div className="p-4 pt-0 border-b flex flex-col gap-2">
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
                    <div className="flex items-start justify-end gap-2">
                      <div className="flex items-center gap-4">
                        {displayChat && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={showGrades ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setShowGrades(!showGrades)}
                                  className={`p-2 ${showGrades ? "bg-primary text-primary-foreground" : ""}`}
                                >
                                  <Table className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {showGrades ? "Hide Rubric" : "Show Rubric"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Documents Toggle */}
                        {simulationContext?.scenarioDocuments &&
                          simulationContext?.scenarioDocuments.length > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={
                                      showDocuments ? "default" : "outline"
                                    }
                                    size="sm"
                                    onClick={() =>
                                      setShowDocuments(!showDocuments)
                                    }
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

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                                  displayChat &&
                                  simulationContext?.allDynamicRubrics.find(
                                    (rubric) => rubric.chatId === displayChat.id
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
                                        ? simulationContext?.aggregatedResults
                                            .overallPassed
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
                                        simulationContext?.simulation?.timeLimit
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
                                        ? formatTime(infiniteLimitMinutes * 60)
                                        : formatTime(
                                            simulationContext?.timer.elapsed ||
                                              0
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
                                  {simulationContext?.aggregatedResults
                                    .overallPassed
                                    ? "Passed"
                                    : "Failed"}{" "}
                                  (
                                  {Math.round(
                                    simulationContext?.aggregatedResults
                                      .averageScore
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
                  </div>

                  {/* Show completion status for completed attempts */}
                  {!simulationContext?.isSingleChatAttempt && (
                    <div className="flex justify-end">
                      <Select
                        value={
                          simulationContext?.chats[
                            simulationContext.currentChatIndex
                          ]?.id || ""
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
                          {simulationContext?.chats?.map(
                            (
                              chat: AttemptFullResponse["chats"][number]["chat"]
                            ) => {
                              // Find rubric result for this chat
                              const rubricResult =
                                simulationContext?.allDynamicRubrics.find(
                                  (rubric) => rubric.chatId === chat.id
                                );

                              return (
                                <SelectItem key={chat.id} value={chat.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{chat.title}</span>
                                    {chat.completed && !rubricResult ? (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        Incomplete
                                      </Badge>
                                    ) : rubricResult ? (
                                      <Badge
                                        variant={
                                          rubricResult.passed
                                            ? "default"
                                            : "destructive"
                                        }
                                        className={`text-xs ${
                                          rubricResult.passed
                                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                        }`}
                                      >
                                        {rubricResult.passed ? "Pass" : "Fail"}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </SelectItem>
                              );
                            }
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

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
                              simulationContext.rubricStructure.standardsMapping
                            }
                            gradingState={
                              displayChat?.id
                                ? simulationContext.gradingStatesByChatId[
                                    displayChat.id
                                  ] || null
                                : null
                            }
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
                    <ResizableHandle className="bg-transparent" />
                    <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
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
                    <div className="p-4 pt-0 border-b flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-start gap-2">
                            <span className="font-medium">
                              {simulationContext?.scenario?.name ||
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
                                  (
                                    chat: AttemptFullResponse["chats"][number]["chat"]
                                  ) => chat.completed
                                ).length && (
                                <Badge variant="default">Completed</Badge>
                              )}
                          </div>

                          <div className="flex items-center gap-2">
                            {simulationContext?.scenarioDocuments.length >
                              0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={
                                      showDocuments ? "default" : "outline"
                                    }
                                    size="sm"
                                    onClick={() =>
                                      setShowDocuments(!showDocuments)
                                    }
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

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                                    !simulationContext?.attempt?.infiniteMode &&
                                    simulationContext?.currentChat?.completed &&
                                    simulationContext?.currentDynamicRubric &&
                                    simulationContext?.expectedChatCount ===
                                      simulationContext?.chats.filter(
                                        (
                                          chat: AttemptFullResponse["chats"][number]["chat"]
                                        ) => chat.completed
                                      ).length
                                      ? simulationContext?.currentDynamicRubric
                                          .passed
                                        ? "bg-green-100 dark:bg-green-900/30"
                                        : "bg-red-100 dark:bg-red-900/30"
                                      : "bg-muted"
                                  }`}
                                >
                                  {simulationContext?.attempt?.infiniteMode ? (
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
                                            simulationContext?.timer.remaining <
                                              0
                                          ? "text-red-500"
                                          : ""
                                    }`}
                                    data-testid="timer"
                                  >
                                    {simulationContext?.attempt?.infiniteMode
                                      ? simulationContext?.simulation?.timeLimit
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
                                          simulationContext?.timer.remaining !==
                                            null
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
                                    (
                                      chat: AttemptFullResponse["chats"][number]["chat"]
                                    ) => chat.completed
                                  ).length && (
                                  <TooltipContent>
                                    <p>
                                      {simulationContext?.currentDynamicRubric
                                        .passed
                                        ? "Passed"
                                        : "Failed"}
                                      (
                                      {
                                        simulationContext?.currentDynamicRubric
                                          .score
                                      }
                                      /
                                      {
                                        simulationContext?.currentDynamicRubric
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

                    {/* Messages Area */}
                    {/* Progress Bar at the very top */}
                    {/* Hide progress bar in infinite mode */}
                    {!simulationContext?.attempt?.infiniteMode &&
                      simulationContext?.expectedChatCount > 1 && (
                        <div className="p-0">
                          <Progress
                            value={
                              (simulationContext?.chats.filter(
                                (
                                  chat: AttemptFullResponse["chats"][number]["chat"]
                                ) => chat.completed
                              ).length /
                                simulationContext?.expectedChatCount) *
                              100
                            }
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
        {showDocuments && simulationContext?.scenarioDocuments.length > 0 && (
          <>
            <ResizableHandle className="bg-transparent" />
            <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
              <Card className="h-full flex flex-col ml-4 p-0">
                <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
                  {/* Select dropdown directly above document */}
                  {simulationContext?.scenarioDocuments.length > 1 && (
                    <div className="p-3 pb-2 border-b">
                      <DocumentSelect
                        documents={simulationContext?.scenarioDocuments}
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
                          simulationContext.scenarioDocuments.find(
                            (doc) => doc.document_id === selectedDocumentId
                          ) || simulationContext.scenarioDocuments[0];
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
        )}
      </ResizablePanelGroup>
    </div>
  );
}
