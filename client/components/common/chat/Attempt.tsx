/**
 * Attempt.tsx
 * Used to display the attempt page.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

// Icons
import {
  ArrowDown,
  Check,
  ChevronsUpDown,
  Clock,
  FileText,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Square,
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
import Markdown from "@/components/common/chat/Markdown";
import TableRubric from "@/components/common/rubric/TableRubric";
import { getWebSocketUrl } from "@/lib/utils";
import { Document, SimulationChat, SimulationMessage } from "@/types";
import { continueSimulation } from "@/utils/api/simulations/continue-simulation";
import { createSimulationMessage } from "@/utils/api/simulations/create-simulation-message";
import { stopSimulation } from "@/utils/api/simulations/stop-simulation";
import { logError, logInfo } from "@/utils/logger";
import { getClass } from "@/utils/queries/classes/get-class";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getSimulationAttempt } from "@/utils/queries/simulation_attempts/get-simulation-attempt";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempt } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempt";
import { getSimulationMessagesByChat } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chat";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";

// Timer is now integrated directly into the component layout

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

export default function Attempt({ attemptId }: { attemptId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [freshlyCompletedChats, setFreshlyCompletedChats] = useState<
    Set<string>
  >(new Set());

  // Chat state for current chat
  const [newMessage, setNewMessage] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [endChatLoading, setEndChatLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showGrades, setShowGrades] = useState(false);
  const [showDocuments, setShowDocuments] = useState(true);
  const [isTall, setIsTall] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
  const [documentSearchOpen, setDocumentSearchOpen] = useState(false);

  // WebSocket state
  const [isConnected, setIsConnected] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isStoppingMessage, setIsStoppingMessage] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const currentRoomRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const currentChatIdRef = useRef<string | null>(null);

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

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", attemptId],
    queryFn: () => getSimulationChatsByAttempt(attemptId),
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
      queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
      queryFn: () =>
        getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
      enabled: !!rubrics,
    }
  );

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups,
  });

  const { data: grades, isLoading: isLoadingGrades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats,
  });

  const { data: feedbacks, isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id)
      ),
    enabled: !!grades,
  });

  // Determine current chat based on actual chats for this attempt
  const currentChat = React.useMemo(() => {
    if (!chats || !chats.length) return null;

    // Sort chats by creation date to ensure consistent ordering
    const sortedChats = [...chats].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Return the chat at the current index, or the first chat if index is out of bounds
    return sortedChats[currentChatIndex] || sortedChats[0];
  }, [chats, currentChatIndex]);

  // Fetch messages for current chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["simulationMessages", currentChat?.id],
    queryFn: () => getSimulationMessagesByChat(currentChat!.id),
    enabled: !!currentChat,
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
        grades?.find((grade) => grade.simulationChatId === chat.id)
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
      (grade) => grade.simulationChatId === currentChat.id
    );
    if (!chatGrade) return null;

    const chatFeedbacks = feedbacks.filter(
      (feedback) => feedback.simulationChatGradeId === chatGrade.id
    );

    // Calculate skill scores and feedbacks
    const skillScores: Record<string, number> = {};
    const skillFeedbacks: Record<string, string> = {};
    let totalPossiblePoints = 0;

    standardGroups.forEach((group) => {
      const groupStandards = standards.filter(
        (s) => s.standardGroupId === group.id
      );
      const groupFeedbacks = chatFeedbacks.filter((f) =>
        groupStandards.some((s) => s.id === f.standardId)
      );

      if (groupFeedbacks.length > 0) {
        // Use group.points instead of max standard points for correct total calculation
        const groupMaxPoints = group.points;
        const maxStandardPoints = Math.max(
          ...groupStandards.map((s) => s.points)
        );
        const avgScore =
          groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
          groupFeedbacks.length;
        const normalizedScore = Math.round((avgScore / maxStandardPoints) * 5); // Convert to 1-5 scale

        skillScores[group.name] = normalizedScore;
        skillFeedbacks[group.shortName] = groupFeedbacks
          .map((f) => f.feedback)
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
          (grade) => grade.simulationChatId === chat.id
        );
        if (!chatGrade) return null;

        const chatFeedbacks = feedbacks.filter(
          (feedback) => feedback.simulationChatGradeId === chatGrade.id
        );

        // Calculate skill scores and feedbacks
        const skillScores: Record<string, number> = {};
        const skillFeedbacks: Record<string, string> = {};
        let totalPossiblePoints = 0;

        standardGroups.forEach((group) => {
          const groupStandards = standards.filter(
            (s) => s.standardGroupId === group.id
          );
          const groupFeedbacks = chatFeedbacks.filter((f) =>
            groupStandards.some((s) => s.id === f.standardId)
          );

          if (groupFeedbacks.length > 0) {
            // Use group.points instead of max standard points for correct total calculation
            const groupMaxPoints = group.points;
            const maxStandardPoints = Math.max(
              ...groupStandards.map((s) => s.points)
            );
            const avgScore =
              groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
              groupFeedbacks.length;
            const normalizedScore = Math.round(
              (avgScore / maxStandardPoints) * 5
            ); // Convert to 1-5 scale

            skillScores[group.name] = normalizedScore;
            skillFeedbacks[group.name] = groupFeedbacks
              .map((f) => f.feedback)
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

  // Auto-select first completed chat when results show and default to showing rubric if all chats completed
  useEffect(() => {
    if (showResults && chats && chats.length > 0 && !selectedChatId) {
      const completedChats = chats.filter(
        (chat: SimulationChat) => chat.completed
      );
      if (completedChats.length > 0 && completedChats[0]) {
        setSelectedChatId(completedChats[0].id);

        // If all chats are completed, default to showing rubric
        if (completedChats.length === chats.length) {
          setShowGrades(true);
        }
      }
    }
  }, [showResults, chats, selectedChatId]);

  // Fetch scenario for results display
  const { data: resultsScenario, isLoading: resultsScenarioLoading } = useQuery(
    {
      queryKey: ["resultsScenario", selectedChat?.scenarioId],
      queryFn: () => getScenario(selectedChat!.scenarioId),
      enabled: !!selectedChat?.scenarioId && showResults,
    }
  );

  // Fetch messages for selected chat in results
  const { data: resultsMessages = [], isLoading: resultsMessagesLoading } =
    useQuery({
      queryKey: ["simulationMessages", selectedChat?.id],
      queryFn: () => getSimulationMessagesByChat(selectedChat!.id),
      enabled: !!selectedChat?.id && showResults,
    });

  // Update timer values every second based on actual attempt creation timestamp
  useEffect(() => {
    if (!attempt?.createdAt || !simulation || showResults) return;

    // Calculate time based on actual attempt creation timestamp
    const calculateTimerValues = () => {
      const attemptStartTime = new Date(attempt.createdAt);
      const currentTime = new Date();
      const elapsedSeconds = Math.floor(
        (currentTime.getTime() - attemptStartTime.getTime()) / 1000
      );

      if (simulation.timeLimit) {
        // For time-limited attempts, calculate remaining time
        const totalTimeSeconds = simulation.timeLimit * 60;
        const remainingSeconds = Math.max(0, totalTimeSeconds - elapsedSeconds);
        return { elapsedTime: elapsedSeconds, timeRemaining: remainingSeconds };
      } else {
        // For unlimited attempts, just track elapsed time
        return { elapsedTime: elapsedSeconds, timeRemaining: null };
      }
    };

    // Initial calculation
    const { elapsedTime: initialElapsed, timeRemaining: initialRemaining } =
      calculateTimerValues();
    setElapsedTime(initialElapsed);
    setTimeRemaining(initialRemaining);

    // Check if time has already expired
    if (simulation.timeLimit && initialRemaining === 0) {
      setIsActive(false);
      setShowResults(true);
      toast.success(
        isSingleChatAttempt ? "Session completed!" : "Attempt completed!"
      );
      return;
    }

    const timer = setInterval(() => {
      const { elapsedTime: newElapsed, timeRemaining: newRemaining } =
        calculateTimerValues();
      setElapsedTime(newElapsed);
      setTimeRemaining(newRemaining);

      // Check if time limit reached
      if (simulation.timeLimit && newRemaining === 0 && isActive) {
        setIsActive(false);
        setShowResults(true);
        toast.success(
          isSingleChatAttempt ? "Session completed!" : "Attempt completed!"
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    attempt?.createdAt,
    simulation?.timeLimit,
    showResults,
    isActive,
    isSingleChatAttempt,
    simulation,
    currentChatIndex,
  ]);

  // Reset chat state when moving to next chat
  useEffect(() => {
    setNewMessage("");
    setShowScrollButton(false);
  }, [currentChatIndex, messages.length]);

  // Initialize to first incomplete chat when data loads
  useEffect(() => {
    if (chats && chats.length > 0 && currentChatIndex === 0) {
      // Sort chats by creation date to ensure consistent ordering
      const sortedChats = [...chats].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Find the first incomplete chat
      const firstIncompleteIndex = sortedChats.findIndex(
        (chat: SimulationChat) => !chat.completed
      );

      // If we found an incomplete chat, set the index to it
      if (
        firstIncompleteIndex !== -1 &&
        firstIncompleteIndex !== currentChatIndex
      ) {
        setCurrentChatIndex(firstIncompleteIndex);
      }
    }
  }, [chats, currentChatIndex]);

  // Check if current chat is completed and move to next or show results
  useEffect(() => {
    if (currentChat?.completed && !showResults) {
      // Only auto-advance if this chat was freshly completed in this session
      const isFreshlyCompleted = freshlyCompletedChats.has(currentChat.id);

      if (isFreshlyCompleted) {
        if (
          !isSingleChatAttempt &&
          currentChatIndex < (chats?.length || 0) - 1
        ) {
          // Move to next chat after a short delay (only for multi-chat attempts)
          const timer = setTimeout(() => {
            setCurrentChatIndex((prev) => {
              const nextIndex = prev + 1;
              toast.success(
                `Moving to chat ${nextIndex + 1} of ${chats?.length || 0}`
              );
              return nextIndex;
            });
          }, 2000);
          return () => clearTimeout(timer);
        } else {
          // All chats completed or single chat completed, show results
          setShowResults(true);
          setIsActive(false);
          return;
        }
      }
    }
    return;
  }, [
    currentChat?.completed,
    currentChat?.id,
    currentChatIndex,
    chats?.length,
    showResults,
    isSingleChatAttempt,
    freshlyCompletedChats,
  ]);

  // Check if all chats are completed and show results (regardless of freshly completed status)
  useEffect(() => {
    if (chats && chats.length > 0 && !showResults) {
      const totalExpectedChats = chats.length;
      const completedChats = chats.filter(
        (chat: SimulationChat) => chat.completed
      ).length;

      // For completed chats, also check if we have grading data available
      if (completedChats === totalExpectedChats) {
        // If we have completed chats, wait for grading data to be available before showing results
        const completedChatIds = chats
          .filter((chat: SimulationChat) => chat.completed)
          .map((chat) => chat.id);
        const hasGradingData =
          completedChatIds.length === 0 ||
          (grades &&
            grades.some((grade) =>
              completedChatIds.includes(grade.simulationChatId)
            ));

        if (hasGradingData) {
          setShowResults(true);
          setIsActive(false);
        }
      }
    }
  }, [chats, showResults, grades, feedbacks]);

  // Handle case where grading data becomes available after chats are already loaded as completed (refresh scenario)
  useEffect(() => {
    if (
      chats &&
      chats.length > 0 &&
      !showResults &&
      grades &&
      grades.length > 0
    ) {
      const totalExpectedChats = chats.length;
      const completedChats = chats.filter(
        (chat: SimulationChat) => chat.completed
      ).length;

      // If all chats are completed and we now have grading data, show results
      if (completedChats === totalExpectedChats) {
        const completedChatIds = chats
          .filter((chat: SimulationChat) => chat.completed)
          .map((chat) => chat.id);
        const hasGradingForAllCompleted = completedChatIds.every((chatId) =>
          grades.some((grade) => grade.simulationChatId === chatId)
        );

        if (hasGradingForAllCompleted) {
          setShowResults(true);
          setIsActive(false);
        }
      }
    }
  }, [grades, feedbacks, chats, showResults]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // WebSocket connection setup - should only run once
  useEffect(() => {
    // Don't create multiple connections
    if (socketRef.current?.connected) {
      return;
    }

    // Determine WebSocket URL based on environment
    const socket = io(getWebSocketUrl(), {
      transports: ["websocket", "polling"],
      autoConnect: true,
      forceNew: false, // Don't force new connection if one exists
      timeout: 20000, // Increased timeout
      reconnection: true,
      reconnectionAttempts: 5, // Increased attempts for better reliability
      reconnectionDelay: 1000, // Reduced initial delay
      reconnectionDelayMax: 5000, // Reasonable max delay
      path: "/socket.io/",
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      logInfo("WebSocket connected for simulation");
    });

    socket.on("disconnect", (reason: string) => {
      setIsConnected(false);
      logInfo(`WebSocket disconnected: ${reason}`);
    });

    socket.on("connect_error", (error: Error) => {
      logError("WebSocket connection error:", error);
      setIsConnected(false);
    });

    socket.on(
      "new_message",
      (data: {
        message_id: string;
        chat_id: string;
        role: string;
        content: string;
        completed: boolean;
        created_at: string;
      }) => {
        logInfo("Simulation received new_message", {
          messageId: data.message_id,
          chatId: data.chat_id,
          role: data.role,
          currentChatId: currentChatIdRef.current,
          content:
            data.content.substring(0, 50) +
            (data.content.length > 50 ? "..." : ""),
          completed: data.completed,
        });

        // Check if this message is for the current chat
        if (data.chat_id !== currentChatIdRef.current) {
          logInfo(
            `Ignoring message for different chat: ${data.chat_id} vs ${currentChatIdRef.current}`
          );
          return;
        }

        // Update the messages cache with new message
        queryClient.setQueryData(
          ["simulationMessages", data.chat_id],
          (old: SimulationMessage[] = []) => {
            logInfo(
              `Updating simulation message cache for chat ${data.chat_id}`,
              {
                oldMessagesCount: old.length,
                newMessageId: data.message_id,
              }
            );

            const exists = old.find((msg) => msg.id === data.message_id);
            if (exists) {
              logInfo(`Message ${data.message_id} already exists, skipping`);
              return old;
            }

            const newMessage: SimulationMessage = {
              id: data.message_id,
              chatId: data.chat_id,
              type: data.role === "user" ? "query" : "response",
              content: data.content,
              completed: data.completed,
              createdAt: data.created_at,
            };

            const updated = [...old, newMessage].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            );

            logInfo(`Updated simulation message cache`, {
              newMessagesCount: updated.length,
              addedMessage: {
                id: newMessage.id,
                type: newMessage.type,
                content: newMessage.content.substring(0, 50),
              },
            });

            return updated;
          }
        );

        // Force re-render by invalidating the query after the update
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["simulationMessages", data.chat_id],
          });
        }, 0);
      }
    );

    socket.on(
      "message_token",
      (data: {
        message_id: string;
        chat_id: string;
        token: string;
        accumulated_content: string;
      }) => {
        logInfo("Simulation received message_token", {
          token: data.token,
          messageId: data.message_id,
          chatId: data.chat_id,
          currentChatId: currentChatIdRef.current,
        });

        // Check if this message is for the current chat
        if (data.chat_id !== currentChatIdRef.current) {
          logInfo(
            `Ignoring token for different chat: ${data.chat_id} vs ${currentChatIdRef.current}`
          );
          return;
        }

        // Update the specific message with streaming content
        queryClient.setQueryData(
          ["simulationMessages", data.chat_id],
          (old: SimulationMessage[] = []) => {
            const updated = old.map((msg) =>
              msg.id === data.message_id
                ? { ...msg, content: data.accumulated_content }
                : msg
            );

            return updated;
          }
        );

        // Force re-render by invalidating the query after the update
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["simulationMessages", data.chat_id],
          });
        }, 0);
      }
    );

    socket.on(
      "message_complete",
      (data: {
        message_id: string;
        chat_id: string;
        final_content: string;
      }) => {
        logInfo("Simulation received message_complete", {
          messageId: data.message_id,
          chatId: data.chat_id,
          currentChatId: currentChatIdRef.current,
          finalContentLength: data.final_content.length,
        });

        // Check if this message is for the current chat
        if (data.chat_id !== currentChatIdRef.current) {
          logInfo(
            `Ignoring completion for different chat: ${data.chat_id} vs ${currentChatIdRef.current}`
          );
          return;
        }

        // Mark message as completed and update final content
        queryClient.setQueryData(
          ["simulationMessages", data.chat_id],
          (old: SimulationMessage[] = []) => {
            const updated = old.map((msg) =>
              msg.id === data.message_id
                ? { ...msg, content: data.final_content, completed: true }
                : msg
            );

            return updated;
          }
        );

        setIsSendingMessage(false);

        // Force re-render by invalidating the query after the update
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["simulationMessages", data.chat_id],
          });
        }, 0);
      }
    );

    socket.on("message_error", (data: { chat_id: string; error: string }) => {
      logInfo("Simulation received message_error", {
        chatId: data.chat_id,
        currentChatId: currentChatIdRef.current,
        error: data.error,
      });

      // Check if this error is for the current chat
      if (data.chat_id !== currentChatIdRef.current) {
        logInfo(
          `Ignoring error for different chat: ${data.chat_id} vs ${currentChatIdRef.current}`
        );
        return;
      }

      toast.error(`Chat error: ${data.error}`);
      setIsSendingMessage(false);
    });

    socket.on(
      "chat_stopped",
      (data: { chat_id: string; chat_type: string; message: string }) => {
        if (data.chat_id === currentChatIdRef.current) {
          setIsSendingMessage(false);
          setIsStoppingMessage(false);
          toast.success(data.message || "Chat stopped successfully");
        }
      }
    );

    socket.on(
      "message_cancelled",
      (data: {
        message_id: string;
        chat_id: string;
        final_content: string;
      }) => {
        logInfo("Simulation received message_cancelled", {
          messageId: data.message_id,
          chatId: data.chat_id,
          currentChatId: currentChatIdRef.current,
        });

        // Check if this message is for the current chat
        if (data.chat_id !== currentChatIdRef.current) {
          logInfo(
            `Ignoring cancellation for different chat: ${data.chat_id} vs ${currentChatIdRef.current}`
          );
          return;
        }

        // Update the cancelled message with its final content
        queryClient.setQueryData(
          ["simulationMessages", data.chat_id],
          (old: SimulationMessage[] = []) => {
            const updated = old.map((msg) =>
              msg.id === data.message_id
                ? { ...msg, content: data.final_content, completed: true }
                : msg
            );

            return updated;
          }
        );

        setIsSendingMessage(false);
        setIsStoppingMessage(false);

        // Force re-render by invalidating the query after the update
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["simulationMessages", data.chat_id],
          });
        }, 0);
      }
    );

    socket.on("joined_chat", (data: { chat_id: string; chat_type: string }) => {
      logInfo(`Successfully joined ${data.chat_type} chat: ${data.chat_id}`, {
        currentChatId: currentChatIdRef.current,
        isCurrentChat: data.chat_id === currentChatIdRef.current,
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient]); // Only depend on queryClient, not currentChat?.id

  // Join/leave chat rooms when currentChat changes
  useEffect(() => {
    if (!socketRef.current || !isConnected) return;

    // Don't rejoin the same room
    if (currentRoomRef.current === currentChat?.id) return;

    // Leave current room if we're in one
    if (currentRoomRef.current && socketRef.current) {
      socketRef.current.emit("leave_chat", {
        chat_id: currentRoomRef.current,
        chat_type: "simulation",
      });
      currentRoomRef.current = null;
    }

    // Join new room if we have a chat ID
    if (currentChat?.id && socketRef.current) {
      socketRef.current.emit("join_chat", {
        chat_id: currentChat.id,
        chat_type: "simulation",
      });
      currentRoomRef.current = currentChat.id;
    }

    return () => {
      if (currentRoomRef.current && socketRef.current) {
        socketRef.current.emit("leave_chat", {
          chat_id: currentRoomRef.current,
          chat_type: "simulation",
        });
        currentRoomRef.current = null;
      }
    };
  }, [currentChat?.id, isConnected]);

  // WebSocket-based message handler
  const handleSendMessage = async (
    e: React.FormEvent<HTMLFormElement> | null,
    initialMessage?: string
  ) => {
    if (e) e.preventDefault();

    const messageToSend = initialMessage || newMessage.trim();
    if (!messageToSend || !currentChat || isSendingMessage) return;

    setNewMessage("");
    setIsSendingMessage(true);

    try {
      const result = await createSimulationMessage(
        currentChat.id,
        messageToSend
      );

      if (!result.success) {
        throw new Error(result.message);
      }

      // The response will be handled via WebSocket events
      // so we don't need to process the response here
    } catch (err) {
      toast.error(`Failed to send message: ${err}`);
      setIsSendingMessage(false);
    }
  };

  // Stop message function
  const handleStopMessage = async () => {
    if (!currentChat || !socketRef.current || isStoppingMessage) return;

    setIsStoppingMessage(true);

    try {
      const result = await stopSimulation(currentChat.id);

      if (!result.success) {
        throw new Error(result.message);
      }

      // The WebSocket event will handle state updates
    } catch (error) {
      toast.error(`Failed to stop message: ${error}`);
      setIsStoppingMessage(false);
    }
  };

  const handleEndChat = async () => {
    if (!currentChat) return;

    setEndChatLoading(true);

    try {
      const result = await continueSimulation(
        currentChat.id,
        currentChat.attemptId
      );

      if (!result.success) {
        throw new Error(result.message);
      }

      // Mark this chat as freshly completed
      setFreshlyCompletedChats((prev) => new Set(prev).add(currentChat.id));

      queryClient.invalidateQueries({ queryKey: ["attempt", attemptId] });
      queryClient.invalidateQueries({
        queryKey: ["simulationChats", attemptId],
      });
      queryClient.invalidateQueries({ queryKey: ["simulationGrades"] });
      queryClient.invalidateQueries({ queryKey: ["simulationFeedbacks"] });
      toast.success("Chat ended successfully");
    } catch (error) {
      toast.error(`Failed to end chat: ${error}`);
    } finally {
      setEndChatLoading(false);
    }
  };

  const scrollToBottom = () => {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      const viewport = scrollArea.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
        // Hide scroll button after scrolling to bottom with a slight delay
        setTimeout(() => setShowScrollButton(false), 300);
      }
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
    return;
  }, [messages.length]);

  // Set up scroll event listener for the ScrollArea with increased threshold
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const viewport = scrollArea.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement;
    if (!viewport) return;

    const handleScrollEvent = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      // Increased threshold from 20 to 100 pixels for less sensitivity
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      const hasScrollableContent = scrollHeight > clientHeight + 10;
      setShowScrollButton(hasScrollableContent && !isNearBottom);
    };

    // Initial check
    handleScrollEvent();

    // Add scroll listener
    viewport.addEventListener("scroll", handleScrollEvent);

    return () => {
      viewport.removeEventListener("scroll", handleScrollEvent);
    };
  }, [messages.length]);

  // Set default selected document
  useEffect(() => {
    if (
      scenarioDocuments.length > 0 &&
      !selectedDocumentId &&
      scenarioDocuments[0]
    ) {
      setSelectedDocumentId(scenarioDocuments[0].id);
    }
  }, [scenarioDocuments, selectedDocumentId]);

  // Get the currently selected document
  const selectedDocument = useMemo(() => {
    return (
      scenarioDocuments.find((doc) => doc.id === selectedDocumentId) || null
    );
  }, [scenarioDocuments, selectedDocumentId]);

  // Calculate aggregated results for final display
  const aggregatedResults = useMemo(() => {
    if (allDynamicRubrics.length === 0) return null;

    const totalScore = allDynamicRubrics.reduce(
      (sum: number, rubric: DynamicRubric) => sum + rubric.score,
      0
    );
    const averageScore = totalScore / allDynamicRubrics.length;
    const passedChats = allDynamicRubrics.filter(
      (rubric: DynamicRubric) => rubric.passed
    ).length;

    // Calculate total time using actual database timestamps instead of rubric timeTaken
    const totalTime = chats
      ? chats
          .filter((chat: SimulationChat) => chat.completed)
          .reduce(
            (sum: number, chat: SimulationChat) =>
              sum + calculateActualTimeTaken(chat),
            0
          )
      : 0;

    return {
      totalChats: allDynamicRubrics.length,
      passedChats,
      averageScore: Math.round(averageScore * 10) / 10,
      totalTime: totalTime, // Keep in seconds for detailed formatting
      overallPassed: passedChats === allDynamicRubrics.length,
    };
  }, [allDynamicRubrics, chats, calculateActualTimeTaken]);

  // Generate starter prompts
  const starterPrompts = useMemo(() => {
    const basePrompts = [
      "Hi, how are you?",
      "What can I help you with?",
      "I'm ready to assist you today",
      "How can I support your learning?",
      "What would you like to work on?",
    ];

    if (classData?.classCode) {
      basePrompts.push(`Are you here for ${classData.classCode}?`);
    }

    // Return 3-4 prompts, prioritizing the class-specific one if available
    if (classData?.classCode) {
      return [
        "Hi, how are you?",
        "What can I help you with?",
        `Are you here for ${classData.classCode}?`,
      ];
    }

    return basePrompts.slice(0, 3);
  }, [classData?.classCode]);

  // Handle starter prompt click
  const handleStarterPromptClick = (prompt: string) => {
    handleSendMessage(null, prompt);
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

  // Timer is now displayed directly in the component, no need for layout integration

  // Auto-focus typing functionality
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only auto-focus if:
      // 1. Not in results view
      // 2. Chat is not completed
      // 3. Session is active (if time-limited)
      // 4. Not pressing special keys (Ctrl, Alt, etc.)
      // 5. Not already focused on an input/textarea
      // 6. Key is a printable character
      if (
        !showResults &&
        !currentChat?.completed &&
        (simulation?.timeLimit ? isActive : true) &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        e.key.length === 1 &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        textareaRef.current
      ) {
        // Focus the textarea and add the typed character
        textareaRef.current.focus();
        setNewMessage((prev) => prev + e.key);
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showResults, currentChat?.completed, simulation?.timeLimit, isActive]);

  // ResizeObserver for input panel height detection
  useEffect(() => {
    if (!inputPanelRef.current) {
      return;
    }

    if (resizeObserverRef.current) {
      return;
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const newIsTall = entry.contentRect.height > 160;
        setIsTall(newIsTall);
      }
    });

    ro.observe(inputPanelRef.current);
    resizeObserverRef.current = ro;

    // Initial measurement with a small delay to ensure layout is complete
    const measureTimer = setTimeout(() => {
      if (inputPanelRef.current) {
        const rect = inputPanelRef.current.getBoundingClientRect();
        const initialIsTall = rect.height > 160;
        setIsTall(initialIsTall);
      }
    }, 50);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      clearTimeout(measureTimer);
    };
  }); // No dependencies - run on every render until it succeeds

  // Update the ref whenever currentChat changes
  useEffect(() => {
    currentChatIdRef.current = currentChat?.id || null;
  }, [currentChat?.id]);

  if (
    attemptLoading ||
    simulationLoading ||
    scenarioLoading ||
    isLoadingChats ||
    isLoadingRubrics ||
    isLoadingFeedbacks ||
    isLoadingGrades ||
    isLoadingStandardGroups ||
    isLoadingStandards ||
    resultsMessagesLoading ||
    resultsScenarioLoading
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
        {" "}
        {/* Account for breadcrumbs */}
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
                          {resultsScenario?.description || "Session Results"}
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
                                className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                                  selectedChat &&
                                  allDynamicRubrics.find(
                                    (rubric) =>
                                      rubric.chatId === selectedChat.id
                                  )
                                    ? allDynamicRubrics.find(
                                        (rubric) =>
                                          rubric.chatId === selectedChat.id
                                      )?.passed
                                      ? "bg-green-100 dark:bg-green-900/30"
                                      : "bg-red-100 dark:bg-red-900/30"
                                    : aggregatedResults
                                      ? aggregatedResults.overallPassed
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
                                  allDynamicRubrics.find(
                                    (rubric) =>
                                      rubric.chatId === selectedChat.id
                                  )?.timeTaken !== undefined
                                    ? formatTime(
                                        allDynamicRubrics.find(
                                          (rubric) =>
                                            rubric.chatId === selectedChat.id
                                        )?.timeTaken ?? 0
                                      )
                                    : aggregatedResults?.totalTime !== undefined
                                      ? formatTime(aggregatedResults.totalTime)
                                      : "No time limit"}
                                </span>
                              </div>
                            </TooltipTrigger>
                            {selectedChat &&
                            allDynamicRubrics.find(
                              (rubric) => rubric.chatId === selectedChat.id
                            ) ? (
                              <TooltipContent>
                                <p>
                                  {allDynamicRubrics.find(
                                    (rubric) =>
                                      rubric.chatId === selectedChat.id
                                  )?.passed
                                    ? "Passed"
                                    : "Failed"}
                                  (
                                  {
                                    allDynamicRubrics.find(
                                      (rubric) =>
                                        rubric.chatId === selectedChat.id
                                    )?.score
                                  }
                                  /
                                  {
                                    allDynamicRubrics.find(
                                      (rubric) =>
                                        rubric.chatId === selectedChat.id
                                    )?.totalPossiblePoints
                                  }
                                  )
                                </p>
                              </TooltipContent>
                            ) : aggregatedResults ? (
                              <TooltipContent>
                                <p>
                                  {aggregatedResults.overallPassed
                                    ? "Passed"
                                    : "Failed"}
                                  ({aggregatedResults.passedChats}/
                                  {aggregatedResults.totalChats} chats passed)
                                </p>
                              </TooltipContent>
                            ) : null}
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
                        <TableRubric
                          rubricId={simulation.rubricId}
                          simulationChatId={selectedChat.id}
                        />
                      ) : selectedChat ? (
                        /* Show chat messages for both single and multi-chat attempts */
                        <div className="space-y-4">
                          {resultsMessages
                            .sort(
                              (a: SimulationMessage, b: SimulationMessage) =>
                                new Date(a.createdAt).getTime() -
                                new Date(b.createdAt).getTime()
                            )
                            .map((message: SimulationMessage) => (
                              <div key={message.id} className="space-y-3">
                                {/* User Message */}
                                {message.type === "query" && (
                                  <div className="flex justify-end mb-3">
                                    <div className="max-w-[80%]">
                                      <div className="bg-primary text-primary-foreground rounded-lg p-3">
                                        <Markdown>{message.content}</Markdown>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Assistant Response */}
                                {message.type === "response" &&
                                  message.content !== "" && (
                                    <div className="flex justify-start mb-3">
                                      <div className="max-w-[80%]">
                                        <div className="bg-muted rounded-lg p-3">
                                          <Markdown>{message.content}</Markdown>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                              </div>
                            ))}
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
                                      <span className="truncate">
                                        {doc.name}
                                      </span>
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
                      {selectedDocument && (
                        <DocumentViewer
                          key={selectedDocument.id}
                          document={selectedDocument}
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
      {" "}
      {/* Account for breadcrumbs */}
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
                    {/* Timer and Controls Header - consistent with results layout */}
                    <div className="p-4 pt-0 border-b flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          {/* Show scenario information */}
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
                            {/* Documents Toggle */}
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

                    <CardContent className="flex-1 flex flex-col p-0 min-h-0 relative">
                      <ScrollArea
                        className="flex-1 px-4 min-h-0"
                        ref={scrollAreaRef}
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
                          ) : messages.length === 0 ? (
                            /* Starter Prompts - shown when no messages */
                            <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-6">
                              <div className="text-center space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  Choose a prompt below or type your own message
                                </p>
                              </div>
                              <div className="flex flex-col gap-3 w-full max-w-md">
                                {starterPrompts.map((prompt, index) => (
                                  <Button
                                    key={index}
                                    variant="outline"
                                    className="h-auto p-4 text-left justify-start whitespace-normal"
                                    onClick={() =>
                                      handleStarterPromptClick(prompt)
                                    }
                                    disabled={
                                      currentChat?.completed ||
                                      isSendingMessage ||
                                      (simulation?.timeLimit
                                        ? !isActive
                                        : false)
                                    }
                                  >
                                    <span className="text-sm">{prompt}</span>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            messages
                              .sort(
                                (a: SimulationMessage, b: SimulationMessage) =>
                                  new Date(a.createdAt).getTime() -
                                  new Date(b.createdAt).getTime()
                              )
                              .map((message: SimulationMessage) => (
                                <div key={message.id} className="space-y-3">
                                  {/* User Message */}
                                  {message.type === "query" && (
                                    <div className="flex justify-end mb-3">
                                      <div className="max-w-[80%]">
                                        <div className="bg-primary text-primary-foreground rounded-lg p-3">
                                          <Markdown>{message.content}</Markdown>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Assistant Response */}
                                  {message.type === "response" &&
                                    message.content !== "" && (
                                      <div className="flex justify-start mb-3">
                                        <div className="max-w-[80%]">
                                          <div className="bg-muted rounded-lg p-3">
                                            {message.content === "" ? (
                                              <div className="flex items-center">
                                                <span className="text-gray-500 mr-2">
                                                  Analyzing
                                                </span>
                                                <LoadingDots />
                                              </div>
                                            ) : (
                                              <Markdown>
                                                {message.content}
                                              </Markdown>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                </div>
                              ))
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>

                      {/* Scroll to bottom button with smooth fade transition */}
                      <div
                        className={`absolute bottom-2 left-1/2 transform -translate-x-1/2 z-20 transition-all duration-300 ease-in-out ${
                          showScrollButton
                            ? "opacity-100 translate-y-0 pointer-events-auto"
                            : "opacity-0 translate-y-2 pointer-events-none"
                        }`}
                      >
                        <Button
                          variant="default"
                          size="sm"
                          onClick={scrollToBottom}
                          className="rounded-full h-10 w-10 p-0 shadow-lg bg-primary hover:bg-primary/90 border-2 border-background"
                          data-testid="scroll-to-bottom-button"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </ResizablePanel>

                <ResizableHandle />
                {currentChat?.completed ? (
                  <></>
                ) : (
                  <ResizablePanel defaultSize={12} minSize={10} maxSize={40}>
                    <CardFooter
                      ref={inputPanelRef}
                      className="h-full p-4 pt-3 pb-3 border-t flex flex-col justify-center min-h-0"
                    >
                      <div className="w-full h-full flex flex-col gap-2 min-h-[60px] pt-2 p-1">
                        <form
                          onSubmit={handleSendMessage}
                          className={`flex flex-col gap-2 h-full ${isTall ? "" : "max-h-full overflow-hidden"}`}
                        >
                          {isTall ? (
                            /* Vertical layout for larger panels with expanded textarea */
                            <div className="flex flex-col gap-3 flex-1 p-1">
                              <Textarea
                                ref={textareaRef}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type your message..."
                                disabled={
                                  simulation?.timeLimit ? !isActive : false
                                }
                                className="flex-1 resize-y overflow-y-auto text-md"
                                data-testid="message-input"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(null);
                                  }
                                }}
                                style={{
                                  minHeight: "80px",
                                  maxHeight: "300px",
                                }}
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  type="submit"
                                  disabled={
                                    isSendingMessage
                                      ? isStoppingMessage
                                      : !newMessage.trim() ||
                                        (simulation?.timeLimit
                                          ? !isActive
                                          : false)
                                  }
                                  data-testid="send-button"
                                  className="min-h-[40px] h-[40px] px-4"
                                  variant={
                                    isSendingMessage ? "destructive" : "default"
                                  }
                                  onClick={
                                    isSendingMessage
                                      ? handleStopMessage
                                      : undefined
                                  }
                                >
                                  {isSendingMessage ? (
                                    isStoppingMessage ? (
                                      <LoadingDots />
                                    ) : (
                                      <>
                                        <Square className="h-4 w-4 mr-2" />
                                        Stop
                                      </>
                                    )
                                  ) : (
                                    <>
                                      <Send className="h-4 w-4 mr-2" />
                                      Send
                                    </>
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleEndChat}
                                  disabled={
                                    endChatLoading ||
                                    (simulation?.timeLimit ? !isActive : false)
                                  }
                                  className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm"
                                >
                                  {endChatLoading
                                    ? "Ending..."
                                    : isSingleChatAttempt
                                      ? "End Session"
                                      : "End Chat"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* Horizontal layout for smaller panels - original compact view */
                            <div className="flex gap-2 flex-1 min-h-[40px] items-center p-2">
                              <Textarea
                                ref={textareaRef}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type your message..."
                                disabled={
                                  simulation?.timeLimit ? !isActive : false
                                }
                                className="flex-1 resize-none overflow-hidden text-md"
                                data-testid="message-input"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(null);
                                  }
                                }}
                                style={{
                                  height: "40px",
                                  minHeight: "40px",
                                  maxHeight: "40px",
                                }}
                              />
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  type="submit"
                                  disabled={
                                    isSendingMessage
                                      ? isStoppingMessage
                                      : !newMessage.trim() ||
                                        (simulation?.timeLimit
                                          ? !isActive
                                          : false)
                                  }
                                  data-testid="send-button"
                                  className="min-h-[40px] h-[40px] px-3"
                                  variant={
                                    isSendingMessage ? "destructive" : "default"
                                  }
                                  onClick={
                                    isSendingMessage
                                      ? handleStopMessage
                                      : undefined
                                  }
                                >
                                  {isSendingMessage ? (
                                    isStoppingMessage ? (
                                      <LoadingDots />
                                    ) : (
                                      <Square className="h-4 w-4" />
                                    )
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleEndChat}
                                  disabled={
                                    endChatLoading ||
                                    (simulation?.timeLimit ? !isActive : false)
                                  }
                                  className="whitespace-nowrap min-h-[40px] h-[40px] px-3 text-sm"
                                >
                                  {endChatLoading
                                    ? "Ending..."
                                    : isSingleChatAttempt
                                      ? "End Session"
                                      : "End Chat"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </form>
                        {simulation?.timeLimit && !isActive && (
                          <p className="text-sm text-muted-foreground text-center">
                            Time's up! The session has ended.
                          </p>
                        )}
                      </div>
                    </CardFooter>
                  </ResizablePanel>
                )}
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
                    {selectedDocument && (
                      <DocumentViewer
                        key={selectedDocument.id}
                        document={selectedDocument}
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
