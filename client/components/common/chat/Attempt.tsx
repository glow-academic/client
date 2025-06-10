/**
 * Attempt.tsx
 * Used to display the attempt page.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";
import React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

// Icons
import { Send, ChevronDown, Users, CheckCircle, Activity } from "lucide-react";

import DocumentViewer from "@/components/common/chat/DocumentViewer";
import Markdown from "@/components/common/chat/Markdown";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getSimulationAttempt } from "@/utils/queries/simulation_attempts/get-simulationAttempt";
import { getSimulationChatsByAttempt } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempt";
import { Document, Scenario, SimulationChat, SimulationMessage } from "@/types";
import { getSimulationMessagesByChat } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chat";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";

type WindowWithAttemptTimer = Window &
  typeof globalThis & {
    attemptTimer: {
      timeRemaining: number | null;
      formatTime: (seconds: number) => string;
      isActive: boolean;
      showResults: boolean;
      hasTimeLimit: boolean;
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

export default function Attempt({ attemptId }: { attemptId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(0);
  const [isActive, setIsActive] = useState(true);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [freshlyCompletedChats, setFreshlyCompletedChats] = useState<
    Set<string>
  >(new Set());

  // Chat state for current chat
  const [newMessage, setNewMessage] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [endChatLoading, setEndChatLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
    enabled: !!attempt?.simulationId,
  });

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", attempt?.id],
    queryFn: () => getSimulationChatsByAttempt(attempt!.id),
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
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: feedbacks, isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id),
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Determine current chat based on chat simulation ID position in simulation
  const currentChat = React.useMemo(() => {
    if (!chats || !chats.length || !simulation?.scenarioIds) return chats?.[0];

    // Find the chat that matches the current chat simulation ID
    const currentChatSimulationId = simulation.scenarioIds[currentChatIndex];
    const chat = chats.find(
      (chat) => chat.scenarioId === currentChatSimulationId,
    );
    return chat || chats[0];
  }, [chats, simulation?.scenarioIds, currentChatIndex]);

  // Fetch messages for current chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", currentChat?.id],
    queryFn: () => getSimulationMessagesByChat(currentChat!.id),
    enabled: !!currentChat?.id,
  });

  // Fetch scenario for current chat
  const { data: scenario, isLoading: scenarioLoading } = useQuery({
    queryKey: ["interaction", currentChat?.scenarioId],
    queryFn: () => getScenario(currentChat!.scenarioId),
    enabled: !!currentChat?.scenarioId,
  });

  // Helper function to calculate actual time taken from database timestamps
  const calculateActualTimeTaken = (chat: SimulationChat): number => {
    return (
      grades?.find((grade) => grade.simulationChatId === chat.id)?.timeTaken ||
      0
    );
  };

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
      (grade) => grade.simulationChatId === currentChat.id,
    );
    if (!chatGrade) return null;

    const chatFeedbacks = feedbacks.filter(
      (feedback) => feedback.simulationChatGradeId === chatGrade.id,
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
        // Use group.points instead of max standard points for correct total calculation
        const groupMaxPoints = group.points;
        const maxStandardPoints = Math.max(
          ...groupStandards.map((s) => s.points),
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
      (chat: SimulationChat) => chat.completed,
    );

    return completedChats
      .map((chat) => {
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

        standardGroups.forEach((group) => {
          const groupStandards = standards.filter(
            (s) => s.standardGroupId === group.id,
          );
          const groupFeedbacks = chatFeedbacks.filter((f) =>
            groupStandards.some((s) => s.id === f.standardId),
          );

          if (groupFeedbacks.length > 0) {
            // Use group.points instead of max standard points for correct total calculation
            const groupMaxPoints = group.points;
            const maxStandardPoints = Math.max(
              ...groupStandards.map((s) => s.points),
            );
            const avgScore =
              groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
              groupFeedbacks.length;
            const normalizedScore = Math.round(
              (avgScore / maxStandardPoints) * 5,
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
    queryKey: ["documents", attempt?.classId],
    queryFn: () => getAllDocuments(),
    enabled: !!attempt,
  });

  // Filter documents for the current attempt's class
  const classDocuments = useMemo(() => {
    if (!attempt?.classId || !documents) return [];
    return documents.filter((doc: Document) => doc.classId === attempt.classId);
  }, [documents, attempt?.classId]);

  // Determine if this is a single chat attempt (acts like individual chat) or multiple chats
  const isSingleChatAttempt = simulation?.scenarioIds?.length === 1;

  // Initialize session timer
  useEffect(() => {
    if (simulation && !sessionStartTime) {
      setSessionStartTime(new Date());
      setTimeRemaining(simulation.timeLimit ? simulation.timeLimit * 60 : null); // Convert to seconds
    }
  }, [simulation, sessionStartTime]);

  // Timer countdown - only run if there's a time limit
  useEffect(() => {
    // Don't run timer if there's no time limit
    if (
      !simulation?.timeLimit ||
      !isActive ||
      timeRemaining === null ||
      timeRemaining <= 0 ||
      showResults
    )
      return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          setIsActive(false);
          setShowResults(true);
          toast.success(
            isSingleChatAttempt ? "Session completed!" : "Attempt completed!",
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [
    isActive,
    timeRemaining,
    showResults,
    isSingleChatAttempt,
    simulation?.timeLimit,
  ]);

  // Reset chat state when moving to next chat
  useEffect(() => {
    setNewMessage("");
    setShowScrollButton(false);
  }, [currentChatIndex, messages.length]);

  // Initialize to first incomplete chat when data loads
  useEffect(() => {
    if (
      chats &&
      chats.length > 0 &&
      simulation?.scenarioIds &&
      currentChatIndex === 0
    ) {
      // Find the first incomplete chat
      const firstIncompleteIndex = simulation.scenarioIds.findIndex(
        (scenarioId: string) => {
          const chat = chats.find(
            (c: SimulationChat) => c.scenarioId === scenarioId,
          );
          return chat && !chat.completed;
        },
      );

      // If we found an incomplete chat, set the index to it
      if (
        firstIncompleteIndex !== -1 &&
        firstIncompleteIndex !== currentChatIndex
      ) {
        setCurrentChatIndex(firstIncompleteIndex);
      }
    }
  }, [chats, simulation?.scenarioIds, currentChatIndex]);

  // Check if current chat is completed and move to next or show results
  useEffect(() => {
    if (currentChat?.completed && !showResults) {
      // Only auto-advance if this chat was freshly completed in this session
      const isFreshlyCompleted = freshlyCompletedChats.has(currentChat.id);

      if (isFreshlyCompleted) {
        if (
          !isSingleChatAttempt &&
          currentChatIndex < (simulation?.scenarioIds?.length || 0) - 1
        ) {
          // Move to next chat after a short delay (only for multi-chat attempts)
          const timer = setTimeout(() => {
            setCurrentChatIndex((prev) => {
              const nextIndex = prev + 1;
              toast.success(
                `Moving to chat ${nextIndex + 1} of ${simulation?.scenarioIds?.length || 0}`,
              );
              return nextIndex;
            });
          }, 2000);
          return () => clearTimeout(timer);
        } else {
          // All chats completed or single chat completed, show results
          setShowResults(true);
          setIsActive(false);
        }
      }
    }
  }, [
    currentChat?.completed,
    currentChat?.id,
    currentChatIndex,
    simulation?.scenarioIds?.length,
    showResults,
    isSingleChatAttempt,
    freshlyCompletedChats,
  ]);

  // Check if all chats are completed and show results (regardless of freshly completed status)
  useEffect(() => {
    if (chats && chats.length > 0 && simulation?.scenarioIds && !showResults) {
      const totalExpectedChats = simulation.scenarioIds.length;
      const completedChats = chats.filter(
        (chat: SimulationChat) => chat.completed,
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
              completedChatIds.includes(grade.simulationChatId),
            ));

        if (hasGradingData) {
          setShowResults(true);
          setIsActive(false);
        }
      }
    }
  }, [chats, simulation?.scenarioIds, showResults, grades, feedbacks]);

  // Handle case where grading data becomes available after chats are already loaded as completed (refresh scenario)
  useEffect(() => {
    if (
      chats &&
      chats.length > 0 &&
      simulation?.scenarioIds &&
      !showResults &&
      grades &&
      grades.length > 0
    ) {
      const totalExpectedChats = simulation.scenarioIds.length;
      const completedChats = chats.filter(
        (chat: SimulationChat) => chat.completed,
      ).length;

      // If all chats are completed and we now have grading data, show results
      if (completedChats === totalExpectedChats) {
        const completedChatIds = chats
          .filter((chat: SimulationChat) => chat.completed)
          .map((chat) => chat.id);
        const hasGradingForAllCompleted = completedChatIds.every((chatId) =>
          grades.some((grade) => grade.simulationChatId === chatId),
        );

        if (hasGradingForAllCompleted) {
          setShowResults(true);
          setIsActive(false);
        }
      }
    }
  }, [grades, feedbacks, chats, simulation?.scenarioIds, showResults]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Helper function to format interaction attributes
  const formatScenarioInfo = (scenario: Scenario | null | undefined) => {
    if (!scenario) {
      return (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>Loading scenario...</span>
          </div>
        </div>
      );
    }

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

  // Updated streaming message handler from chat page
  const handleSendMessage = async (
    e: React.FormEvent<HTMLFormElement> | null,
    initialMessage?: string,
  ) => {
    if (e) e.preventDefault();

    const messageToSend = initialMessage || newMessage.trim();
    if (!messageToSend || !currentChat) return;

    setNewMessage("");

    /* ---------------- optimistic user bubble ---------------- */
    const userMsg: SimulationMessage = {
      id: `temp-${Date.now()}`,
      query: messageToSend,
      response: "",
      createdAt: new Date().toISOString(),
      chatId: currentChat.id,
      completed: false,
    };

    const aiMsg: SimulationMessage = {
      id: `temp-ai-${Date.now()}`,
      query: "",
      response: "",
      createdAt: new Date().toISOString(),
      chatId: currentChat.id,
      completed: false,
    };

    queryClient.setQueryData(
      ["messages", currentChat.id],
      (old: SimulationMessage[] = []) => [...old, userMsg, aiMsg],
    );

    let accumulated = ""; // running buffer
    let streaming = true; // gate for re-entry
    const ctrl = new AbortController();

    try {
      /* --------------- kick off POST + SSE ------------------ */
      const formData = new FormData();
      formData.append("chat_id", currentChat.id);
      formData.append("message", userMsg.query);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/simulations/message`,
        {
          method: "POST",
          headers: { Accept: "text/event-stream" },
          cache: "no-cache",
          body: formData,
          signal: ctrl.signal,
        },
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        /* consume complete SSE frames */
        const parts = buffer.split("\n\n");
        buffer = parts.pop()!; // keep partial chunk

        for (const part of parts) {
          if (!part.startsWith("data:")) continue;

          const data = JSON.parse(part.slice(5)); // strip "data: "

          if (data.text) {
            accumulated += data.text;

            /* immutable cache update */
            queryClient.setQueryData(
              ["messages", currentChat.id],
              (old: SimulationMessage[] = []) =>
                old.map((m) =>
                  m.id === aiMsg.id ? { ...m, response: accumulated } : m,
                ),
            );
          }

          if (data.done || data.error) {
            streaming = false;
            await queryClient.invalidateQueries({
              queryKey: ["messages", currentChat.id],
            });
          }
        }
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      queryClient.setQueryData(
        ["messages", currentChat.id],
        (old: SimulationMessage[] = []) =>
          old.map((m) =>
            m.id === aiMsg.id
              ? {
                  ...m,
                  response: "⚠️ Error - please try again.",
                }
              : m,
          ),
      );
    } finally {
      if (streaming) ctrl.abort(); // ensure closure if unmount during stream
    }
  };

  const handleEndChat = async () => {
    if (!currentChat) return;

    setEndChatLoading(true);

    try {
      const formData = new FormData();
      formData.append("chat_id", currentChat.id);
      formData.append("attempt_id", attemptId);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/simulations/continue`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error("Failed to end chat");
      }

      const result = await response.json();

      if (result.success) {
        // Mark this chat as freshly completed
        setFreshlyCompletedChats((prev) => new Set(prev).add(currentChat.id));

        queryClient.invalidateQueries({ queryKey: ["attempt", attemptId] });
        queryClient.invalidateQueries({
          queryKey: ["simulationChats", attemptId],
        });
        queryClient.invalidateQueries({ queryKey: ["simulationGrades"] });
        queryClient.invalidateQueries({ queryKey: ["simulationFeedbacks"] });
        toast.success("Chat ended successfully");
      } else {
        throw new Error(result.error || "Failed to end chat");
      }
    } catch (error) {
      console.error("Error ending chat:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to end chat",
      );
    } finally {
      setEndChatLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom && messages.length > 0);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  // Helper function to format time in minutes and seconds
  const formatTimeDetailed = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    } else if (remainingSeconds === 0) {
      return `${minutes}m`;
    } else {
      return `${minutes}m ${remainingSeconds}s`;
    }
  };

  // Calculate aggregated results for final display
  const aggregatedResults = useMemo(() => {
    if (allDynamicRubrics.length === 0) return null;

    const totalScore = allDynamicRubrics.reduce(
      (sum: number, rubric: DynamicRubric) => sum + rubric.score,
      0,
    );
    const averageScore = totalScore / allDynamicRubrics.length;
    const passedChats = allDynamicRubrics.filter(
      (rubric: DynamicRubric) => rubric.passed,
    ).length;

    // Calculate total time using actual database timestamps instead of rubric timeTaken
    const totalTime = chats
      ? chats
          .filter((chat: SimulationChat) => chat.completed)
          .reduce(
            (sum: number, chat: SimulationChat) =>
              sum + calculateActualTimeTaken(chat),
            0,
          )
      : 0;

    return {
      totalChats: allDynamicRubrics.length,
      passedChats,
      averageScore: Math.round(averageScore * 10) / 10,
      totalTime: totalTime, // Keep in seconds for detailed formatting
      overallPassed: passedChats === allDynamicRubrics.length,
    };
  }, [allDynamicRubrics, chats]);

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

  // Expose timer data to parent layout via context or custom hook
  useEffect(() => {
    // Store timer data in a way that the layout can access it
    if (typeof window !== "undefined") {
      (window as WindowWithAttemptTimer).attemptTimer = {
        timeRemaining: timeRemaining,
        formatTime: formatTime,
        isActive,
        showResults,
        hasTimeLimit:
          simulation?.timeLimit !== null && simulation?.timeLimit !== undefined,
      };
    }
  }, [timeRemaining, isActive, showResults, simulation?.timeLimit]);

  if (attemptLoading || simulationLoading || scenarioLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (attemptError || !attempt || simulation?.scenarioIds?.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Attempt Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The attempt you're looking for doesn't exist or has no chats
              configured.
            </p>
            <Button onClick={() => router.push("/simulations")}>
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
      <div className="flex flex-1 flex-col gap-4">
        <div
          className="max-w-4xl mx-auto space-y-6"
          data-testid="attempt-results"
        >
          {/* Aggregated Results */}
          {aggregatedResults && (
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Overall Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium">
                      {isSingleChatAttempt ? "Session" : "Chats"} Completed
                    </div>
                    <div>{aggregatedResults.totalChats}</div>
                  </div>
                  <div>
                    <div className="font-medium">Average Score</div>
                    <div>
                      {aggregatedResults.averageScore}/
                      {
                        rubrics?.find((r) => r.id === simulation?.rubricId)
                          ?.points
                      }
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Total Time</div>
                    <div>{formatTimeDetailed(aggregatedResults.totalTime)}</div>
                  </div>
                  <div>
                    <div className="font-medium">Status</div>
                    <Badge
                      variant={
                        aggregatedResults.overallPassed
                          ? "default"
                          : "destructive"
                      }
                    >
                      {aggregatedResults.overallPassed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Individual Chat Results - only show for multi-chat attempts */}
          {!isSingleChatAttempt && (
            <div className="grid gap-4">
              <h2 className="text-xl font-semibold">Individual Chat Results</h2>
              {allDynamicRubrics.map((rubric: DynamicRubric, index: number) => {
                const chat = chats?.find(
                  (c: SimulationChat) => c.id === rubric.chatId,
                );
                const actualTimeTaken = chat
                  ? calculateActualTimeTaken(chat)
                  : rubric.timeTaken;
                const skillEntries = Object.entries(rubric.skillScores);
                return (
                  <Link href={`/c/${rubric.chatId}`} key={rubric.chatId}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>
                            Chat {index + 1}: {chat?.title}
                          </span>
                          <Badge
                            variant={rubric.passed ? "default" : "destructive"}
                          >
                            {rubric.passed ? "Passed" : "Failed"}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                          <div>
                            <div className="font-medium">Score</div>
                            <div>
                              {rubric.score}/{rubric.totalPossiblePoints}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">Time Taken</div>
                            <div>{formatTimeDetailed(actualTimeTaken)}</div>
                          </div>
                          {skillEntries.map(([skillName, score]) => (
                            <div key={skillName}>
                              <div className="font-medium">{skillName}</div>
                              <div>{score}/5</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Single Chat Detailed Results */}
          {isSingleChatAttempt && currentDynamicRubric && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                      {formatTimeDetailed(
                        currentChat
                          ? calculateActualTimeTaken(currentChat)
                          : currentDynamicRubric.timeTaken,
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Time Taken
                    </div>
                  </div>
                  {Object.entries(currentDynamicRubric.skillScores).map(
                    ([skillName, score]) => (
                      <div key={skillName} className="text-center">
                        <div className="text-2xl font-bold">{score}/5</div>
                        <div className="text-sm text-muted-foreground">
                          {skillName}
                        </div>
                      </div>
                    ),
                  )}
                </div>

                <div className="space-y-3">
                  {Object.entries(currentDynamicRubric.skillFeedbacks).map(
                    ([skillName, feedback]) => (
                      <div key={skillName}>
                        <h4 className="font-medium">{skillName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {feedback}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen gap-4 p-4">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="flex items-center justify-between">
              <div>
                <span>{scenario?.description || currentChat?.title}</span>
                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  {isSingleChatAttempt ? (
                    formatScenarioInfo(scenario)
                  ) : (
                    <>
                      <Users className="h-4 w-4" />
                      <span data-testid="chat-counter">
                        Chat {currentChatIndex + 1} of{" "}
                        {simulation?.scenarioIds?.length || 0}
                      </span>
                      {scenario && (
                        <>
                          <span>•</span>
                          {formatScenarioInfo(scenario)}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              {currentChat?.completed && (
                <Badge variant="default">Completed</Badge>
              )}
            </CardTitle>
          </CardHeader>

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
                ) : (
                  messages.map((message: SimulationMessage) => (
                    <div key={message.id} className="space-y-4">
                      {/* User Message */}
                      {message.query && (
                        <div className="flex justify-end">
                          <div className="max-w-[80%] bg-primary text-primary-foreground rounded-lg p-3">
                            <Markdown>{message.query}</Markdown>
                          </div>
                        </div>
                      )}

                      {/* Assistant Response */}
                      {message.response !== undefined &&
                        message.query !== "" && (
                          <div className="flex justify-start">
                            <div className="flex gap-3 max-w-[80%]">
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarFallback>AI</AvatarFallback>
                              </Avatar>
                              <div className="bg-muted rounded-lg p-3 flex-1">
                                {message.response === "" ? (
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">
                                      Analyzing
                                    </span>
                                    <LoadingDots />
                                  </div>
                                ) : (
                                  <Markdown>{message.response}</Markdown>
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

          <CardFooter className="flex-shrink-0 p-4 border-t">
            {currentChat?.completed ? (
              <div className="w-full text-center py-4">
                <p className="text-muted-foreground mb-2">
                  This chat has been completed.
                </p>
                {currentDynamicRubric && (
                  <div className="text-sm">
                    <Badge
                      variant={
                        currentDynamicRubric.passed ? "default" : "destructive"
                      }
                    >
                      Score: {currentDynamicRubric.score}/
                      {currentDynamicRubric.totalPossiblePoints} -{" "}
                      {currentDynamicRubric.passed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full space-y-2">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={simulation?.timeLimit ? !isActive : false}
                    className="flex-1"
                    data-testid="message-input"
                  />
                  <Button
                    type="submit"
                    disabled={
                      !newMessage.trim() ||
                      (simulation?.timeLimit ? !isActive : false)
                    }
                    data-testid="send-button"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleEndChat}
                    disabled={
                      endChatLoading ||
                      (simulation?.timeLimit ? !isActive : false)
                    }
                    className="whitespace-nowrap"
                  >
                    {endChatLoading
                      ? "Ending..."
                      : isSingleChatAttempt
                        ? "End Session"
                        : "End Chat"}
                  </Button>
                </form>
                {simulation?.timeLimit && !isActive && (
                  <p className="text-sm text-muted-foreground text-center">
                    Time's up! The session has ended.
                  </p>
                )}
              </div>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Right Panel - Documents */}
      {classDocuments.length > 0 && (
        <div className="w-80 flex-shrink-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 min-h-0">
              <ScrollArea className="h-full">
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
