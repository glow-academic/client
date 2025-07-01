/**
 * AttemptChat.tsx
 * Used to display the attempt chat. Will wrap the AttemptInput and AttemptMessages components, creating the unified look. This page will add the header, and timer, as well as toggle the TableRubric in the correct mode. The simulation-context.tsx will be the one that wraps this with the necessary functions to call webRTC and websocket events.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import { useEffect, useMemo, useState } from "react";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
  Clock,
  FileText,
  PanelRightClose,
  PanelRightOpen,
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
import DocumentViewer from "@/components/common/chat/DocumentViewer";
import { CircularProgress } from "@/components/ui/circular-progress";
import { useSimulation } from "@/contexts/simulation-context";
import { SimulationChat } from "@/types";
import { formatTime } from "@/utils/time";

import TableRubric from "../../rubric/TableRubric";
import AttemptInput from "./AttemptInput";
import AttemptMessages from "./AttemptMessages";

export default function AttemptChat() {
  const simulationContext = useSimulation();

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showGrades, setShowGrades] = useState(false);
  const [showDocuments, setShowDocuments] = useState(true);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );

  // Get selected chat for rubric display
  const selectedChat = useMemo(() => {
    if (!selectedChatId || !simulationContext?.chats) return null;
    return simulationContext?.chats.find((chat: SimulationChat) => chat.id === selectedChatId);
  }, [selectedChatId, simulationContext?.chats]);

  // Auto-select first completed chat when results show and default to showing rubric if all chats completed
  useEffect(() => {
    if (simulationContext?.showResults && simulationContext?.chats && simulationContext?.chats.length > 0 && !selectedChatId) {
      const completedChats = simulationContext?.chats.filter(
        (chat: SimulationChat) => chat.completed
      );
      if (completedChats.length > 0 && completedChats[0]) {
        setSelectedChatId(completedChats[0].id);

        // If all chats are completed, default to showing rubric
        if (completedChats.length === simulationContext?.chats.length) {
          setShowGrades(true);
        }
      }
    }
  }, [simulationContext?.showResults, simulationContext?.chats, selectedChatId]);

  // Set default selected document
  useEffect(() => {
    if (
      simulationContext?.scenarioDocuments && simulationContext?.scenarioDocuments.length > 0 &&
      !selectedDocumentId &&
      simulationContext?.scenarioDocuments[0]
    ) {
      setSelectedDocumentId(simulationContext?.scenarioDocuments[0].id);
    }
  }, [simulationContext?.scenarioDocuments, selectedDocumentId]);

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
            <Button onClick={() => (window.location.href = "/home")}>
              Return To Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show results screen
  if (simulationContext?.showResults) {
    return (
      <div className="h-[calc(100vh-4rem)]">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Main Results Area */}
          <ResizablePanel
            defaultSize={
              showDocuments && simulationContext?.scenarioDocuments.length > 0 ? 70 : 100
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
                          {simulationContext?.scenario?.description || "Session Results"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start justify-end gap-2">
                      <div className="flex items-center gap-4">
                        {selectedChat && (
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
                        {simulationContext?.scenarioDocuments && simulationContext?.scenarioDocuments.length > 0 && (
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
                                  selectedChat &&
                                  simulationContext?.allDynamicRubrics.find(
                                    (rubric) =>
                                      rubric.chatId === selectedChat.id
                                  )
                                    ? simulationContext?.allDynamicRubrics.find(
                                        (rubric) =>
                                          rubric.chatId === selectedChat.id
                                      )?.passed
                                      ? "bg-green-100 dark:bg-green-900/30"
                                      : "bg-red-100 dark:bg-red-900/30"
                                    : simulationContext?.aggregatedResults
                                      ? simulationContext?.aggregatedResults.overallPassed
                                        ? "bg-green-100 dark:bg-green-900/30"
                                        : "bg-red-100 dark:bg-red-900/30"
                                      : "bg-muted"
                                }`}
                              >
                                <Clock className="h-4 w-4" />
                                <span
                                  className="text-sm font-medium"
                                  data-testid="timer"
                                >
                                  {selectedChat &&
                                  simulationContext?.allDynamicRubrics.find(
                                    (rubric) =>
                                      rubric.chatId === selectedChat.id
                                  )?.timeTaken !== undefined
                                    ? formatTime(
                                        simulationContext?.allDynamicRubrics.find(
                                          (rubric) =>
                                            rubric.chatId === selectedChat.id
                                        )?.timeTaken ?? 0
                                      )
                                    : simulationContext?.aggregatedResults?.totalTime !== undefined
                                      ? formatTime(simulationContext?.aggregatedResults.totalTime)
                                      : "No time limit"}
                                </span>
                              </div>
                            </TooltipTrigger>
                            {selectedChat &&
                            simulationContext?.allDynamicRubrics.find(
                              (rubric) => rubric.chatId === selectedChat.id
                            ) ? (
                              <TooltipContent>
                                <p>
                                  {simulationContext?.allDynamicRubrics.find(
                                    (rubric) =>
                                      rubric.chatId === selectedChat.id
                                  )?.passed
                                    ? "Passed"
                                    : "Failed"}
                                  (
                                  {
                                    simulationContext?.allDynamicRubrics.find(
                                      (rubric) =>
                                        rubric.chatId === selectedChat.id
                                    )?.score
                                  }
                                  /
                                  {
                                    simulationContext?.allDynamicRubrics.find(
                                      (rubric) =>
                                        rubric.chatId === selectedChat.id
                                    )?.totalPossiblePoints
                                  }
                                  )
                                </p>
                              </TooltipContent>
                            ) : simulationContext?.aggregatedResults ? (
                              <TooltipContent>
                                <p>
                                  {simulationContext?.aggregatedResults.overallPassed
                                    ? "Passed"
                                    : "Failed"}
                                  ({simulationContext?.aggregatedResults.passedChats}/
                                  {simulationContext?.aggregatedResults.totalChats} chats passed)
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
                        value={selectedChatId || ""}
                        onValueChange={setSelectedChatId}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select chat to view results" />
                        </SelectTrigger>
                        <SelectContent>
                          {simulationContext?.chats
                            ?.filter((chat: SimulationChat) => chat.completed)
                            .map((chat: SimulationChat) => (
                              <SelectItem key={chat.id} value={chat.id}>
                                <div className="flex items-center gap-2">
                                  <span>{chat.title}</span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                  <ScrollArea className="flex-1 px-4 min-h-0">
                    <div className="space-y-4 py-4">
                      {/* Show rubric when toggle is on */}
                      {showGrades && selectedChat && simulationContext?.simulation?.rubricId ? (
                        <div className="space-y-4 py-4">
                          <TableRubric
                            rubricId={simulationContext?.simulation?.rubricId}
                            simulationChatId={selectedChatId || ""}
                          />
                        </div>
                      ) : selectedChat ? (
                        /* Show chat messages for both single and multi-chat attempts */
                        <div className="space-y-4">
                          <AttemptMessages
                            chatId={selectedChat.id}
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
          {showDocuments && simulationContext?.scenarioDocuments.length > 0 && (
            <>
              <ResizableHandle />
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
                      {selectedDocumentId && (
                        <DocumentViewer
                          key={selectedDocumentId}
                          document={
                            simulationContext.scenarioDocuments.find(
                              (doc) => doc.id === selectedDocumentId
                            )!
                          }
                        />
                      )}
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

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Main Chat Area */}
        <ResizablePanel
          defaultSize={showDocuments && simulationContext?.scenarioDocuments.length > 0 ? 70 : 100}
        >
          <Card className="h-full flex flex-col py-4">
            <TooltipProvider>
              <ResizablePanelGroup direction="vertical" className="h-full">
                <ResizablePanel defaultSize={88} minSize={60}>
                  <div className="h-full flex flex-col">
                    {/* Timer and Controls Header */}
                    <div className="p-4 pt-0 border-b flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-start gap-2">
                            <span className="font-medium">
                              {simulationContext?.scenario?.description || simulationContext?.currentChat?.title}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start justify-end gap-2">
                          <div className="flex items-center gap-4">
                            {simulationContext?.currentChat?.completed && (
                              <Badge variant="default">Completed</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {simulationContext?.expectedChatCount > 1 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    <CircularProgress
                                      progress={
                                        (simulationContext?.chats.filter(
                                          (chat: SimulationChat) =>
                                            chat.completed
                                        ).length /
                                          simulationContext?.expectedChatCount) *
                                        100
                                      }
                                      size={64}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {
                                      simulationContext?.chats.filter(
                                        (chat: SimulationChat) => chat.completed
                                      ).length
                                    }{" "}
                                    of {simulationContext?.expectedChatCount} chats completed
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {simulationContext?.scenarioDocuments.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setShowDocuments(!showDocuments)
                                    }
                                    className="p-2"
                                  >
                                    {showDocuments ? (
                                      <PanelRightClose className="h-4 w-4" />
                                    ) : (
                                      <PanelRightOpen className="h-4 w-4" />
                                    )}
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
                                    simulationContext?.currentChat?.completed &&
                                    simulationContext?.currentDynamicRubric
                                      ? simulationContext?.currentDynamicRubric.passed
                                        ? "bg-green-100 dark:bg-green-900/30"
                                        : "bg-red-100 dark:bg-red-900/30"
                                      : "bg-muted"
                                  }`}
                                >
                                  <Clock className="h-4 w-4" />
                                  <span
                                    className="text-sm font-medium"
                                    data-testid="timer"
                                  >
                                    {simulationContext?.simulation?.timeLimit &&
                                    simulationContext?.timer.remaining !== null
                                      ? formatTime(simulationContext?.timer.remaining)
                                      : formatTime(simulationContext?.timer.elapsed)}
                                  </span>
                                  {simulationContext?.simulation?.timeLimit && simulationContext?.timer.expired && (
                                    <span className="text-xs text-red-500 ml-1">
                                      (Expired)
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              {simulationContext?.currentChat?.completed &&
                                simulationContext?.currentDynamicRubric && (
                                  <TooltipContent>
                                    <p>
                                      {simulationContext?.currentDynamicRubric.passed
                                        ? "Passed"
                                        : "Failed"}
                                      ({simulationContext?.currentDynamicRubric.score}/
                                      {simulationContext?.currentDynamicRubric.totalPossiblePoints}
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
                    <AttemptMessages/>
                  </div>
                </ResizablePanel>

                <ResizableHandle />
                {/* Input Area */}
                <ResizablePanel defaultSize={12} minSize={10} maxSize={40}>
                  <AttemptInput />
                </ResizablePanel>
              </ResizablePanelGroup>
            </TooltipProvider>
          </Card>
        </ResizablePanel>

        {/* Right Panel - Documents */}
        {showDocuments && simulationContext?.scenarioDocuments.length > 0 && (
          <>
            <ResizableHandle />
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
                    {selectedDocumentId && (
                      <DocumentViewer
                        key={selectedDocumentId}
                        document={
                          simulationContext.scenarioDocuments.find(
                            (doc) => doc.id === selectedDocumentId
                          )!
                        }
                      />
                    )}
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
