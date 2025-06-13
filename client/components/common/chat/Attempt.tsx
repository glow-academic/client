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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
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

// Icons
import { Send, ChevronDown, Users, Clock, PanelRightOpen, PanelRightClose, ArrowDown, X, Check, ChevronsUpDown } from "lucide-react";

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
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getSimulationChatsByAttempt } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempt";
import { Document, SimulationChat, SimulationMessage } from "@/types";
import { getSimulationMessagesByChat } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chat";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationAttempt } from "@/utils/queries/simulation_attempts/get-simulation-attempt";
import { getClass } from "@/utils/queries/classes/get-class";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";

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
  const [inputAreaHeight, setInputAreaHeight] = useState(120); // Default height in pixels
  const [inputPanelHeight, setInputPanelHeight] = useState(0);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentSearchOpen, setDocumentSearchOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Fetch scenarios to derive classId
  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  // Derive classId from scenarios
  const derivedClassId = useMemo(() => {
    if (!simulation?.scenarioIds || !scenarios) return null;
    
    // Find the first scenario that has a classId
    for (const scenarioId of simulation.scenarioIds) {
      if (scenarioId === "RAY") continue; // Skip default RAY scenario
      const scenario = scenarios.find((s: any) => s.id === scenarioId);
      if (scenario?.classId) {
        return scenario.classId;
      }
    }
    return null;
  }, [simulation?.scenarioIds, scenarios]);

  // Fetch class data for starter prompts
  const { data: classData } = useQuery({
    queryKey: ["class", derivedClassId],
    queryFn: () => getClass(derivedClassId!),
    enabled: !!derivedClassId,
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
    queryKey: ["documents", derivedClassId],
    queryFn: () => getAllDocuments(),
    enabled: !!derivedClassId,
  });

  // Filter documents for the current attempt's class
  const classDocuments = useMemo(() => {
    if (!derivedClassId || !documents) return [];
    return documents.filter((doc: Document) => doc.classId === derivedClassId);
  }, [documents, derivedClassId]);

  // Determine if this is a single chat attempt (acts like individual chat) or multiple chats
  const isSingleChatAttempt = simulation?.scenarioIds?.length === 1;

  // Get selected chat for rubric display
  const selectedChat = useMemo(() => {
    if (!selectedChatId || !chats) return null;
    return chats.find((chat: SimulationChat) => chat.id === selectedChatId);
  }, [selectedChatId, chats]);

  // Auto-select first completed chat when results show and default to showing rubric if all chats completed
  useEffect(() => {
    if (showResults && chats && chats.length > 0 && !selectedChatId) {
      const completedChats = chats.filter((chat: SimulationChat) => chat.completed);
      if (completedChats.length > 0) {
        setSelectedChatId(completedChats[0].id);

        // If all chats are completed, default to showing rubric
        if (completedChats.length === chats.length) {
          setShowGrades(true);
        }
      }
    }
  }, [showResults, chats, selectedChatId]);

  // Fetch scenario for results display
  const { data: resultsScenario, isLoading: resultsScenarioLoading } = useQuery({
    queryKey: ["resultsScenario", selectedChat?.scenarioId],
    queryFn: () => getScenario(selectedChat!.scenarioId),
    enabled: !!selectedChat?.scenarioId && showResults,
  });

  // Fetch messages for selected chat in results
  const { data: resultsMessages = [], isLoading: resultsMessagesLoading } = useQuery({
    queryKey: ["resultsMessages", selectedChat?.id],
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
      const elapsedSeconds = Math.floor((currentTime.getTime() - attemptStartTime.getTime()) / 1000);

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
    const { elapsedTime: initialElapsed, timeRemaining: initialRemaining } = calculateTimerValues();
    setElapsedTime(initialElapsed);
    setTimeRemaining(initialRemaining);

    // Check if time has already expired
    if (simulation.timeLimit && initialRemaining === 0) {
      setIsActive(false);
      setShowResults(true);
      toast.success(
        isSingleChatAttempt ? "Session completed!" : "Attempt completed!",
      );
      return;
    }

    const timer = setInterval(() => {
      const { elapsedTime: newElapsed, timeRemaining: newRemaining } = calculateTimerValues();
      setElapsedTime(newElapsed);
      setTimeRemaining(newRemaining);

      // Check if time limit reached
      if (simulation.timeLimit && newRemaining === 0 && isActive) {
        setIsActive(false);
        setShowResults(true);
        toast.success(
          isSingleChatAttempt ? "Session completed!" : "Attempt completed!",
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
    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
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
  }, [messages.length]);

  // Set up scroll event listener for the ScrollArea with increased threshold
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
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
    viewport.addEventListener('scroll', handleScrollEvent);

    return () => {
      viewport.removeEventListener('scroll', handleScrollEvent);
    };
  }, [messages.length]);

  // Track input panel height for dynamic layout
  useEffect(() => {
    if (!inputPanelRef.current) return;

          const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newHeight = entry.contentRect.height;
          setInputPanelHeight(newHeight);
        }
      });

    resizeObserver.observe(inputPanelRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Set default selected document
  useEffect(() => {
    if (classDocuments.length > 0 && !selectedDocumentId) {
      setSelectedDocumentId(classDocuments[0].id);
    }
  }, [classDocuments, selectedDocumentId]);

  // Get the currently selected document
  const selectedDocument = useMemo(() => {
    return classDocuments.find(doc => doc.id === selectedDocumentId) || null;
  }, [classDocuments, selectedDocumentId]);

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
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        textareaRef.current
      ) {
        // Focus the textarea and add the typed character
        textareaRef.current.focus();
        setNewMessage(prev => prev + e.key);
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showResults, currentChat?.completed, simulation?.timeLimit, isActive]);

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
      <div className="h-[calc(100vh-4rem)] flex gap-4"> {/* Account for breadcrumbs */}
        <ResizablePanelGroup direction="horizontal" className="h-full flex-1">
          {/* Main Results Area */}
          <ResizablePanel defaultSize={showDocuments && classDocuments.length > 0 ? 75 : 100}>
            <Card className="h-full flex flex-col">
              <CardContent className="flex-1 flex flex-col p-0">
                {/* Chat Selector and Controls */}
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
                    <div className="flex items-end justify-end flex-col gap-2">
                      <div className="flex items-center gap-4">
                        {selectedChat && (
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
                        )}
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                                  selectedChat && allDynamicRubrics.find(rubric => rubric.chatId === selectedChat.id)
                                    ? allDynamicRubrics.find(rubric => rubric.chatId === selectedChat.id)?.passed
                                      ? "bg-green-100 dark:bg-green-900/30"
                                      : "bg-red-100 dark:bg-red-900/30"
                                    : aggregatedResults
                                      ? aggregatedResults.overallPassed
                                        ? "bg-green-100 dark:bg-green-900/30"
                                        : "bg-red-100 dark:bg-red-900/30"
                                      : "bg-muted"
                                }`}>
                                  <Clock className="h-4 w-4" />
                                  <span className="text-sm font-medium" data-testid="timer">
                                    {selectedChat && allDynamicRubrics.find(rubric => rubric.chatId === selectedChat.id)?.timeTaken !== undefined
                                      ? formatTime(allDynamicRubrics.find(rubric => rubric.chatId === selectedChat.id)?.timeTaken ?? 0)
                                      : aggregatedResults?.totalTime !== undefined
                                        ? formatTime(aggregatedResults.totalTime)
                                        : "No time limit"}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              {selectedChat && allDynamicRubrics.find(rubric => rubric.chatId === selectedChat.id) ? (
                                <TooltipContent>
                                  <p>
                                    {allDynamicRubrics.find(rubric => rubric.chatId === selectedChat.id)?.passed ? "Passed" : "Failed"} 
                                    ({allDynamicRubrics.find(rubric => rubric.chatId === selectedChat.id)?.score}/{allDynamicRubrics.find(rubric => rubric.chatId === selectedChat.id)?.totalPossiblePoints})
                                  </p>
                                </TooltipContent>
                              ) : aggregatedResults ? (
                                <TooltipContent>
                                  <p>
                                    {aggregatedResults.overallPassed ? "Passed" : "Failed"} 
                                    ({aggregatedResults.passedChats}/{aggregatedResults.totalChats} chats passed)
                                  </p>
                                </TooltipContent>
                              ) : null}
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>

                      {/* Show completion status for completed attempts */}
                      {!isSingleChatAttempt && (
                        <Select
                          value={selectedChatId || ""}
                          onValueChange={setSelectedChatId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select chat to view results" />
                          </SelectTrigger>
                          <SelectContent>
                            {chats
                              ?.filter((chat: SimulationChat) => chat.completed)
                              .map((chat: SimulationChat, index: number) => (
                                <SelectItem key={chat.id} value={chat.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{chat.title}</span>
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1 px-4">
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
                        {resultsMessages.sort((a: SimulationMessage, b: SimulationMessage) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((message: SimulationMessage) => (
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
                            {message.response !== undefined && message.query !== "" && (
                              <div className="flex justify-start">
                                <div className="flex gap-3 max-w-[80%]">
                                  <Avatar className="h-8 w-8 flex-shrink-0">
                                    <AvatarFallback>AI</AvatarFallback>
                                  </Avatar>
                                  <div className="bg-muted rounded-lg p-3 flex-1">
                                    <Markdown>{message.response}</Markdown>
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
            </Card>
          </ResizablePanel>

          {/* Right Panel - Documents */}
          {showDocuments && classDocuments.length > 0 && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                <Card className="h-full border-l-0 rounded-l-none">
                  <CardContent className="h-full p-3 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium">Documents</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDocuments(false)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Popover open={documentSearchOpen} onOpenChange={setDocumentSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={documentSearchOpen}
                          className="w-full justify-between"
                        >
                          {selectedDocumentId
                            ? classDocuments.find((doc) => doc.id === selectedDocumentId)?.name
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
                              {classDocuments.map((doc: Document) => (
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
                                      selectedDocumentId === doc.id ? "opacity-100" : "opacity-0"
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
                    <div className="flex-1 min-h-0">
                      {selectedDocument && (
                        <DocumentViewer
                          document={selectedDocument}
                          bare={true}
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
    <div className="h-[calc(100vh-4rem)]"> {/* Account for breadcrumbs */}
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Main Chat Area */}
        <ResizablePanel defaultSize={showDocuments && classDocuments.length > 0 ? 75 : 100}>
          <Card className="h-full flex flex-col py-4">
            <ResizablePanelGroup direction="vertical" className="h-full">
              <ResizablePanel defaultSize={85} minSize={60}>
                <div className="h-full flex flex-col">
                  {/* Timer and Controls Header - consistent with results layout */}
                  <div className="p-4 pt-0 border-b flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        {/* Show scenario information */}
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {scenario?.description || currentChat?.title}
                          </span>
                          {!isSingleChatAttempt && (
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span data-testid="chat-counter">
                                Chat {currentChatIndex + 1} of{" "}
                                {simulation?.scenarioIds?.length || 0}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start justify-end gap-2">
                        <div className="flex items-center gap-4">
                          {currentChat?.completed && (
                            <Badge variant="default">Completed</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Documents Toggle */}
                          {classDocuments.length > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowDocuments(!showDocuments)}
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
                                  <p>{showDocuments ? 'Hide Documents' : 'Show Documents'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                                  currentChat?.completed && currentDynamicRubric
                                    ? currentDynamicRubric.passed
                                      ? "bg-green-100 dark:bg-green-900/30"
                                      : "bg-red-100 dark:bg-red-900/30"
                                    : "bg-muted"
                                }`}>
                                  <Clock className="h-4 w-4" />
                                  <span className="text-sm font-medium" data-testid="timer">
                                    {simulation?.timeLimit && timeRemaining !== null
                                      ? formatTime(timeRemaining)
                                      : formatTime(elapsedTime)}
                                  </span>
                                  {simulation?.timeLimit && !isActive && (
                                    <span className="text-xs text-red-500 ml-1">(Expired)</span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              {currentChat?.completed && currentDynamicRubric && (
                                <TooltipContent>
                                  <p>
                                    {currentDynamicRubric.passed ? "Passed" : "Failed"} 
                                    ({currentDynamicRubric.score}/{currentDynamicRubric.totalPossiblePoints})
                                  </p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
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
                                  onClick={() => handleStarterPromptClick(prompt)}
                                  disabled={
                                    currentChat?.completed ||
                                    (simulation?.timeLimit ? !isActive : false)
                                  }
                                >
                                  <span className="text-sm">{prompt}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          messages.sort((a: SimulationMessage, b: SimulationMessage) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((message: SimulationMessage) => (
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

                    {/* Scroll to bottom button with smooth fade transition */}
                    <div className={`absolute bottom-2 left-1/2 transform -translate-x-1/2 z-20 transition-all duration-300 ease-in-out ${
                      showScrollButton 
                        ? 'opacity-100 translate-y-0 pointer-events-auto' 
                        : 'opacity-0 translate-y-2 pointer-events-none'
                    }`}>
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
              <ResizablePanel defaultSize={12} minSize={8} maxSize={40}>
                <CardFooter ref={inputPanelRef} className="h-full p-4 pt-3 pb-3 border-t flex flex-col justify-center min-h-0">
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
                    <div className="w-full h-full flex flex-col gap-2 min-h-[60px] pt-2">
                      <form onSubmit={handleSendMessage} className="flex flex-col gap-2 h-full">
                        {/* Dynamic layout based on panel height - threshold increased to 140px */}
                        {inputPanelHeight > 140 ? (
                          /* Vertical layout for larger panels */
                          <div className="flex flex-col gap-2 flex-1">
                            <Textarea
                              ref={textareaRef}
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Type your message..."
                              disabled={simulation?.timeLimit ? !isActive : false}
                              className="flex-1 resize-none text-md"
                              data-testid="message-input"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendMessage(e as any);
                                }
                              }}
                              style={{
                                minHeight: '80px',
                                // Make textarea height more responsive to available space
                                height: `${Math.max(80, inputPanelHeight - 100)}px`,
                                maxHeight: `${Math.max(80, inputPanelHeight - 100)}px`
                              }}
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                type="submit"
                                disabled={
                                  !newMessage.trim() ||
                                  (simulation?.timeLimit ? !isActive : false)
                                }
                                data-testid="send-button"
                                className="min-h-[40px] h-[40px] px-3"
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
                        ) : (
                          /* Horizontal layout for smaller panels */
                          <div className="flex gap-2 flex-1 min-h-[40px]">
                            <Textarea
                              ref={textareaRef}
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Type your message..."
                              disabled={simulation?.timeLimit ? !isActive : false}
                              className="flex-1 resize-none text-md"
                              data-testid="message-input"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendMessage(e as any);
                                }
                              }}
                              style={{
                                minHeight: '40px',
                                // Make textarea height more responsive to available space
                                height: `${Math.max(40, inputPanelHeight - 60)}px`,
                                maxHeight: `${Math.max(40, inputPanelHeight - 60)}px`
                              }}
                            />
                            <div className="flex gap-2 shrink-0">
                              <Button
                                type="submit"
                                disabled={
                                  !newMessage.trim() ||
                                  (simulation?.timeLimit ? !isActive : false)
                                }
                                data-testid="send-button"
                                className="min-h-[40px] h-[40px] px-3"
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
                  )}
                </CardFooter>
              </ResizablePanel>
            </ResizablePanelGroup>
          </Card>
        </ResizablePanel>

        {/* Right Panel - Documents */}
        {showDocuments && classDocuments.length > 0 && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
              <Card className="h-full flex flex-col ml-4 p-0">
                <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
                  {/* Select dropdown directly above document */}
                  {classDocuments.length > 1 && (
                    <div className="p-3 pb-2 border-b">
                      <Popover open={documentSearchOpen} onOpenChange={setDocumentSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={documentSearchOpen}
                            className="w-full justify-between"
                          >
                            {selectedDocumentId
                              ? classDocuments.find((doc) => doc.id === selectedDocumentId)?.name
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
                                {classDocuments.map((doc: Document) => (
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
                                        selectedDocumentId === doc.id ? "opacity-100" : "opacity-0"
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
