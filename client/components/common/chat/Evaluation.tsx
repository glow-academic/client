/**
 * components/common/chat/Evaluation.tsx
 * Evaluation component for viewing evaluation runs and AI vs AI conversations.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";

import React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Icons
import { Users, CheckCircle, Activity, Play, RotateCcw } from "lucide-react";

import DocumentViewer from "@/components/common/chat/DocumentViewer";
import Markdown from "@/components/common/chat/Markdown";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getEval } from "@/utils/queries/evals/get-eval";
import { getEvalRunsByEval } from "@/utils/queries/eval_runs/get-eval-runs-by-eval";
import { getEvalChatsByEvalRuns } from "@/utils/queries/eval_chats/get-eval-chats-by-evalruns";
import { getEvalMessagesByChat } from "@/utils/queries/eval_messages/get-eval-messages-by-chat";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getEvalChatGradesByEvalChats } from "@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-evalchats";
import { getEvalChatFeedbacksByEvalChatGrades } from "@/utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-evalchatgrades";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getAgent } from "@/utils/queries/agents/get-agent";
import { Document, EvalRun, EvalMessage, Scenario } from "@/types";

// Dynamic rubric interface based on grades/feedback
interface DynamicRubric {
  chatId: string;
  score: number;
  passed: boolean;
  timeTaken: number;
  skillScores: Record<string, number>;
  skillFeedbacks: Record<string, string>;
  totalPossiblePoints: number;
}

interface EvaluationMessage {
  id: string;
  query: string;
  response: string;
  createdAt: string;
  chatId: string;
  completed: boolean;
  sender?: string;
  messageNumber?: number;
}

export default function EvaluationPage({
  evaluationId,
}: {
  evaluationId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State for eval run selection and AI conversation
  const [selectedEvalRunId, setSelectedEvalRunId] = useState<string | null>(
    null,
  );
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [aiConversationData, setAiConversationData] = useState<any[]>([]);
  const [aiConversationComplete, setAiConversationComplete] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch eval data
  const {
    data: evaluation,
    isLoading: evaluationLoading,
    error: evaluationError,
  } = useQuery({
    queryKey: ["evaluation", evaluationId],
    queryFn: () => getEval(evaluationId),
    enabled: !!evaluationId,
  });

  const {
    data: evalRuns,
    isLoading: evalRunLoading,
    error: evalRunError,
  } = useQuery({
    queryKey: ["evalRuns", evaluationId],
    queryFn: () => getEvalRunsByEval(evaluationId),
    enabled: !!evaluationId,
  });

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["evalChats", evalRuns?.map((evalRun) => evalRun.id)],
    queryFn: () =>
      getEvalChatsByEvalRuns(evalRuns!.map((evalRun) => evalRun.id)),
    enabled: !!evalRuns && evalRuns.length > 0,
  });

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups, isLoading: isLoadingStandardGroups } = useQuery(
    {
      queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
      queryFn: () =>
        getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
      enabled: !!rubrics && rubrics.length > 0,
    },
  );

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: grades, isLoading: isLoadingGrades } = useQuery({
    queryKey: ["evalGrades", chats?.map((chat) => chat.id)],
    queryFn: () => getEvalChatGradesByEvalChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: feedbacks, isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["evalFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getEvalChatFeedbacksByEvalChatGrades(grades!.map((grade) => grade.id)),
    enabled: !!grades && grades.length > 0,
  });

  // Get current eval run and its chat
  const currentEvalRun = useMemo(() => {
    if (!selectedEvalRunId || !evalRuns) return null;
    return evalRuns.find((run) => run.id === selectedEvalRunId);
  }, [selectedEvalRunId, evalRuns]);

  const currentChat = useMemo(() => {
    if (!currentEvalRun || !chats) return null;
    return chats.find((chat) => chat.evalRunId === currentEvalRun.id);
  }, [currentEvalRun, chats]);

  // Fetch messages for current chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["evalMessages", currentChat?.id],
    queryFn: () => getEvalMessagesByChat(currentChat!.id),
    enabled: !!currentChat?.id,
  });

  // Fetch scenario and agents for current eval run
  const { data: scenario, isLoading: scenarioLoading } = useQuery({
    queryKey: ["scenario", currentEvalRun?.scenarioId],
    queryFn: () => getScenario(currentEvalRun!.scenarioId),
    enabled: !!currentEvalRun?.scenarioId,
  });

  const { data: queryAgent, isLoading: queryAgentLoading } = useQuery({
    queryKey: ["agent", evaluation?.baseAgentId],
    queryFn: () => getAgent(evaluation!.baseAgentId),
    enabled: !!evaluation?.baseAgentId,
  });

  const { data: responseAgent, isLoading: responseAgentLoading } = useQuery({
    queryKey: ["agent", currentEvalRun?.agentId],
    queryFn: () => getAgent(currentEvalRun!.agentId),
    enabled: !!currentEvalRun?.agentId,
  });

  // Create dynamic rubric for current chat
  const currentDynamicRubric = useMemo((): DynamicRubric | null => {
    if (
      !currentChat?.id ||
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups
    )
      return null;

    const chatGrade = grades.find(
      (grade) => grade.evalChatId === currentChat.id,
    );
    if (!chatGrade) return null;

    const chatFeedbacks = feedbacks.filter(
      (feedback) => feedback.evalChatGradeId === chatGrade.id,
    );

    // Calculate skill scores and feedbacks
    const skillScores: Record<string, number> = {};
    const skillFeedbacks: Record<string, string> = {};
    let totalPossiblePoints = 0;

    standardGroups.forEach((group) => {
      const groupStandards = standards.filter(
        (s) => s.standardGroupId === group.id,
      );
      const groupFeedbacks = chatFeedbacks.filter((f) =>
        groupStandards.some((s) => s.id === f.standardId),
      );

      if (groupFeedbacks.length > 0) {
        const maxPoints = Math.max(...groupStandards.map((s) => s.points));
        const avgScore =
          groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
          groupFeedbacks.length;
        const normalizedScore = Math.round((avgScore / maxPoints) * 5); // Convert to 1-5 scale

        skillScores[group.name] = normalizedScore;
        skillFeedbacks[group.name] = groupFeedbacks
          .map((f) => f.feedback)
          .join("; ");
        totalPossiblePoints += maxPoints;
      }
    });

    // Calculate if passed (assuming 70% threshold)
    const passed = chatGrade.score >= totalPossiblePoints * 0.7;

    return {
      chatId: currentChat.id,
      score: chatGrade.score,
      passed,
      timeTaken: chatGrade.timeTaken,
      skillScores,
      skillFeedbacks,
      totalPossiblePoints,
    };
  }, [currentChat?.id, grades, feedbacks, standards, standardGroups]);

  // Fetch documents for the evaluation class
  const { data: documents = [] } = useQuery({
    queryKey: ["documents", evaluation?.classId],
    queryFn: () => getAllDocuments(),
    enabled: !!evaluation?.classId,
  });

  // Filter documents for the current evaluation's class
  const classDocuments = useMemo(() => {
    if (!evaluation?.classId || !documents) return [];
    return documents.filter(
      (doc: Document) => doc.classId === evaluation.classId,
    );
  }, [documents, evaluation?.classId]);

  // Auto-select first eval run when data loads
  useEffect(() => {
    if (evalRuns && evalRuns.length > 0 && !selectedEvalRunId) {
      setSelectedEvalRunId(evalRuns[0].id);
    }
  }, [evalRuns, selectedEvalRunId]);

  // Helper function to format scenario attributes
  const formatScenarioInfo = (scenario: Scenario) => {
    const crowdednessText =
      scenario.crowdedness === 1
        ? "Low crowdedness"
        : scenario.crowdedness === 2
          ? "Moderate crowdedness"
          : scenario.crowdedness === 3
            ? "High crowdedness"
            : scenario.crowdedness === 4
              ? "Very high crowdedness"
              : scenario.crowdedness === 5
                ? "Extremely crowded"
                : `Crowdedness: ${scenario.crowdedness}`;

    const intensityText =
      scenario.intensity === 1
        ? "Low intensity"
        : scenario.intensity === 2
          ? "Moderate intensity"
          : scenario.intensity === 3
            ? "High intensity"
            : scenario.intensity === 4
              ? "Very high intensity"
              : scenario.intensity === 5
                ? "Extremely intense"
                : `Intensity: ${scenario.intensity}`;

    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>{crowdednessText}</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          <span>{intensityText}</span>
        </div>
      </div>
    );
  };

  // Run evaluation for selected eval run
  const handleRunEvaluation = async () => {
    if (!currentEvalRun) return;

    setIsRunningEval(true);
    setAiConversationData([]);
    setAiConversationComplete(false);

    try {
      const formData = new FormData();
      formData.append("eval_run_id", currentEvalRun.id);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/evals/run`,
        {
          method: "POST",
          headers: { Accept: "text/event-stream" },
          cache: "no-cache",
          body: formData,
        },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop()!;

        for (const part of parts) {
          if (!part.startsWith("data:")) continue;

          const data = JSON.parse(part.slice(5));

          if (data.type === "turn_start") {
            setAiConversationData((prev) => [
              ...prev,
              {
                type: "turn_start",
                turn: data.turn,
                speaker: data.speaker,
                message: data.message,
              },
            ]);
          }

          if (data.type === "token") {
            setAiConversationData((prev) => {
              const newData = [...prev];
              const lastItem = newData[newData.length - 1];

              if (
                lastItem &&
                lastItem.type === "streaming" &&
                lastItem.speaker === data.speaker
              ) {
                lastItem.response += data.token;
              } else {
                newData.push({
                  type: "streaming",
                  speaker: data.speaker,
                  response: data.token,
                });
              }

              return newData;
            });
          }

          if (data.type === "turn_complete") {
            setAiConversationData((prev) => {
              const newData = [...prev];
              const lastStreamingIndex = newData.findLastIndex(
                (item) =>
                  item.type === "streaming" && item.speaker === data.speaker,
              );

              if (lastStreamingIndex !== -1) {
                newData[lastStreamingIndex] = {
                  type: "message",
                  speaker: data.speaker,
                  message: newData[lastStreamingIndex].response,
                  turn: data.turn,
                };
              }

              return newData;
            });
          }

          if (data.type === "evaluation_complete") {
            setAiConversationData((prev) => [
              ...prev,
              {
                type: "evaluation",
                evalGradeId: data.eval_grade_id,
              },
            ]);
            setAiConversationComplete(true);

            // Invalidate queries to refresh data
            queryClient.invalidateQueries({ queryKey: ["evalChats"] });
            queryClient.invalidateQueries({ queryKey: ["evalGrades"] });
            queryClient.invalidateQueries({ queryKey: ["evalFeedbacks"] });
          }

          if (data.type === "done") {
            setAiConversationComplete(true);
          }
        }
      }
    } catch (error) {
      console.error("Error running evaluation:", error);
      toast.error("Failed to run evaluation");
    } finally {
      setIsRunningEval(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (aiConversationData.length > 0 || messages.length > 0) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [aiConversationData.length, messages.length]);

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

  if (evaluationLoading || evalRunLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (evaluationError || !evaluation || !evalRuns || evalRuns.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Evaluation Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The evaluation you're looking for doesn't exist or has no eval
              runs configured.
            </p>
            <Button onClick={() => router.push("/dashboard/evaluations")}>
              Return To Evaluations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show results screen if current chat is completed
  if (currentChat?.completedAt && currentDynamicRubric && !isRunningEval) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div
          className="max-w-4xl mx-auto space-y-6"
          data-testid="evaluation-results"
        >
          {/* Eval Run Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Evaluation Results</span>
                <Select
                  value={selectedEvalRunId || ""}
                  onValueChange={setSelectedEvalRunId}
                >
                  <SelectTrigger className="w-80">
                    <SelectValue placeholder="Select eval run" />
                  </SelectTrigger>
                  <SelectContent>
                    {evalRuns.map((run: EvalRun) => (
                      <SelectItem key={run.id} value={run.id}>
                        <div className="flex items-center gap-2">
                          <span>Run {evalRuns.indexOf(run) + 1}</span>
                          <span className="text-muted-foreground">
                            ({queryAgent?.name} vs {responseAgent?.name})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Detailed Results */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {currentDynamicRubric.score}/
                    {currentDynamicRubric.totalPossiblePoints}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Overall Score
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {Math.round(currentDynamicRubric.timeTaken / 60)}
                  </div>
                  <div className="text-sm text-muted-foreground">Minutes</div>
                </div>
                {Object.entries(currentDynamicRubric.skillScores)
                  .slice(0, 2)
                  .map(([skillName, score]) => (
                    <div key={skillName} className="text-center">
                      <div className="text-2xl font-bold">{score}/5</div>
                      <div className="text-sm text-muted-foreground">
                        {skillName}
                      </div>
                    </div>
                  ))}
              </div>

              <div className="space-y-3">
                {Object.entries(currentDynamicRubric.skillFeedbacks).map(
                  ([skillName, feedback]) => (
                    <div key={skillName}>
                      <h4 className="font-medium">{skillName} Feedback</h4>
                      <p className="text-sm text-muted-foreground">
                        {feedback}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={() => setShowResults(false)}>
              View Conversation
            </Button>
            <Button
              variant="outline"
              onClick={handleRunEvaluation}
              disabled={isRunningEval}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Re-run Evaluation
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 gap-4">
      {/* Main Chat Area */}
      <div className="flex-1">
        <Card className="h-full flex flex-col">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="flex items-center justify-between">
              <div>
                <span>
                  {scenario?.description ||
                    currentChat?.title ||
                    "AI vs AI Evaluation"}
                </span>
                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <Users className="h-4 w-4" />
                  <span>
                    {queryAgent?.name || "Agent 1"} vs{" "}
                    {responseAgent?.name || "Agent 2"}
                  </span>
                  {scenario && (
                    <>
                      <span>•</span>
                      {formatScenarioInfo(scenario)}
                    </>
                  )}
                </div>
              </div>
              {currentChat?.completedAt && (
                <Badge variant="default">Completed</Badge>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            {/* Eval Run Selector */}
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center gap-4">
                <Select
                  value={selectedEvalRunId || ""}
                  onValueChange={setSelectedEvalRunId}
                >
                  <SelectTrigger className="w-80">
                    <SelectValue placeholder="Select eval run to view" />
                  </SelectTrigger>
                  <SelectContent>
                    {evalRuns.map((run: EvalRun, index: number) => {
                      const runChat = chats?.find(
                        (chat) => chat.evalRunId === run.id,
                      );
                      return (
                        <SelectItem key={run.id} value={run.id}>
                          <div className="flex items-center gap-2">
                            <span>Run {index + 1}</span>
                            {runChat?.completedAt && (
                              <Badge variant="outline" className="text-xs">
                                Completed
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {!currentChat?.completedAt && (
                  <Button
                    onClick={handleRunEvaluation}
                    disabled={isRunningEval || !currentEvalRun}
                    size="sm"
                  >
                    {isRunningEval ? (
                      <>
                        <LoadingDots />
                        <span className="ml-2">Running...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run Evaluation
                      </>
                    )}
                  </Button>
                )}

                {currentChat?.completedAt && (
                  <Button
                    onClick={() => setShowResults(true)}
                    size="sm"
                    variant="outline"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    View Results
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
              <div className="space-y-4 py-4">
                {/* Show existing messages if chat is completed */}
                {currentChat?.completedAt && messages.length > 0 && (
                  <>
                    {messages.map((message: EvalMessage) => (
                      <div key={message.id} className="space-y-4">
                        {/* Query Message */}
                        {message.query && (
                          <div className="flex justify-end">
                            <div className="max-w-[80%] bg-blue-100 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 rounded-lg p-3">
                              <div className="text-xs font-medium mb-1">
                                {queryAgent?.name || "Query Agent"}
                              </div>
                              <Markdown>{message.query}</Markdown>
                            </div>
                          </div>
                        )}

                        {/* Response Message */}
                        {message.response && (
                          <div className="flex justify-start">
                            <div className="max-w-[80%] bg-green-100 dark:bg-green-900/20 text-green-900 dark:text-green-100 rounded-lg p-3">
                              <div className="text-xs font-medium mb-1">
                                {responseAgent?.name || "Response Agent"}
                              </div>
                              <Markdown>{message.response}</Markdown>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Show live AI conversation if running */}
                {isRunningEval &&
                  aiConversationData.map((item, index) => {
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
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (item.type === "message" || item.type === "streaming") {
                      const isQueryAgent = item.speaker === queryAgent?.name;
                      return (
                        <div key={index} className="space-y-2">
                          <div
                            className={`flex ${isQueryAgent ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] p-3 rounded-lg ${
                                isQueryAgent
                                  ? "bg-blue-100 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100"
                                  : "bg-green-100 dark:bg-green-900/20 text-green-900 dark:text-green-100"
                              }`}
                            >
                              <div className="text-xs font-medium mb-1">
                                {item.speaker}{" "}
                                {item.turn && `(Turn ${item.turn})`}
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
                      Starting AI vs AI evaluation...
                    </p>
                  </div>
                )}

                {/* No content state */}
                {!currentChat?.completedAt && !isRunningEval && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Select an eval run and click "Run Evaluation" to start
                    </p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="flex-shrink-0 p-4 border-t">
            <div className="w-full text-center">
              {currentChat?.completedAt ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    This evaluation has been completed.
                  </p>
                  {currentDynamicRubric && (
                    <div className="text-sm">
                      <Badge
                        variant={
                          currentDynamicRubric.passed
                            ? "default"
                            : "destructive"
                        }
                      >
                        Score: {currentDynamicRubric.score}/
                        {currentDynamicRubric.totalPossiblePoints} -{" "}
                        {currentDynamicRubric.passed ? "Passed" : "Failed"}
                      </Badge>
                    </div>
                  )}
                </div>
              ) : isRunningEval ? (
                <p className="text-muted-foreground">
                  AI vs AI evaluation in progress...
                </p>
              ) : (
                <p className="text-muted-foreground">Ready to run evaluation</p>
              )}
            </div>
          </CardFooter>
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
