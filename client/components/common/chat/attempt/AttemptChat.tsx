/**
 * AttemptChat.tsx
 * Used to display the attempt chat. Will wrap the AttemptInput and AttemptMessages components, creating the unified look. This page will add the header, and timer, as well as toggle the TableRubric in the correct mode. The simulation-context.tsx will be the one that wraps this with the necessary functions to call webRTC and websocket events.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Check,
  ChevronsUpDown,
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

// Add RadialBarChart imports
import { ChartContainer } from "@/components/ui/chart";
import {
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";

import DocumentViewer from "@/components/common/chat/DocumentViewer";
import { useSimulation } from "@/contexts/simulation-context";
import { Document, SimulationChat } from "@/types";
import { getClass } from "@/utils/queries/classes/get-class";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getSimulationAttempt } from "@/utils/queries/simulation_attempts/get-simulation-attempt";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";

import AttemptInput from "./AttemptInput";
import AttemptMessages from "./AttemptMessages";
import AttemptResults from "./AttemptResults";

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

// Add circular progress component
const CircularProgress = ({
  progress,
  size = 40,
  strokeWidth = 4,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) => {
  // Calculate color based on progress (red to yellow to green)
  const getProgressColor = (progress: number) => {
    if (progress < 50) {
      // Red to yellow (0-50%)
      const ratio = progress / 50;
      return `hsl(${ratio * 60}, 70%, 50%)`; // 0 = red, 60 = yellow
    } else {
      // Yellow to green (50-100%)
      const ratio = (progress - 50) / 50;
      return `hsl(${60 + ratio * 60}, 70%, 50%)`; // 60 = yellow, 120 = green
    }
  };

  const progressColor = getProgressColor(progress);

  const chartData = [
    {
      progress: Math.max(0, Math.min(100, progress)), // Ensure progress is between 0-100
      fill: progressColor,
    },
  ];

  const chartConfig = {
    progress: {
      label: "Progress",
      color: progressColor,
    },
  };

  return (
    <div className="relative flex items-center justify-center">
      <ChartContainer
        config={chartConfig}
        className={`aspect-square`}
        style={{ width: size, height: size }}
      >
        <RadialBarChart
          data={chartData}
          startAngle={90}
          endAngle={-270}
          innerRadius="75%"
          outerRadius="100%"
        >
          {/* Map progress (0-100) to the sweep angle */}
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            dataKey="progress"
            angleAxisId={0}
            tick={false}
            tickLine={false}
            axisLine={false}
          />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} />
          <RadialBar
            dataKey="progress"
            cornerRadius={strokeWidth / 2}
            fill={progressColor}
            background={{ fill: "rgba(0,0,0,0.1)" }}
          />
        </RadialBarChart>
      </ChartContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-medium text-foreground">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
};

export default function AttemptChat({ attemptId }: { attemptId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const {
    currentChat,
    chats,
    isLoadingChats,
    currentChatIndex,
    setCurrentChatIndex,
    freshlyCompletedChats,
    setFreshlyCompletedChats,
  } = useSimulation();

  const [timeRemaining, setTimeRemaining] = useState<number | null>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  const [showResults, setShowResults] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showGrades, setShowGrades] = useState(false);
  const [showDocuments, setShowDocuments] = useState(true);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
  const [documentSearchOpen, setDocumentSearchOpen] = useState(false);

  // Fetch attempt data
  const {
    data: attempt,
    isLoading: attemptLoading,
    error: attemptError,
  } = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => getSimulationAttempt(attemptId),
    enabled: !!attemptId,
  });

  const { data: simulation, isLoading: simulationLoading } = useQuery({
    queryKey: ["simulation", attempt?.simulationId],
    queryFn: () => getSimulation(attempt!.simulationId),
    enabled: !!attempt,
  });

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups, isLoading: isLoadingStandardGroups } = useQuery(
    {
      queryKey: ["standardGroups", rubrics?.map((rubric: any) => rubric.id)],
      queryFn: () =>
        getStandardGroupsByRubrics(rubrics!.map((rubric: any) => rubric.id)),
      enabled: !!rubrics,
    }
  );

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group: any) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(
        standardGroups!.map((group: any) => group.id)
      ),
    enabled: !!standardGroups,
  });

  const { data: grades, isLoading: isLoadingGrades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat: any) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(
        chats!.map((chat: any) => chat.id)
      ),
    enabled: !!chats,
  });

  const { data: feedbacks, isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade: any) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade: any) => grade.id)
      ),
    enabled: !!grades,
  });

  // Fetch scenario for current chat
  const { data: scenario, isLoading: scenarioLoading } = useQuery({
    queryKey: ["interaction", currentChat?.scenarioId],
    queryFn: () => getScenario(currentChat!.scenarioId),
    enabled: !!currentChat,
  });

  const { data: classData } = useQuery({
    queryKey: ["class", scenario?.classId],
    queryFn: () => getClass(scenario!.classId!),
    enabled: !!scenario,
  });

  // Helper function to calculate actual time taken from database timestamps
  const calculateActualTimeTaken = useCallback(
    (chat: SimulationChat): number => {
      return (
        grades?.find((grade: any) => grade.simulationChatId === chat.id)
          ?.timeTaken || 0
      );
    },
    [grades]
  );

  // Create dynamic rubric for current chat based on grades/feedback
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
      (grade: any) => grade.simulationChatId === currentChat.id
    );
    if (!chatGrade) return null;

    const chatFeedbacks = feedbacks.filter(
      (feedback: any) => feedback.simulationChatGradeId === chatGrade.id
    );

    // Calculate skill scores and feedbacks
    const skillScores: Record<string, number> = {};
    const skillFeedbacks: Record<string, string> = {};
    let totalPossiblePoints = 0;

    standardGroups.forEach((group: any) => {
      const groupStandards = standards.filter(
        (s: any) => s.standardGroupId === group.id
      );
      const groupFeedbacks = chatFeedbacks.filter((f: any) =>
        groupStandards.some((s: any) => s.id === f.standardId)
      );

      if (groupFeedbacks.length > 0) {
        // Use group.points instead of max standard points for correct total calculation
        const groupMaxPoints = group.points;
        const maxStandardPoints = Math.max(
          ...groupStandards.map((s: any) => s.points)
        );
        const avgScore =
          groupFeedbacks.reduce((sum: number, f: any) => sum + f.total, 0) /
          groupFeedbacks.length;
        const normalizedScore = Math.round((avgScore / maxStandardPoints) * 5); // Convert to 1-5 scale

        skillScores[group.name] = normalizedScore;
        skillFeedbacks[group.shortName] = groupFeedbacks
          .map((f: any) => f.feedback)
          .join("; ");
        totalPossiblePoints += groupMaxPoints; // Use group points for total
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

  // Create dynamic rubrics for all completed chats
  const allDynamicRubrics = useMemo((): DynamicRubric[] => {
    if (!chats || !grades || !feedbacks || !standards || !standardGroups)
      return [];

    const completedChats = chats.filter(
      (chat: SimulationChat) => chat.completed
    );

    return completedChats
      .map((chat) => {
        const chatGrade = grades.find(
          (grade: any) => grade.simulationChatId === chat.id
        );
        if (!chatGrade) return null;

        const chatFeedbacks = feedbacks.filter(
          (feedback: any) => feedback.simulationChatGradeId === chatGrade.id
        );

        // Calculate skill scores and feedbacks
        const skillScores: Record<string, number> = {};
        const skillFeedbacks: Record<string, string> = {};
        let totalPossiblePoints = 0;

        standardGroups.forEach((group: any) => {
          const groupStandards = standards.filter(
            (s: any) => s.standardGroupId === group.id
          );
          const groupFeedbacks = chatFeedbacks.filter((f: any) =>
            groupStandards.some((s: any) => s.id === f.standardId)
          );

          if (groupFeedbacks.length > 0) {
            // Use group.points instead of max standard points for correct total calculation
            const groupMaxPoints = group.points;
            const maxStandardPoints = Math.max(
              ...groupStandards.map((s: any) => s.points)
            );
            const avgScore =
              groupFeedbacks.reduce((sum: number, f: any) => sum + f.total, 0) /
              groupFeedbacks.length;
            const normalizedScore = Math.round(
              (avgScore / maxStandardPoints) * 5
            ); // Convert to 1-5 scale

            skillScores[group.name] = normalizedScore;
            skillFeedbacks[group.name] = groupFeedbacks
              .map((f: any) => f.feedback)
              .join("; ");
            totalPossiblePoints += groupMaxPoints; // Use group points for total
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
      })
      .filter(Boolean) as DynamicRubric[];
  }, [chats, grades, feedbacks, standards, standardGroups]);

  // Fetch documents for the attempt class
  const { data: documents = [] } = useQuery({
    queryKey: ["documents", scenario?.id],
    queryFn: () => getAllDocuments(),
    enabled: !!scenario?.id,
  });

  // Filter documents for the current attempt's class
  const scenarioDocuments = useMemo(() => {
    if (!scenario || !documents) return [];
    return documents.filter((doc: Document) =>
      scenario.documents?.includes(doc.id)
    );
  }, [documents, scenario]);

  // Determine if this is a single chat attempt (acts like individual chat) or multiple chats
  const isSingleChatAttempt = chats?.length === 1;

  // Get selected chat for rubric display
  const selectedChat = useMemo(() => {
    if (!selectedChatId || !chats) return null;
    return chats.find((chat: SimulationChat) => chat.id === selectedChatId);
  }, [selectedChatId, chats]);

  // Continue with timer logic and useEffects...
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  if (
    attemptLoading ||
    simulationLoading ||
    scenarioLoading ||
    isLoadingChats ||
    isLoadingRubrics ||
    isLoadingFeedbacks ||
    isLoadingGrades ||
    isLoadingStandardGroups ||
    isLoadingStandards
  ) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (attemptError || !attempt || !chats || chats.length === 0) {
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

  // Show results screen
  if (showResults) {
    return (
      <div className="h-[calc(100vh-4rem)]">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Main Results Area */}
          <ResizablePanel
            defaultSize={
              showDocuments && scenarioDocuments.length > 0 ? 70 : 100
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
                          {scenario?.description || "Session Results"}
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
                        {scenarioDocuments.length > 0 && (
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
                                className={`flex items-center gap-2 px-3 py-1 rounded-full bg-muted`}
                              >
                                <Clock className="h-4 w-4" />
                                <span
                                  className="text-sm font-medium"
                                  data-testid="timer"
                                >
                                  {formatTime(elapsedTime)}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Session completed</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>

                  {/* Show completion status for completed attempts */}
                  {!isSingleChatAttempt && (
                    <div className="flex justify-end">
                      <Select
                        value={selectedChatId || ""}
                        onValueChange={setSelectedChatId}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select chat to view results" />
                        </SelectTrigger>
                        <SelectContent>
                          {chats
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
                      {showGrades && selectedChat && simulation?.rubricId ? (
                        <AttemptResults
                          rubricId={simulation.rubricId}
                          selectedChatId={selectedChat.id}
                        />
                      ) : selectedChat ? (
                        /* Show chat messages for both single and multi-chat attempts */
                        <div className="space-y-4">
                          {/* Placeholder for results messages - would need to implement */}
                          <div className="text-center py-8">
                            <p className="text-muted-foreground">
                              Chat conversation view for results (to be
                              implemented)
                            </p>
                          </div>
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
          {showDocuments && scenarioDocuments.length > 0 && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                <Card className="h-full flex flex-col ml-4 p-0">
                  <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
                    {/* Document viewer */}
                    <div className="flex-1 min-h-0 p-2">
                      {selectedDocumentId && (
                        <DocumentViewer
                          key={selectedDocumentId}
                          document={
                            scenarioDocuments.find(
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
          defaultSize={showDocuments && scenarioDocuments.length > 0 ? 70 : 100}
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
                              {scenario?.description || currentChat?.title}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start justify-end gap-2">
                          <div className="flex items-center gap-4">
                            {currentChat?.completed && (
                              <Badge variant="default">Completed</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {simulation?.scenarioIds?.length &&
                              simulation?.scenarioIds?.length > 1 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                      <CircularProgress
                                        progress={
                                          ((chats.length - 1) /
                                            (simulation?.scenarioIds?.length ||
                                              1)) *
                                          100
                                        }
                                        size={64}
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      Chat {chats.length} of{" "}
                                      {simulation?.scenarioIds?.length}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}

                            {scenarioDocuments.length > 0 && (
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
                                    currentChat?.completed &&
                                    currentDynamicRubric
                                      ? currentDynamicRubric.passed
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
                                    {simulation?.timeLimit &&
                                    timeRemaining !== null
                                      ? formatTime(timeRemaining)
                                      : formatTime(elapsedTime)}
                                  </span>
                                  {simulation?.timeLimit && !isActive && (
                                    <span className="text-xs text-red-500 ml-1">
                                      (Expired)
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              {currentChat?.completed &&
                                currentDynamicRubric && (
                                  <TooltipContent>
                                    <p>
                                      {currentDynamicRubric.passed
                                        ? "Passed"
                                        : "Failed"}
                                      ({currentDynamicRubric.score}/
                                      {currentDynamicRubric.totalPossiblePoints}
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
                    <AttemptMessages
                      simulation={simulation}
                      isActive={isActive}
                    />
                  </div>
                </ResizablePanel>

                <ResizableHandle />
                {/* Input Area */}
                <ResizablePanel defaultSize={12} minSize={10} maxSize={40}>
                  <AttemptInput
                    attemptId={attemptId}
                    simulation={simulation}
                    isActive={isActive}
                    isSingleChatAttempt={isSingleChatAttempt}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </TooltipProvider>
          </Card>
        </ResizablePanel>

        {/* Right Panel - Documents */}
        {showDocuments && scenarioDocuments.length > 0 && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
              <Card className="h-full flex flex-col ml-4 p-0">
                <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
                  {/* Select dropdown directly above document */}
                  {scenarioDocuments.length > 1 && (
                    <div className="p-3 pb-2 border-b">
                      <Popover
                        open={documentSearchOpen}
                        onOpenChange={setDocumentSearchOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={documentSearchOpen}
                            className="w-full justify-between"
                          >
                            {selectedDocumentId
                              ? scenarioDocuments.find(
                                  (doc) => doc.id === selectedDocumentId
                                )?.name
                              : "Select document..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search documents..." />
                            <CommandList>
                              <CommandEmpty>No document found.</CommandEmpty>
                              <CommandGroup>
                                {scenarioDocuments.map((doc: Document) => (
                                  <CommandItem
                                    key={doc.id}
                                    value={doc.name}
                                    onSelect={() => {
                                      setSelectedDocumentId(doc.id);
                                      setDocumentSearchOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        selectedDocumentId === doc.id
                                          ? "opacity-100"
                                          : "opacity-0"
                                      }`}
                                    />
                                    <span className="truncate">{doc.name}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                  {/* Document viewer with minimal padding */}
                  <div className="flex-1 min-h-0 p-2">
                    {selectedDocumentId && (
                      <DocumentViewer
                        key={selectedDocumentId}
                        document={
                          scenarioDocuments.find(
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
