/**
 * Chat.tsx
 * Used to display the chat page.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Activity,
  Users,
} from "lucide-react";
import Markdown from "@/components/common/chat/Markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getSimulationMessagesByChat } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chat";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import { getStandardGroupsByRubric } from "@/utils/queries/standard_groups/get-standard-groups-by-rubric";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getSimulationChatGradesBySimulationChat } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchat";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import {
  Scenario,
  StandardGroup,
  Standard,
  SimulationChatFeedback,
} from "@/types";
import { getSimulationChat } from "@/utils/queries/simulation_chats/get-simulation-chat";
import { getSimulationAttempt } from "@/utils/queries/simulation_attempts/get-simulation-attempt";

type WindowWithChatData = Window &
  typeof globalThis & {
    chatData: {
      elapsedTime: string;
      completed: boolean;
      passed: boolean;
    };
  };

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

export default function Chat({ chatId }: { chatId: string }) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>("00:00");

  const router = useRouter();

  const { data: chat, isLoading: chatLoading } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => getSimulationChat(chatId),
  });

  const { data: attempt, isLoading: attemptLoading } = useQuery({
    queryKey: ["attempt", chat?.attemptId],
    queryFn: () => getSimulationAttempt(chat!.attemptId),
    enabled: !!chat,
  });

  const { data: scenario, isLoading: scenarioLoading } = useQuery({
    queryKey: ["scenario", chat?.scenarioId],
    queryFn: () => getScenario(chat!.scenarioId),
    enabled: !!chat?.scenarioId,
  });

  const { data: simulation } = useQuery({
    queryKey: ["simulation", attempt?.simulationId],
    queryFn: () => getSimulation(attempt!.simulationId),
    enabled: !!attempt?.simulationId,
  });

  // Fetch messages for display only
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => getSimulationMessagesByChat(chatId),
  });

  const { data: standardGroups } = useQuery({
    queryKey: ["standardGroups", simulation?.rubricId],
    queryFn: () => getStandardGroupsByRubric(simulation!.rubricId!),
    enabled: !!simulation?.rubricId,
  });

  const { data: standards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: grades } = useQuery({
    queryKey: ["simulationGrades", chat?.id],
    queryFn: () => getSimulationChatGradesBySimulationChat(chat!.id),
    enabled: !!chat?.id,
  });

  const { data: feedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id),
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Create dynamic rubric based on grades/feedback
  const dynamicRubric = useMemo((): DynamicRubric | null => {
    if (!chat?.id || !grades || !feedbacks || !standards || !standardGroups)
      return null;

    const chatGrade = grades.find(
      (grade) => grade.simulationChatId === chat.id,
    );
    if (!chatGrade) return null;

    const chatFeedbacks = feedbacks.filter(
      (feedback) => feedback.simulationChatGradeId === chatGrade.id,
    );

    // Calculate skill scores and feedbacks
    const skillScores: Record<string, number> = {};
    const skillFeedbacks: Record<string, string> = {};
    let totalPossiblePoints = 0;

    standardGroups.forEach((group: StandardGroup) => {
      const groupStandards = standards.filter(
        (s: Standard) => s.standardGroupId === group.id,
      );
      const groupFeedbacks = chatFeedbacks.filter((f: SimulationChatFeedback) =>
        groupStandards.some((s: Standard) => s.id === f.standardId),
      );

      if (groupFeedbacks.length > 0) {
        const maxPoints = Math.max(
          ...groupStandards.map((s: Standard) => s.points),
        );
        const avgScore =
          groupFeedbacks.reduce(
            (sum: number, f: SimulationChatFeedback) => sum + f.total,
            0,
          ) / groupFeedbacks.length;
        const normalizedScore = Math.round((avgScore / maxPoints) * 5); // Convert to 1-5 scale

        skillScores[group.name] = normalizedScore;
        skillFeedbacks[group.name] = groupFeedbacks
          .map((f: SimulationChatFeedback) => f.feedback || "")
          .filter(Boolean)
          .join("; ");
        totalPossiblePoints += maxPoints;
      }
    });

    // Calculate if passed (assuming 70% threshold)
    const passed = chatGrade.score >= totalPossiblePoints * 0.7;

    return {
      chatId: chat.id,
      score: chatGrade.score,
      passed,
      timeTaken: chatGrade.timeTaken,
      skillScores,
      skillFeedbacks,
      totalPossiblePoints,
    };
  }, [chat?.id, grades, feedbacks, standards, standardGroups]);

  // Timer logic based on chat creation time (for display only)
  useEffect(() => {
    if (!chat || !chat.createdAt) return;

    const calculateElapsedTime = () => {
      // If the chat is completed and dynamic rubric has timeTaken, show that instead
      if (chat.completed && dynamicRubric?.timeTaken) {
        setElapsedTime(formatTime(dynamicRubric.timeTaken));
        return;
      }

      const startTime = new Date(chat.createdAt).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startTime) / 1000); // in seconds

      const minutes = Math.floor(elapsed / 60)
        .toString()
        .padStart(2, "0");
      const seconds = (elapsed % 60).toString().padStart(2, "0");

      setElapsedTime(`${minutes}:${seconds}`);
    };

    // Helper function to format time in seconds to MM:SS
    const formatTime = (timeInSeconds: number) => {
      const minutes = Math.floor(timeInSeconds / 60)
        .toString()
        .padStart(2, "0");
      const seconds = (timeInSeconds % 60).toString().padStart(2, "0");
      return `${minutes}:${seconds}`;
    };

    calculateElapsedTime(); // Initial calculation

    // Only set up timer if chat is not completed
    let timer: NodeJS.Timeout | null = null;
    if (!chat.completed) {
      timer = setInterval(calculateElapsedTime, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [chat, dynamicRubric]);

  // Expose chat data to layout
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as WindowWithChatData).chatData = {
        elapsedTime,
        completed: chat?.completed || false,
        passed: dynamicRubric?.passed || false,
      };
    }
  }, [elapsedTime, chat?.completed, dynamicRubric?.passed]);

  // Helper function to format interaction attributes
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

  const handleBack = () => {
    router.push("/home");
  };

  const handleGoToAttempt = () => {
    if (attempt?.id) {
      router.push(`/a/${attempt.id}`);
    }
  };

  if (chatLoading || attemptLoading || scenarioLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4" data-testid="loading-skeleton">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Chat Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The chat you're looking for doesn't exist.
            </p>
            <Button onClick={handleBack}>Return Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col gap-4"
      role="main"
      aria-label="Chat conversation"
    >
      {/* If chat is not completed, show redirect to attempt */}
      {!chat.completed && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">Chat In Progress</h3>
            <p className="text-muted-foreground mb-4">
              This chat is currently active. To continue the conversation, go to
              the attempt page.
            </p>
            <Button onClick={handleGoToAttempt} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Continue in Attempt
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dynamic Rubric Results Section - Only show for completed chats */}
      {chat?.completed && dynamicRubric && (
        <Card
          className={`border-0 ${dynamicRubric.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {dynamicRubric.passed ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              Performance Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {dynamicRubric.score}/{dynamicRubric.totalPossiblePoints}
                </div>
                <div className="font-medium">Overall Score</div>
              </div>
              {Object.entries(dynamicRubric.skillScores)
                .slice(0, 4)
                .map(([skillName, score]) => (
                  <div key={skillName} className="text-center">
                    <div className="text-lg font-semibold">{score}/5</div>
                    <div className="font-medium">{skillName}</div>
                    {dynamicRubric.skillFeedbacks[skillName] && (
                      <div className="text-xs mt-1 opacity-80">
                        {dynamicRubric.skillFeedbacks[skillName]}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat History */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <span>{scenario?.description || chat.title}</span>
              <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                {scenario && formatScenarioInfo(scenario)}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-4 p-4">
              {messagesLoading ? (
                <>
                  <div className="flex items-start gap-3 text-sm">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="grid gap-1 w-full max-w-[80%]">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-20 w-full rounded-lg" />
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm justify-end">
                    <div className="grid gap-1 text-right w-full max-w-[80%]">
                      <Skeleton className="h-4 w-20 ml-auto" />
                      <Skeleton className="h-20 w-full rounded-lg" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-full" />
                  </div>
                </>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No messages in this chat yet.
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="space-y-4">
                    {message.query && (
                      <div className="flex items-start gap-3 text-sm justify-end">
                        <div className="grid gap-1 text-right">
                          <p className="font-medium">You</p>
                          <div className="rounded-lg bg-muted p-3">
                            <Markdown>{message.query}</Markdown>
                          </div>
                        </div>
                        <Avatar>
                          <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                      </div>
                    )}
                    {message.response && (
                      <div className="flex items-start gap-3 text-sm">
                        <Avatar>
                          <AvatarFallback>AI</AvatarFallback>
                        </Avatar>
                        <div className="grid gap-1">
                          <p className="font-medium">Student</p>
                          <div className="rounded-lg bg-primary/10 p-3">
                            <Markdown>{message.response}</Markdown>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
