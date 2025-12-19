/**
 * GradedAttemptView.tsx
 * Read-only graded (results) view without input and optionally without documents
 * @AshokSaravanan222 & @siladiea
 * 01/30/2025
 */
"use client";

import type { AttemptFullOut } from "@/app/(main)/home/a/[attemptId]/page";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Icons
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  FileText,
  Infinity as InfinityIcon,
  ListChecks,
  Table,
} from "lucide-react";

import DocumentSelect from "@/components/common/chat/DocumentSelect";
import DocumentViewer from "@/components/common/chat/viewers/DocumentViewer";
import TableRubric from "@/components/common/rubric/TableRubric";
import { formatTime } from "@/utils/time";
import AttemptMessages from "./AttemptMessages";

// Extract types from AttemptFullOut
type ChatDataType = AttemptFullOut["chats"][number];
type Chat = ChatDataType["chat"];
type ScenarioItem = ChatDataType["scenario"];
type ScenarioDocumentItem = AttemptFullOut["scenarioDocuments"][number];
type DynamicRubric = ChatDataType["dynamicRubric"];
type RubricStructure = AttemptFullOut["rubricStructure"];
type AggregatedResults = AttemptFullOut["aggregatedResults"];
type GradingState = ChatDataType["gradingState"];

type AttemptItem = AttemptFullOut["attempt"];
type SimulationItem = AttemptFullOut["simulation"];

interface GradedAttemptViewProps {
  attemptId: string;
  attempt: AttemptItem | null;
  simulation: SimulationItem | null;
  scenario: ScenarioItem | null;
  currentChat: Chat | null;
  displayChat: Chat | null;
  chats: Chat[];
  currentChatIndex: number;
  isSingleChatAttempt: boolean;
  expectedChatCount: number;
  scenarioDocuments: ScenarioDocumentItem[];
  scenariosByChatId: Record<string, ScenarioItem | null>;
  allDynamicRubrics: DynamicRubric[];
  aggregatedResults: AggregatedResults | null;
  rubricStructure: RubricStructure | null;
  gradingStatesByChatId: Record<string, NonNullable<GradingState>>;
  timer: {
    elapsed: number;
    remaining: number | null;
    expired: boolean;
  };
  showDocuments: boolean;
  showDocumentModal: boolean;
  showObjectives: boolean;
  showObjectivesModal: boolean;
  showGrades: boolean;
  selectedDocumentId: string | null;
  currentMessages: Array<{
    id: string;
    type: string;
    content: string;
    createdAt: string;
    completed?: boolean;
    personaId?: string;
  }>;
  currentChatHints: Array<{
    messageId: string;
    hints: Array<{
      simulationMessageId: string;
      hint: string;
      idx: number;
      createdAt: string;
    }>;
  }>;
  personas?: Array<{
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  }>;
  isAttemptOwner: boolean;
  chatPicker: React.ReactNode | null;
  selectedScenario: ScenarioItem | null;
  calculateChatTimeTaken: (chat: Chat | null) => number;
  calculateAdjustedTimeLimit: (chat: Chat | null) => number;
  calculateTimeExceeded: (chat: Chat | null) => number;
  setCurrentChatIndex: (index: number) => void;
  setShowGrades: (show: boolean) => void;
  setUserHasManuallyToggledGrades: (toggled: boolean) => void;
  setShowDocuments: (show: boolean) => void;
  setShowDocumentModal: (show: boolean) => void;
  setShowObjectives: (show: boolean) => void;
  setShowObjectivesModal: (show: boolean) => void;
  setSelectedDocumentId: (id: string | null) => void;
  hideDocuments?: boolean; // For evals - hide documents panel
}

export default function GradedAttemptView({
  attemptId,
  attempt,
  simulation,
  scenario,
  currentChat,
  displayChat,
  chats,
  currentChatIndex,
  isSingleChatAttempt,
  expectedChatCount: _expectedChatCount,
  scenarioDocuments,
  scenariosByChatId,
  allDynamicRubrics,
  aggregatedResults,
  rubricStructure,
  gradingStatesByChatId,
  timer,
  showDocuments,
  showDocumentModal,
  showObjectives,
  showObjectivesModal,
  showGrades,
  selectedDocumentId,
  currentMessages,
  currentChatHints,
  personas,
  isAttemptOwner,
  chatPicker: _chatPicker,
  selectedScenario,
  calculateChatTimeTaken,
  calculateAdjustedTimeLimit,
  calculateTimeExceeded,
  setCurrentChatIndex,
  setShowGrades,
  setUserHasManuallyToggledGrades,
  setShowDocuments,
  setShowDocumentModal,
  setShowObjectives,
  setShowObjectivesModal,
  setSelectedDocumentId,
  hideDocuments = false,
}: GradedAttemptViewProps) {
  const isInfiniteMode = attempt?.infiniteMode;
  const infiniteLimitMinutes = simulation?.timeLimit ?? null;

  return (
    <div
      className="h-[calc(100vh-4rem)] flex flex-col"
      data-testid="attempt-chat-container"
      data-attempt-id={attemptId || ""}
    >
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Main Results Area */}
        <ResizablePanel
          defaultSize={
            !hideDocuments && showDocuments && scenarioDocuments.length > 0
              ? 70
              : 100
          }
          className="md:flex-none"
        >
          <Card className="h-full flex flex-col py-2 border-0 rounded-t-xl rounded-b-none">
            <div className="h-full flex flex-col">
              {/* Timer and Controls Header - consistent with main chat layout */}
              <div className="p-2 pt-0 border-b flex flex-col gap-2">
                {/* Mobile: Left-aligned vertical layout */}
                <div className="md:hidden max-h-[200px] overflow-y-auto">
                  <div className="flex flex-col gap-3 py-2">
                    {/* Row 1: Control buttons and timer - split layout */}
                    <div className="flex items-center gap-2">
                      {/* Left side: Control buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Objectives Toggle - show on mobile even in grading view */}
                        {simulation?.objectivesEnabled &&
                          (() => {
                            const currentScenario = displayChat?.id
                              ? scenariosByChatId[displayChat.id]
                              : null;
                            const hasObjectives =
                              currentScenario?.objectives &&
                              currentScenario.objectives.length > 0;
                            return hasObjectives;
                          })() && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={
                                      showObjectivesModal
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    onClick={() => setShowObjectivesModal(true)}
                                    className={`p-2 ${showObjectivesModal ? "bg-primary text-primary-foreground" : ""}`}
                                  >
                                    <ListChecks className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View Objectives</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                        {displayChat && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={showGrades ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    setShowGrades(!showGrades);
                                    setUserHasManuallyToggledGrades(true);
                                  }}
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

                        {/* Documents Toggle - hide if hideDocuments is true */}
                        {!hideDocuments &&
                          (() => {
                            const currentChatDocIds =
                              displayChat?.documentIds || [];
                            const hasDocumentsForCurrentChat =
                              scenarioDocuments?.some((doc) =>
                                currentChatDocIds.includes(doc.document_id),
                              );
                            return hasDocumentsForCurrentChat;
                          })() && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={
                                      showDocumentModal ? "default" : "outline"
                                    }
                                    size="sm"
                                    onClick={() => setShowDocumentModal(true)}
                                    className={`p-2 ${showDocumentModal ? "bg-primary text-primary-foreground" : ""}`}
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View Documents</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                      </div>

                      {/* Right side: Timer */}
                      <div className="flex-1 flex justify-end">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`flex items-center gap-2 px-3 py-1 rounded-full ${(() => {
                                  if (!displayChat) return "bg-muted";
                                  const rubric = allDynamicRubrics.find(
                                    (r) => r && r.chatId === displayChat.id,
                                  );
                                  if (rubric) {
                                    return rubric.passed
                                      ? "bg-green-100 dark:bg-green-900/30"
                                      : "bg-red-100 dark:bg-red-900/30";
                                  }
                                  if (!displayChat.completed) {
                                    return "bg-red-100 dark:bg-red-900/30";
                                  }
                                  if (aggregatedResults) {
                                    return aggregatedResults.passed
                                      ? "bg-green-100 dark:bg-green-900/30"
                                      : "bg-red-100 dark:bg-red-900/30";
                                  }
                                  return "bg-muted";
                                })()}`}
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
                                          0 && simulation?.timeLimit
                                        ? "text-red-500"
                                        : ""
                                      : ""
                                  }`}
                                  data-testid="timer"
                                >
                                  {displayChat && displayChat.completed
                                    ? formatTime(
                                        calculateChatTimeTaken(displayChat),
                                      )
                                    : isInfiniteMode
                                      ? infiniteLimitMinutes
                                        ? formatTime(infiniteLimitMinutes * 60)
                                        : formatTime(timer.elapsed || 0)
                                      : simulation?.timeLimit && displayChat
                                        ? formatTime(
                                            calculateAdjustedTimeLimit(
                                              displayChat,
                                            ),
                                          )
                                        : "No time limit"}
                                </span>
                              </div>
                            </TooltipTrigger>
                            {(() => {
                              if (!displayChat) return null;
                              const rubric = allDynamicRubrics.find(
                                (r): r is DynamicRubric =>
                                  r?.chatId === displayChat.id,
                              );
                              if (displayChat && showGrades && rubric) {
                                return (
                                  <TooltipContent>
                                    <p className="flex items-center flex-wrap gap-x-0">
                                      <span>
                                        {rubric.passed ? "Passed" : "Failed"} (
                                        {rubric.score}/
                                        {rubric.totalPossiblePoints})
                                      </span>
                                      {calculateTimeExceeded(displayChat) > 0 &&
                                        simulation?.timeLimit && (
                                          <span className="text-xs text-muted-foreground ml-2">
                                            +
                                            {formatTime(
                                              calculateTimeExceeded(
                                                displayChat,
                                              ),
                                            )}
                                          </span>
                                        )}
                                    </p>
                                  </TooltipContent>
                                );
                              }
                              if (displayChat && !displayChat.completed) {
                                return (
                                  <TooltipContent>
                                    <p>Incomplete</p>
                                  </TooltipContent>
                                );
                              }
                              if (aggregatedResults) {
                                return (
                                  <TooltipContent>
                                    <p>
                                      {aggregatedResults.passed
                                        ? "Passed"
                                        : "Failed"}{" "}
                                      ({aggregatedResults.totalScore}/
                                      {aggregatedResults.totalPossiblePoints}{" "}
                                      points)
                                    </p>
                                  </TooltipContent>
                                );
                              }
                              return null;
                            })()}
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    {/* Row 2: Scenario description */}
                    <div className="text-left text-sm md:text-base">
                      <span className="font-medium">
                        {selectedScenario?.problemStatement ||
                          scenario?.problemStatement ||
                          "Session Results"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop: Original layout preserved exactly */}
                <Collapsible
                  open={showObjectives}
                  onOpenChange={setShowObjectives}
                  className="hidden md:block"
                >
                  <div className="hidden md:flex md:flex-col md:gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-4">
                        {/* Show scenario information */}
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {selectedScenario?.problemStatement ||
                              scenario?.problemStatement ||
                              "Session Results"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {/* Buttons and timer row */}
                        <div className="flex items-center gap-2">
                          {/* Objectives Toggle - show on desktop even in grading view */}
                          {simulation?.objectivesEnabled &&
                            (() => {
                              const currentScenario = displayChat?.id
                                ? scenariosByChatId[displayChat.id]
                                : null;
                              const hasObjectives =
                                currentScenario?.objectives &&
                                currentScenario.objectives.length > 0;
                              return hasObjectives;
                            })() && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <CollapsibleTrigger asChild>
                                      <Button
                                        variant={
                                          showObjectives ? "default" : "outline"
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
                              </TooltipProvider>
                            )}

                          {displayChat && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={showGrades ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                      setShowGrades(!showGrades);
                                      setUserHasManuallyToggledGrades(true);
                                    }}
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

                          {/* Documents Toggle - hide if hideDocuments is true */}
                          {!hideDocuments &&
                            (() => {
                              const currentChatDocIds =
                                displayChat?.documentIds || [];
                              const hasDocumentsForCurrentChat =
                                scenarioDocuments?.some((doc) =>
                                  currentChatDocIds.includes(doc.document_id),
                                );
                              return hasDocumentsForCurrentChat;
                            })() && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={
                                        showDocuments || showDocumentModal
                                          ? "default"
                                          : "outline"
                                      }
                                      size="sm"
                                      onClick={() => {
                                        // Mobile: open modal, Desktop: toggle panel
                                        if (window.innerWidth < 768) {
                                          setShowDocumentModal(true);
                                        } else {
                                          setShowDocuments(!showDocuments);
                                        }
                                      }}
                                      className={`p-2 ${showDocuments || showDocumentModal ? "bg-primary text-primary-foreground" : ""}`}
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {showDocuments || showDocumentModal
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
                                  className={`flex items-center justify-center gap-2 px-3 py-1 rounded-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${(() => {
                                    if (!displayChat) return "bg-muted";
                                    const rubric = allDynamicRubrics.find(
                                      (r) => r && r.chatId === displayChat.id,
                                    );
                                    if (rubric) {
                                      return rubric.passed
                                        ? "bg-green-100 dark:bg-green-900/30"
                                        : "bg-red-100 dark:bg-red-900/30";
                                    }
                                    if (!displayChat.completed) {
                                      return "bg-red-100 dark:bg-red-900/30";
                                    }
                                    if (aggregatedResults) {
                                      return aggregatedResults.passed
                                        ? "bg-green-100 dark:bg-green-900/30"
                                        : "bg-red-100 dark:bg-red-900/30";
                                    }
                                    return "bg-muted";
                                  })()}`}
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
                                            0 && simulation?.timeLimit
                                          ? "text-red-500"
                                          : ""
                                        : ""
                                    }`}
                                    data-testid="timer"
                                  >
                                    {displayChat && displayChat.completed
                                      ? formatTime(
                                          calculateChatTimeTaken(displayChat),
                                        )
                                      : isInfiniteMode
                                        ? infiniteLimitMinutes
                                          ? formatTime(
                                              infiniteLimitMinutes * 60,
                                            )
                                          : formatTime(timer.elapsed || 0)
                                        : simulation?.timeLimit && displayChat
                                          ? formatTime(
                                              calculateAdjustedTimeLimit(
                                                displayChat,
                                              ),
                                            )
                                          : "No time limit"}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              {(() => {
                                if (!displayChat) return null;
                                const rubric = allDynamicRubrics.find(
                                  (r): r is DynamicRubric =>
                                    r?.chatId === displayChat.id,
                                );
                                if (displayChat && showGrades && rubric) {
                                  return (
                                    <TooltipContent>
                                      <p className="flex items-center flex-wrap gap-x-0">
                                        <span>
                                          {rubric.passed ? "Passed" : "Failed"}{" "}
                                          ({rubric.score}/
                                          {rubric.totalPossiblePoints})
                                        </span>
                                        {calculateTimeExceeded(displayChat) >
                                          0 &&
                                          simulation?.timeLimit && (
                                            <span className="text-xs text-muted-foreground ml-2">
                                              +
                                              {formatTime(
                                                calculateTimeExceeded(
                                                  displayChat,
                                                ),
                                              )}
                                            </span>
                                          )}
                                      </p>
                                    </TooltipContent>
                                  );
                                }
                                if (displayChat && !displayChat.completed) {
                                  return (
                                    <TooltipContent>
                                      <p>Incomplete</p>
                                    </TooltipContent>
                                  );
                                }
                                if (aggregatedResults) {
                                  return (
                                    <TooltipContent>
                                      <p>
                                        {aggregatedResults.passed
                                          ? "Passed"
                                          : "Failed"}{" "}
                                        ({aggregatedResults.totalScore}/
                                        {aggregatedResults.totalPossiblePoints}{" "}
                                        points)
                                      </p>
                                    </TooltipContent>
                                  );
                                }
                                return null;
                              })()}
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Objectives Collapsible Content - desktop graded view */}
                  {simulation?.objectivesEnabled &&
                    (() => {
                      const currentScenario = displayChat?.id
                        ? scenariosByChatId[displayChat.id]
                        : null;
                      const objectives = currentScenario?.objectives || [];
                      return objectives.length > 0;
                    })() && (
                      <CollapsibleContent className="pt-2">
                        <div className="px-4 pb-2">
                          <ul className="space-y-2 list-none">
                            {(() => {
                              const currentScenario = displayChat?.id
                                ? scenariosByChatId[displayChat.id]
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
              </div>

              <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                <ScrollArea className="flex-1 px-1 min-h-0">
                  <div className="space-y-4 py-2">
                    {/* Show rubric when toggle is on */}
                    {showGrades && displayChat && rubricStructure ? (
                      <div className="space-y-4 py-2">
                        <TableRubric
                          standardGroups={rubricStructure?.standardGroups || []}
                          standardGroupsMapping={
                            rubricStructure?.standardGroupsMapping || {}
                          }
                          standardsMapping={
                            (rubricStructure?.standardsMapping ||
                              {}) as Parameters<
                              typeof TableRubric
                            >[0]["standardsMapping"]
                          }
                          {...(displayChat?.id &&
                            gradingStatesByChatId[displayChat.id] && {
                              gradingState: gradingStatesByChatId[
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
                          {...(displayChat.id
                            ? { chatId: displayChat.id }
                            : {})}
                          isAttemptOwner={isAttemptOwner}
                          messages={currentMessages}
                          currentChat={
                            currentChat
                              ? {
                                  id: currentChat.id || "",
                                  completed: currentChat.completed,
                                }
                              : null
                          }
                          sendMessage={() => {}}
                          isSendingMessage={false}
                          isActive={false}
                          simulation={simulation}
                          currentChatHints={currentChatHints}
                          personas={personas || []}
                          scenario={
                            displayChat?.id
                              ? scenariosByChatId[displayChat.id] || null
                              : scenario
                          }
                          grade={
                            displayChat?.id
                              ? allDynamicRubrics.find(
                                  (r) => r && r.chatId === displayChat.id
                                )
                                ? { id: "graded" }
                                : null
                              : null
                          }
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

        {/* Right Panel - Documents - hide if hideDocuments is true */}
        {!hideDocuments &&
          showDocuments &&
          (() => {
            // Filter documents for current chat's scenario
            const currentChatDocIds = displayChat?.documentIds || [];
            const filteredDocs =
              scenarioDocuments.filter((doc) =>
                currentChatDocIds.includes(doc.document_id),
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
                    <Card className="h-full flex flex-col ml-2 p-0 border-0 border-l-0 shadow-none rounded-l-none">
                      <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
                        {/* Select dropdown directly above document */}
                        {filteredDocs.length > 1 && (
                          <div className="p-2 pb-1.5 border-b">
                            <DocumentSelect
                              documents={filteredDocs}
                              selectedDocumentId={selectedDocumentId}
                              onDocumentSelect={setSelectedDocumentId}
                            />
                          </div>
                        )}
                        {/* Document viewer with minimal padding */}
                        <div className="flex-1 min-h-0 px-1 py-3">
                          {selectedDocumentId &&
                            (() => {
                              const document =
                                filteredDocs.find(
                                  (doc) =>
                                    doc.document_id === selectedDocumentId,
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

      {/* Pagination Footer - Chat Navigation */}
      {!isSingleChatAttempt && chats && chats.length > 0 && (
        <div className="border-t px-4 py-3 flex items-center bg-background relative">
          {/* Left Side - First and Previous Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentChatIndex(0)}
              disabled={currentChatIndex === 0}
            >
              <span className="sr-only">Go to first chat</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentChatIndex(currentChatIndex - 1)}
              disabled={currentChatIndex === 0}
            >
              <span className="sr-only">Go to previous chat</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Spacer - flex grow to push content apart */}
          <div className="flex-1" />

          {/* Center - Current Chat Info - Badge + Name + Count */}
          <div className="flex items-center gap-2 px-4 absolute left-1/2 -translate-x-1/2">
            {(() => {
              const currentChat = chats[currentChatIndex];
              if (!currentChat) return null;

              const rubricResult = allDynamicRubrics.find(
                (rubric) => rubric && rubric.chatId === currentChat.id,
              );

              return (
                <>
                  {currentChat.completed && !rubricResult ? (
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
                  <span className="text-sm font-medium">
                    {currentChat.title || `Chat ${currentChatIndex + 1}`}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({currentChatIndex + 1} of {chats.length})
                  </span>
                </>
              );
            })()}
          </div>

          {/* Spacer - flex grow to push content apart */}
          <div className="flex-1" />

          {/* Right Side - Next and Last Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentChatIndex(currentChatIndex + 1)}
              disabled={currentChatIndex >= chats.length - 1}
            >
              <span className="sr-only">Go to next chat</span>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentChatIndex(chats.length - 1)}
              disabled={currentChatIndex >= chats.length - 1}
            >
              <span className="sr-only">Go to last chat</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Document Modal - Mobile Only - hide if hideDocuments is true */}
      {!hideDocuments && (
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
                    scenarioDocuments.filter((doc) =>
                      currentChatDocIds.includes(doc.document_id),
                    ) || [];
                  return (
                    filteredDocs.find(
                      (doc) => doc.document_id === selectedDocumentId,
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
                scenarioDocuments.filter((doc) =>
                  currentChatDocIds.includes(doc.document_id),
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
                    scenarioDocuments.filter((doc) =>
                      currentChatDocIds.includes(doc.document_id),
                    ) || [];
                  const document =
                    filteredDocs.find(
                      (doc) => doc.document_id === selectedDocumentId,
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
      )}

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
                ? scenariosByChatId[displayChat.id]
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
