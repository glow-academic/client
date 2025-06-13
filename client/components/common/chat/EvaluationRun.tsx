/**
 * components/common/chat/EvaluationRun.tsx
 * Evaluation component for viewing evaluation runs and AI vs AI conversations. Shoudl ideally receive messages fresh, whether that be polling or websockets.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";

import React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// UI Components
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Icons
import { Play, ChevronDown, Clock } from "lucide-react";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import DocumentViewer from "@/components/common/chat/DocumentViewer";
import Markdown from "@/components/common/chat/Markdown";
import TableRubric from "@/components/common/rubric/TableRubric";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getEval } from "@/utils/queries/evals/get-eval";
import { getEvalRun } from "@/utils/queries/eval_runs/get-eval-run";
import { getEvalChatsByEvalRun } from "@/utils/queries/eval_chats/get-eval-chats-by-evalrun";
import { getEvalMessagesByChat } from "@/utils/queries/eval_messages/get-eval-messages-by-chat";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getEvalChatGradesByEvalChats } from "@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-evalchats";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getAgent } from "@/utils/queries/agents/get-agent";
import { EvalChat, EvalMessage, Document } from "@/types";

// Simple rubric interface for timer tooltip
interface SimpleRubric {
  score: number;
  passed: boolean;
  timeTaken: number;
  totalPossiblePoints: number;
}

export default function EvaluationRun({ runId }: { runId: string }) {
  const queryClient = useQueryClient();

  // State for chat selection and evaluation running
  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [aiConversationData, setAiConversationData] = useState<any[]>([]);
  const [showGrades, setShowGrades] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [runStatus, setRunStatus] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fetch eval run data
  const {
    data: evalRun,
    isLoading: isLoadingEvalRun,
    error: evalRunError,
  } = useQuery({
    queryKey: ["evalRun", runId],
    queryFn: () => getEvalRun(runId),
    enabled: !!runId,
  });

  // Fetch eval data for this run
  const {
    data: evaluation,
    isLoading: isLoadingEvaluation,
  } = useQuery({
    queryKey: ["eval", evalRun?.evalId],
    queryFn: () => getEval(evalRun!.evalId),
    enabled: !!evalRun?.evalId,
  });

  // Fetch chats for this eval run with polling when running
  const { 
    data: chats, 
    isLoading: isLoadingChats 
  } = useQuery({
    queryKey: ["evalChats", evalRun?.id],
    queryFn: () => getEvalChatsByEvalRun(evalRun!.id),
    enabled: !!evalRun?.id,
    refetchInterval: isRunningEval ? 2000 : false, // Poll every 2 seconds when running
  });

  // Poll for run status when evaluation is running
  useEffect(() => {
    if (isRunningEval && evalRun?.id) {
      const pollStatus = async () => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/evals/run/${evalRun.id}/status`);
          if (response.ok) {
            const status = await response.json();
            setRunStatus(status);
            
            // Check if all chats are completed
            if (status.completed_chats === status.total_chats && status.total_chats > 0) {
              setIsRunningEval(false);
              toast.success("All evaluations completed!");
            }
          }
        } catch (error) {
          console.error("Error polling status:", error);
        }
      };

      // Poll immediately and then every 3 seconds
      pollStatus();
      pollingIntervalRef.current = setInterval(pollStatus, 3000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isRunningEval, evalRun?.id]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Determine current chat based on index
  const currentChat = useMemo(() => {
    if (!chats || !chats.length || !evaluation?.scenarioIds) return chats?.[0];

    // Find the chat that matches the current scenario ID
    const currentScenarioId = evaluation.scenarioIds[currentChatIndex];
    const chat = chats.find(chat => chat.scenarioId === currentScenarioId);
    return chat || chats[0];
  }, [chats, evaluation?.scenarioIds, currentChatIndex]);

  // Fetch agents for base agent and response agent
  const { data: baseAgent, isLoading: baseAgentLoading } = useQuery({
    queryKey: ["agent", evaluation?.baseAgentId],
    queryFn: () => getAgent(evaluation!.baseAgentId),
    enabled: !!evaluation?.baseAgentId,
  });

  const { data: responseAgent, isLoading: responseAgentLoading } = useQuery({
    queryKey: ["agent", evalRun?.agentId],
    queryFn: () => getAgent(evalRun!.agentId),
    enabled: !!evalRun?.agentId,
  });

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics", evalRun?.rubricId],
    queryFn: () => getAllRubrics(),
    enabled: !!evalRun?.rubricId,
  });

  const { data: standardGroups, isLoading: isLoadingStandardGroups } = useQuery({
    queryKey: ["standardGroups", rubrics?.map(rubric => rubric.id)],
    queryFn: () => getStandardGroupsByRubrics(rubrics!.map(rubric => rubric.id)),
    enabled: !!rubrics && rubrics.length > 0,
  });

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map(group => group.id)],
    queryFn: () => getStandardsByStandardGroups(standardGroups!.map(group => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  // Get grades for chats
  const { data: grades, isLoading: isLoadingGrades } = useQuery({
    queryKey: ["evalGrades", chats?.map(chat => chat.id)],
    queryFn: () => getEvalChatGradesByEvalChats(chats!.map(chat => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Fetch documents that might be relevant
  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
  });

  // Filter documents for the current eval's class (if any were referenced in scenarios)
  const classDocuments = useMemo(() => {
    if (!documents) return [];
    const relevantDocs = documents.filter(() => true); 
    return relevantDocs;
  }, [documents, evaluation]);

  // Auto-select first completed chat when results show and default to showing rubric if all chats completed
  useEffect(() => {
    if (chats && chats.length > 0 && !selectedChatId) {
      const completedChats = chats.filter((chat: EvalChat) => chat.completed);
      if (completedChats.length > 0 && completedChats[0]) {
        setSelectedChatId(completedChats[0].id);

        // If current chat is completed, default to showing rubric
        if (currentChat?.completed) {
          setShowGrades(true);
        }
      }
    }
  }, [chats, selectedChatId, currentChat?.completed]);

  // Get selected chat for rubric display
  const selectedChat = useMemo(() => {
    if (!selectedChatId || !chats) return currentChat;
    return chats.find((chat: EvalChat) => chat.id === selectedChatId) || currentChat;
  }, [selectedChatId, chats, currentChat]);

  // Get basic rubric info for timer tooltip
  const selectedChatGrade = useMemo(() => {
    if (!selectedChat?.id || !grades) return null;
    return grades.find(grade => grade.evalChatId === selectedChat.id);
  }, [selectedChat?.id, grades]);

  const selectedDynamicRubric: SimpleRubric | null = useMemo(() => {
    if (!selectedChatGrade || !standards || !standardGroups) return null;
    
    // Calculate total possible points
    let totalPossiblePoints = 0;
    standardGroups.forEach(group => {
      const groupStandards = standards.filter(s => s.standardGroupId === group.id);
      if (groupStandards.length > 0) {
        totalPossiblePoints += Math.max(...groupStandards.map(s => s.points));
      }
    });

    const passed = selectedChatGrade.score >= totalPossiblePoints * 0.7;

    return {
      score: selectedChatGrade.score,
      passed,
      timeTaken: selectedChatGrade.timeTaken,
      totalPossiblePoints,
    };
  }, [selectedChatGrade, standards, standardGroups]);

  // Fetch messages for selected chat with polling when running
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["evalMessages", selectedChat?.id],
    queryFn: () => getEvalMessagesByChat(selectedChat!.id),
    enabled: !!selectedChat?.id,
    refetchInterval: isRunningEval ? 1000 : false, // Poll every second when running
  });

  // Fetch scenario for selected chat
  const { data: scenario, isLoading: scenarioLoading } = useQuery({
    queryKey: ["scenario", selectedChat?.scenarioId],
    queryFn: () => getScenario(selectedChat!.scenarioId),
    enabled: !!selectedChat?.scenarioId,
  });



  // Auto-select first incomplete chat when data loads
  useEffect(() => {
    if (chats && chats.length > 0 && evaluation?.scenarioIds && currentChatIndex === 0) {
      // Find the first incomplete chat
      const firstIncompleteIndex = evaluation.scenarioIds.findIndex(
        (scenarioId: string) => {
          const chat = chats.find(
            (c: EvalChat) => c.scenarioId === scenarioId
          );
          return chat && !chat.completed;
        },
      );

      // If we found an incomplete chat, set the index to it
      if (firstIncompleteIndex !== -1 && firstIncompleteIndex !== currentChatIndex) {
        setCurrentChatIndex(firstIncompleteIndex);
      }
    }
  }, [chats, evaluation?.scenarioIds, currentChatIndex]);

  // Check if current chat is completed and move to next
  useEffect(() => {
    if (currentChat?.completed && !isRunningEval) {
      // Only auto-advance if this chat was freshly completed in this session
      const isFreshlyCompleted = true;

      if (isFreshlyCompleted) {
        if (currentChatIndex < (evaluation?.scenarioIds?.length || 0) - 1) {
          // Move to next chat after a short delay
          const timer = setTimeout(() => {
            setCurrentChatIndex((prev) => {
              const nextIndex = prev + 1;
              toast.success(
                `Moving to chat ${nextIndex + 1} of ${evaluation?.scenarioIds?.length || 0}`
              );
              return nextIndex;
            });
          }, 2000);
          return () => clearTimeout(timer);
        }
      }
    }
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [
    currentChat?.completed,
    currentChat?.id,
    currentChatIndex,
    evaluation?.scenarioIds?.length,
    isRunningEval,
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (aiConversationData.length > 0 || messages.length > 0) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [aiConversationData.length, messages.length]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom && messages.length > 0);
  };

  // Format time function for displaying time values
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const LoadingDots = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );

  // Function to start evaluation run
  const startEvaluationRun = async () => {
    if (!evalRun?.id) return;

    setIsRunningEval(true);
    setAiConversationData([]);

    try {
      const formData = new FormData();
      formData.append('eval_run_id', evalRun.id);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/evals/run`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      toast.success("Evaluation started successfully");

      // Process the streaming response
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.done) {
                setIsRunningEval(false);
                toast.success("Evaluation completed successfully");
                // Invalidate queries to refresh data
                queryClient.invalidateQueries({ queryKey: ["evalChats"] });
                queryClient.invalidateQueries({ queryKey: ["evalMessages"] });
                break;
              }
              
              if (data.type === 'error') {
                toast.error(`Error: ${data.error}`);
                setIsRunningEval(false);
                break;
              }
              
              // Add streaming data to conversation
              setAiConversationData(prev => [...prev, {
                type: data.type,
                message: data.message || data.token || '',
                chat_id: data.chat_id,
                chat_index: data.chat_index,
                timestamp: new Date().toISOString(),
                ...data
              }]);
              
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error running evaluation:', error);
      toast.error(`Failed to run evaluation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsRunningEval(false);
    }
  };

  // Check if we have loading state
  if (isLoadingEvalRun || isLoadingEvaluation || isLoadingChats || isLoadingRubrics || isLoadingStandardGroups || isLoadingStandards || isLoadingGrades || baseAgentLoading || responseAgentLoading || scenarioLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  // Error state
  if (evalRunError || !evalRun || !evaluation) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Evaluation Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The evaluation you're looking for doesn't exist or has no eval
              runs configured.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main render
  return (
    <div className="flex h-screen gap-4 p-4">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col min-h-0">
          {/* Header with scenario info and navigation */}
          <div className="p-4 pt-0 border-b flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {/* Show scenario information */}
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {scenario?.description || currentChat?.title || "AI Evaluation"}
                  </span>
                </div>
              </div>
              <div className="flex items-end justify-end flex-col gap-2">
                <div className="flex items-center gap-4">
                  {/* Show Rubric Toggle */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor="show-grades" className="text-sm">
                      Show Rubric
                    </Label>
                    <Switch
                      id="show-grades"
                      checked={showGrades}
                      onCheckedChange={setShowGrades}
                    />
                  </div>
                  
                  {/* Timer with Pass/Fail Status */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                          selectedDynamicRubric
                            ? selectedDynamicRubric.passed
                              ? "bg-green-100 dark:bg-green-900/30"
                              : "bg-red-100 dark:bg-red-900/30"
                            : "bg-muted"
                        }`}>
                          <Clock className="h-4 w-4" />
                          <span className="text-sm font-medium" data-testid="timer">
                            {selectedDynamicRubric?.timeTaken !== undefined
                              ? formatTime(selectedDynamicRubric.timeTaken)
                              : formatTime(0)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      {selectedDynamicRubric && (
                        <TooltipContent>
                          <p>
                            {selectedDynamicRubric.passed ? "Passed" : "Failed"} 
                            ({selectedDynamicRubric.score}/{selectedDynamicRubric.totalPossiblePoints})
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Chat Selection Dropdown */}
                <Select
                  value={selectedChatId || currentChat?.id || ""}
                  onValueChange={(value) => {
                    setSelectedChatId(value);
                    // Update current chat index to match selected chat
                    const chatIndex = evaluation.scenarioIds.findIndex((scenarioId: string) => {
                      const chat = chats?.find((c: EvalChat) => c.scenarioId === scenarioId);
                      return chat?.id === value;
                    });
                    if (chatIndex !== -1) {
                      setCurrentChatIndex(chatIndex);
                    }
                  }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select chat to view" />
                  </SelectTrigger>
                  <SelectContent>
                    {chats?.map((chat: EvalChat, index: number) => (
                      <SelectItem key={chat.id} value={chat.id}>
                        <span>Chat {index + 1}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <CardContent className="flex-1 flex flex-col p-0 min-h-0 relative">
            <ScrollArea
              className="flex-1 px-4 min-h-0"
              ref={scrollAreaRef}
              onScrollCapture={handleScroll}
            >
              <div className="space-y-4 py-4">
                {messagesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ))}
                  </div>
                ) : showGrades && selectedChat?.completed && evalRun?.rubricId ? (
                  <TableRubric
                    rubricId={evalRun.rubricId}
                    evaluationChatId={selectedChat.id}
                  />
                ) : (
                  <>
                    {/* Show completed chat messages */}
                    {selectedChat?.completed && messages.length > 0 ? (
                      <>
                        {messages.map((message: EvalMessage) => (
                          <div key={message.id} className="space-y-4">
                            {/* Query Message (Type = query) */}
                            {message.type === "query" && (
                              <div className="flex justify-end">
                                <div className="max-w-[80%] bg-blue-100 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 rounded-lg p-3">
                                  <div className="text-xs font-medium mb-1">
                                    {baseAgent?.name || "Query Agent"}
                                  </div>
                                  <Markdown>{message.content}</Markdown>
                                </div>
                              </div>
                            )}

                            {/* Response Message (Type = response) */}
                            {message.type === "response" && (
                              <div className="flex justify-start">
                                <div className="max-w-[80%] bg-green-100 dark:bg-green-900/20 text-green-900 dark:text-green-100 rounded-lg p-3">
                                  <div className="text-xs font-medium mb-1">
                                    {responseAgent?.name || "Response Agent"}
                                  </div>
                                  <Markdown>{message.content}</Markdown>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    ) : null}

                    {/* Show live AI conversation if running */}
                    {isRunningEval &&
                      aiConversationData.map((item, index) => {
                        if (item.type === "parallel_info") {
                          return (
                            <div
                              key={index}
                              className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 text-center"
                            >
                              <div className="text-blue-800 dark:text-blue-200 font-medium">
                                🚀 {item.message}
                              </div>
                            </div>
                          );
                        }

                        if (item.type === "chat_info") {
                          return (
                            <div
                              key={index}
                              className="bg-gray-50 dark:bg-gray-900/20 p-2 rounded border border-gray-200 dark:border-gray-800"
                            >
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                ✅ {item.message}
                              </div>
                            </div>
                          );
                        }

                        if (item.type === "all_complete") {
                          return (
                            <div
                              key={index}
                              className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800 mt-6"
                            >
                              <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3 text-lg">
                                🎉 All Evaluations Complete
                              </h4>
                              <div className="bg-white dark:bg-green-950/30 p-4 rounded border border-green-300 dark:border-green-700">
                                <div className="text-sm text-green-700 dark:text-green-300">
                                  {item.message}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (item.type === "evaluation") {
                          return (
                            <div
                              key={index}
                              className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border border-yellow-200 dark:border-yellow-800 mt-6"
                            >
                              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3 text-lg">
                                🎯 Evaluation Complete
                              </h4>
                              <div className="bg-white dark:bg-yellow-950/30 p-4 rounded border border-yellow-300 dark:border-yellow-700">
                                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                                  Evaluation completed successfully. Grade ID:{" "}
                                  {item.evalGradeId}
                                  {item.chatId && (
                                    <span className="block mt-1">
                                      Chat: {item.chatId.slice(0, 8)}...
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (item.type === "message" || item.type === "streaming") {
                          const isBaseAgent = item.speaker === baseAgent?.name;
                          return (
                            <div key={index} className="space-y-2">
                              <div
                                className={`flex ${isBaseAgent ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[80%] p-3 rounded-lg ${
                                    isBaseAgent
                                      ? "bg-blue-100 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100"
                                      : "bg-green-100 dark:bg-green-900/20 text-green-900 dark:text-green-100"
                                  }`}
                                >
                                  <div className="text-xs font-medium mb-1">
                                    {item.speaker}{" "}
                                    {item.turn && `(Turn ${item.turn})`}
                                    {item.chatIndex !== undefined && (
                                      <span className="text-muted-foreground">
                                        {" "}
                                        - Chat {item.chatIndex + 1}
                                      </span>
                                    )}
                                  </div>
                                  {item.type === "streaming" ? (
                                    <div className="flex items-center">
                                      <span>{item.response}</span>
                                      <LoadingDots />
                                    </div>
                                  ) : (
                                    <Markdown>{item.message}</Markdown>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}

                    {/* Loading state for new evaluation */}
                    {isRunningEval && aiConversationData.length === 0 && (
                      <div className="text-center py-8">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-muted-foreground">
                          Starting AI evaluation...
                        </p>
                      </div>
                    )}

                    {/* No content state */}
                    {!selectedChat?.completed && !isRunningEval && messages.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          Click "Run Evaluation" to start this chat.
                        </p>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Scroll to bottom button */}
            {showScrollButton && (
              <div className="absolute bottom-4 right-8 z-10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrollToBottom}
                  className="rounded-full h-10 w-10 p-0 shadow-lg"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>

          {isRunningEval && <CardFooter className="flex-shrink-0 p-4 border-t">
            <div className="w-full flex justify-between items-center">
              <div className="flex items-center gap-4">
                {/* Run Evaluation Button */}
                {!isRunningEval && !currentChat?.completed && (
                  <Button
                    onClick={startEvaluationRun}
                    variant="default"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Run Evaluation
                  </Button>
                )}
                
                {/* Running Status */}
                {isRunningEval && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Running evaluation...
                    {runStatus && (
                      <span>
                        ({runStatus.completed_chats}/{runStatus.total_chats} chats completed)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardFooter>}
        </Card>
      </div>

      {/* Right Panel - Documents */}
      {classDocuments.length > 0 && (
        <div className="w-80 flex-shrink-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <div className="p-4 space-y-4">
                  {classDocuments.map((doc: Document) => (
                    <DocumentViewer key={doc.id} document={doc} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
