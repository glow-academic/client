/**
 * SimulationContext.tsx
 * Used to manage the simulation state. This will be used to create all the functions to call websocket events, and handle everything smoothly between all of the components.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import {
  Document,
  Scenario,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  SimulationMessage,
} from "@/types";
import { log } from "@/utils/logger";

import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getSimulationAttempt } from "@/utils/queries/simulation_attempts/get-simulation-attempt";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempt } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempt";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useWebSocket } from "./websocket-context";

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

// Aggregated results interface
interface AggregatedResults {
  totalChats: number;
  passedChats: number;
  averageScore: number;
  totalTime: number;
  overallPassed: boolean;
}

// Timer state interface
interface TimerState {
  elapsed: number;
  remaining: number | null;
  expired: boolean;
}

export interface SimulationContextType {
  // Attempt and simulation data
  attemptId: string;
  attempt: SimulationAttempt | null;
  simulation: Simulation | null;
  scenario: Scenario | null;
  documents: Document[];
  scenarioDocuments: Document[];

  // Current chat management
  currentChatIndex: number;
  setCurrentChatIndex: (index: number) => void;
  currentChat: SimulationChat | null;
  chats: SimulationChat[];
  isLoadingChats: boolean;

  // Results and grading
  currentDynamicRubric: DynamicRubric | null;
  allDynamicRubrics: DynamicRubric[];
  aggregatedResults: AggregatedResults | null;

  // Timer state
  timer: TimerState;
  isActive: boolean;

  // UI state
  showResults: boolean;
  isSingleChatAttempt: boolean;
  isLastAttempt: boolean;
  expectedChatCount: number;
  freshlyCompletedChats: Set<string>;
  setFreshlyCompletedChats: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Connection state
  isConnected: boolean;

  // WebSocket operations
  sendMessage: (message: string, isRetry?: boolean) => void;
  stopMessage: () => void;
  endChat: () => void;
  endAllChats: () => void;

  // Loading states
  isSendingMessage: boolean;
  isStoppingMessage: boolean;
  endChatLoading: boolean;

  // Event handlers
  onSimulationFinished?: (() => void) | undefined;

  // Watch mode
  readOnly: boolean;
}

const SimulationContext = createContext<SimulationContextType | null>(null);

export const useSimulation = () => {
  return useContext(SimulationContext);
};

interface SimulationProviderProps {
  children: React.ReactNode;
  attemptId: string;
  onSimulationFinished?: () => void;
  readOnly?: boolean;
}

export function SimulationProvider({
  children,
  attemptId,
  onSimulationFinished,
  readOnly = false,
}: SimulationProviderProps) {
  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isStoppingMessage, setIsStoppingMessage] = useState(false);
  const [endChatLoading, setEndChatLoading] = useState(false);
  const [freshlyCompletedChats, setFreshlyCompletedChats] = useState<
    Set<string>
  >(new Set());
  const [showResults, setShowResults] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Timer state
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(0);

  const queryClient = useQueryClient();
  const currentRoomRef = useRef<string | null>(null);
  const currentChatIdRef = useRef<string | null>(null);
  const freshlyCompletedChatsRef = useRef<Set<string>>(new Set());
  const onSimulationFinishedRef = useRef(onSimulationFinished);
  const simulationRef = useRef<Simulation | null>(null);
  const pendingNextChatIdRef = useRef<string | null>(null);

  // Use the global WebSocket context
  const {
    isConnected,
    joinRoom,
    leaveRoom,
    emitSendSimulationMessage,
    emitStopSimulation,
    emitContinueSimulation,
  } = useWebSocket();

  // Fetch attempt data
  const { data: attempt } = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => getSimulationAttempt(attemptId),
    enabled: !!attemptId,
  });

  // Get chats for the attempt
  const { data: chats = [], isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", attemptId],
    queryFn: () => getSimulationChatsByAttempt(attemptId),
    enabled: !!attemptId,
  });

  // Fetch simulation data
  const { data: simulation } = useQuery({
    queryKey: ["simulation", attempt?.simulationId],
    queryFn: () => getSimulation(attempt!.simulationId),
    enabled: !!attempt,
  });

  // Fetch rubrics and standards data
  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups } = useQuery({
    queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
    queryFn: () =>
      getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
    enabled: !!rubrics,
  });

  const { data: standards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups,
  });

  const { data: grades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats,
  });

  const { data: feedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id)
      ),
    enabled: !!grades,
  });

  // Determine current chat based on actual chats for this attempt
  const currentChat = useMemo(() => {
    if (!chats || !chats.length) return null;

    // Sort chats by creation date to ensure consistent ordering
    const sortedChats = [...chats].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Return the chat at the current index, or the first chat if index is out of bounds
    return sortedChats[currentChatIndex] || sortedChats[0];
  }, [chats, currentChatIndex]);

  // Fetch scenario for current chat
  const { data: scenario } = useQuery({
    queryKey: ["interaction", currentChat?.scenarioId],
    queryFn: () => getScenario(currentChat!.scenarioId),
    enabled: !!currentChat,
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ["documents", scenario?.id],
    queryFn: () => getAllDocuments(),
    enabled: !!scenario?.id,
  });

  // Filter documents for the current attempt's class
  const scenarioDocuments = useMemo(() => {
    if (!scenario || !documents) return [];
    return documents.filter((doc: Document) =>
      scenario.documentIds?.includes(doc.id)
    );
  }, [documents, scenario]);

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
        const groupMaxPoints = group.points;
        const maxStandardPoints = Math.max(
          ...groupStandards.map((s) => s.points)
        );
        const avgScore =
          groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
          groupFeedbacks.length;
        const normalizedScore = Math.round((avgScore / maxStandardPoints) * 5);

        skillScores[group.name] = normalizedScore;
        skillFeedbacks[group.shortName] = groupFeedbacks
          .map((f) => f.feedback)
          .join("; ");
        totalPossiblePoints += groupMaxPoints;
      }
    });

    const passed = chatGrade.passed;

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
            const groupMaxPoints = group.points;
            const maxStandardPoints = Math.max(
              ...groupStandards.map((s) => s.points)
            );
            const avgScore =
              groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
              groupFeedbacks.length;
            const normalizedScore = Math.round(
              (avgScore / maxStandardPoints) * 5
            );

            skillScores[group.name] = normalizedScore;
            skillFeedbacks[group.name] = groupFeedbacks
              .map((f) => f.feedback)
              .join("; ");
            totalPossiblePoints += groupMaxPoints;
          }
        });

        const passed = chatGrade.passed;

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

  // Calculate aggregated results for final display
  const aggregatedResults = useMemo((): AggregatedResults | null => {
    if (allDynamicRubrics.length === 0) return null;

    const totalScore = allDynamicRubrics.reduce(
      (sum: number, rubric: DynamicRubric) => sum + rubric.score,
      0
    );
    const averageScore = totalScore / allDynamicRubrics.length;
    const passedChats = allDynamicRubrics.filter(
      (rubric: DynamicRubric) => rubric.passed
    ).length;

    // Calculate total time using actual database timestamps
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
      totalTime: totalTime,
      overallPassed: passedChats === allDynamicRubrics.length,
    };
  }, [allDynamicRubrics, chats, calculateActualTimeTaken]);

  // Determine if this is a single chat attempt and calculate expected chat count
  // TODO: Store expectedChatCount in attempt record to prevent drift when scenarios are added later
  const expectedChatCount =
    simulation?.scenarioIds?.length || chats?.length || 1;
  const isSingleChatAttempt = expectedChatCount === 1;
  const isLastAttempt = currentChatIndex === expectedChatCount - 1;

  // Timer calculation
  const timer = useMemo((): TimerState => {
    return {
      elapsed: elapsedTime,
      remaining: timeRemaining,
      // Keep expired false for normal mode; for infinite mode we handle expiry by flipping to results immediately
      expired: false,
    };
  }, [elapsedTime, timeRemaining]);

  // Update simulation ref when simulation changes
  useEffect(() => {
    simulationRef.current = simulation || null;
  }, [simulation]);

  // Timer logic - Update timer values every second based on actual attempt creation timestamp
  useEffect(() => {
    // Update the ref to the latest callback
    onSimulationFinishedRef.current = onSimulationFinished;

    const currentSimulation = simulationRef.current;
    if (!attempt?.createdAt || !currentSimulation || showResults) return;

    const calculateTimerValues = () => {
      const attemptStartTime = new Date(attempt.createdAt);
      const currentTime = new Date();
      const elapsedSeconds = Math.floor(
        (currentTime.getTime() - attemptStartTime.getTime()) / 1000
      );

      // Infinite mode uses attempt.infiniteMode and optional attempt.infiniteModeTimeLimit
      if (attempt.infiniteMode) {
        if (attempt.infiniteModeTimeLimit) {
          const totalTimeSeconds = attempt.infiniteModeTimeLimit * 60;
          const remainingSeconds = totalTimeSeconds - elapsedSeconds;
          // Clamp to zero for display; we'll trigger results on expiry below
          return {
            elapsedTime: elapsedSeconds,
            timeRemaining: Math.max(remainingSeconds, 0),
          };
        }
        // No limit: count up only
        return { elapsedTime: elapsedSeconds, timeRemaining: null };
      }

      // Normal mode uses simulation.timeLimit (can go negative for display)
      if (currentSimulation.timeLimit) {
        const totalTimeSeconds = currentSimulation.timeLimit * 60;
        const remainingSeconds = totalTimeSeconds - elapsedSeconds;
        return { elapsedTime: elapsedSeconds, timeRemaining: remainingSeconds };
      }
      return { elapsedTime: elapsedSeconds, timeRemaining: null };
    };

    const { elapsedTime: initialElapsed, timeRemaining: initialRemaining } =
      calculateTimerValues();
    setElapsedTime(initialElapsed);
    setTimeRemaining(initialRemaining);

    // For infinite mode with a time limit, end immediately at expiry and show results
    if (
      attempt.infiniteMode &&
      attempt.infiniteModeTimeLimit &&
      initialRemaining !== null &&
      initialRemaining <= 0
    ) {
      setShowResults(true);
      setIsActive(false);
      onSimulationFinishedRef.current?.();
      return; // No interval needed; we've finished
    }

    const timerInterval = setInterval(() => {
      const { elapsedTime: newElapsed, timeRemaining: newRemaining } =
        calculateTimerValues();
      setElapsedTime(newElapsed);
      setTimeRemaining(newRemaining);

      // Infinite mode: when a time limit is set and hits zero, finish immediately
      if (
        attempt.infiniteMode &&
        attempt.infiniteModeTimeLimit &&
        newRemaining !== null &&
        newRemaining <= 0
      ) {
        clearInterval(timerInterval);
        setShowResults(true);
        setIsActive(false);
        onSimulationFinishedRef.current?.();
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [
    attempt?.createdAt,
    showResults,
    isActive,
    isSingleChatAttempt,
    onSimulationFinished,
    simulation?.id, // Only depend on simulation ID to trigger re-run when simulation changes
    attempt?.infiniteMode,
    attempt?.infiniteModeTimeLimit,
  ]);

  // Initialize to first incomplete chat when data loads
  useEffect(() => {
    if (chats && chats.length > 0 && currentChatIndex === 0) {
      const sortedChats = [...chats].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const firstIncompleteIndex = sortedChats.findIndex(
        (chat: SimulationChat) => !chat.completed
      );

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
    let timerTimeout: NodeJS.Timeout | null = null;

    if (currentChat?.completed && !showResults) {
      const isFresh = freshlyCompletedChatsRef.current.has(currentChat.id); // make this a ref

      if (isFresh) {
        if (
          !isSingleChatAttempt &&
          currentChatIndex < (chats?.length || 0) - 1
        ) {
          timerTimeout = setTimeout(() => {
            setCurrentChatIndex((prev) => {
              const nextIndex = prev + 1;
              toast.success(
                `Moving to chat ${nextIndex + 1} of ${chats?.length || 0}`
              );
              return nextIndex;
            });
          }, 2000);
        } else {
          setShowResults(true);
          setIsActive(false);
          onSimulationFinished?.();
        }
      }

      freshlyCompletedChatsRef.current = new Set();
    }

    return () => {
      if (timerTimeout) clearTimeout(timerTimeout);
    };
  }, [
    currentChat?.completed,
    currentChat?.id,
    currentChatIndex,
    chats?.length,
    showResults,
    isSingleChatAttempt,
    onSimulationFinished,
  ]);

  // Check if all chats are completed and show results
  useEffect(() => {
    if (chats && chats.length > 0 && !showResults) {
      const totalExpectedChats = chats.length;
      const completedChats = chats.filter(
        (chat: SimulationChat) => chat.completed
      ).length;

      if (completedChats === totalExpectedChats) {
        setShowResults(true);
        setIsActive(false);
        onSimulationFinished?.();
      }
    }
  }, [chats, showResults, onSimulationFinished]);

  // Handle case where grading data becomes available after chats are loaded as completed
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
          onSimulationFinished?.();
        }
      }
    }
  }, [grades, feedbacks, chats, showResults, onSimulationFinished]);

  // Join/leave chat rooms when currentChat changes
  useEffect(() => {
    if (!isConnected || !currentChat?.id) return;

    if (currentRoomRef.current === currentChat.id) return;

    if (currentRoomRef.current) {
      leaveRoom(currentRoomRef.current, "simulation");
    }

    joinRoom(currentChat.id, "simulation");
    currentRoomRef.current = currentChat.id;
    currentChatIdRef.current = currentChat.id;
    log.info("simulation.room.joined", {
      message: `Joined simulation chat room: ${currentChat.id}`,
      subject: { entityType: "simulation_chat", entityId: currentChat.id },
      context: {
        component: "SimulationContext",
        function: "useEffect(joinRoom)",
      },
    });

    return () => {
      if (currentRoomRef.current) {
        leaveRoom(currentRoomRef.current, "simulation");
        currentRoomRef.current = null;
        currentChatIdRef.current = null;
      }
    };
  }, [currentChat?.id, isConnected, joinRoom, leaveRoom]);

  // Update the ref whenever currentChat changes
  useEffect(() => {
    const newChatId = currentChat?.id || null;
    currentChatIdRef.current = newChatId;
  }, [currentChat?.id]);

  // WebSocket-based message handler
  const sendMessage = useCallback(
    async (message: string, isRetry?: boolean) => {
      if (readOnly) return;
      if (!message.trim() || !currentChat || isSendingMessage) return;

      setIsSendingMessage(true);

      try {
        emitSendSimulationMessage({
          chat_id: currentChat.id,
          message: message,
          ...(isRetry && { isRetry }),
        });
      } catch (err) {
        toast.error(`Failed to send message: ${err}`);
        setIsSendingMessage(false); // Reset sending state on error
      }
      // Note: setIsSendingMessage(false) is handled by WebSocket event handlers
      // (handleSimulationMessageComplete, handleSimulationMessageCancelled, etc.)
      // to ensure proper state management with server responses
    },
    [currentChat, isSendingMessage, emitSendSimulationMessage, readOnly]
  );

  // Stop message function
  const stopMessage = useCallback(async () => {
    if (readOnly) return;
    if (!currentChat || isStoppingMessage) return;

    setIsStoppingMessage(true);

    try {
      emitStopSimulation({
        chat_id: currentChat.id,
      });
    } catch (error) {
      toast.error(`Failed to stop message: ${error}`);
      setIsStoppingMessage(false);
    }
  }, [currentChat, isStoppingMessage, emitStopSimulation, readOnly]);

  const endChat = useCallback(
    async (chatId?: string) => {
      if (readOnly) return;
      const targetChatId = chatId || currentChat?.id;
      if (!targetChatId) return;

      setEndChatLoading(true);

      try {
        // Call backend with end_all=false for single chat ending
        emitContinueSimulation({
          chat_id: targetChatId,
          attempt_id: attemptId,
          end_all: false,
        });
      } catch (error) {
        toast.error(`Failed to end chat: ${error}`);
        setEndChatLoading(false);
      }
    },
    [currentChat?.id, emitContinueSimulation, attemptId, readOnly]
  );

  const endAllChats = useCallback(async () => {
    if (readOnly) return;
    if (!simulation || !attempt || !currentChat) return;

    setEndChatLoading(true);

    try {
      // Call backend with end_all=true to handle all remaining chats
      emitContinueSimulation({
        chat_id: currentChat.id,
        attempt_id: attemptId,
        end_all: true,
      });
    } catch (error) {
      toast.error(`Failed to end all chats: ${error}`);
      setEndChatLoading(false);
    }
  }, [
    simulation,
    attempt,
    currentChat,
    attemptId,
    emitContinueSimulation,
    readOnly,
  ]);

  // Listen for WebSocket loading state changes
  useEffect(() => {
    const handleSimulationMessageStart = (event: CustomEvent) => {
      if (event.detail.chatId === currentChatIdRef.current) {
        setIsSendingMessage(true);
      }
    };

    const handleSimulationMessageComplete = (event: CustomEvent) => {
      if (event.detail.chatId === currentChatIdRef.current) {
        // Update React Query cache with final content if messageId is provided (from data channel or Socket.IO)
        if (event.detail.messageId && event.detail.finalContent !== undefined) {
          queryClient.setQueryData(
            ["simulationMessages", event.detail.chatId],
            (old: SimulationMessage[] = []) => {
              return old.map((msg) =>
                msg.id === event.detail.messageId
                  ? {
                      ...msg,
                      content: event.detail.finalContent,
                      completed: true,
                    }
                  : msg
              );
            }
          );

          // Invalidate queries for fresh data
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", event.detail.chatId],
            });
          }, 0);
        }

        // Reset loading states
        setIsSendingMessage(false);

        // Dispatch responseComplete event for tour progression and navigating state management
        window.dispatchEvent(
          new CustomEvent("responseComplete", {
            detail: {
              chatId: event.detail.chatId,
              messageId: event.detail.messageId,
              finalContent: event.detail.finalContent,
            },
          })
        );
      }
    };

    // Handle data channel token events
    const handleSimulationMessageToken = (event: CustomEvent) => {
      if (event.detail.chatId === currentChatIdRef.current) {
        // Update React Query cache with token data immediately
        queryClient.setQueryData(
          ["simulationMessages", event.detail.chatId],
          (old: SimulationMessage[] = []) => {
            return old.map((msg) =>
              msg.id === event.detail.messageId
                ? { ...msg, content: event.detail.accumulatedContent }
                : msg
            );
          }
        );
      }
    };

    // Note: Word timing events (simulationWordTimings) are handled directly
    // in AttemptMessages component for better separation of concerns

    const handleSimulationMessageCancelled = (event: CustomEvent) => {
      if (event.detail.chatId === currentChatIdRef.current) {
        setIsSendingMessage(false);
        setIsStoppingMessage(false);
      }
    };

    const handleSimulationMessageError = (event: CustomEvent) => {
      if (event.detail.chatId === currentChatIdRef.current) {
        setIsSendingMessage(false);
        setIsStoppingMessage(false);
      }
    };

    const handleSimulationStopped = (event: CustomEvent) => {
      if (event.detail.chatId === currentChatIdRef.current) {
        setIsStoppingMessage(false);
        setIsSendingMessage(false);
      }
    };

    // This is the new, enhanced handler for when a chat has successfully ended
    const handleChatEnded = (event: CustomEvent) => {
      // THE FIX: Check if the event's completedChatId matches the current one.
      if (event.detail.completedChatId === currentChatIdRef.current) {
        log.debug("simulation.chat.ended", {
          message: `Chat ${event.detail.completedChatId} ended. Invalidating data to fetch next state.`,
          subject: {
            entityType: "simulation_chat",
            entityId: String(event.detail.completedChatId),
          },
          context: {
            component: "SimulationContext",
            function: "handleChatEnded",
            attemptId,
          },
        });

        // Mark the chat as freshly completed so the UI can auto-advance
        setFreshlyCompletedChats((prev) =>
          new Set(prev).add(event.detail.completedChatId)
        );
        freshlyCompletedChatsRef.current.add(event.detail.completedChatId);

        // Invalidate queries. This will refetch the list of chats, which now
        // includes the new chat, and will mark the old one as "completed".
        queryClient.invalidateQueries({
          queryKey: ["simulationChats", attemptId],
        });
        queryClient.invalidateQueries({ queryKey: ["attempt", attemptId] });
        queryClient.invalidateQueries({ queryKey: ["simulationGrades"] });
        queryClient.invalidateQueries({ queryKey: ["simulationFeedbacks"] });

        // Turn off the loading indicator for the "End Chat" button
        setEndChatLoading(false);

        // Store nextChatId (if provided) so we can auto-focus it after data refresh
        if (event.detail.nextChatId) {
          pendingNextChatIdRef.current = event.detail.nextChatId as string;
        }

        // Dispatch chatEnded event for tour progression and navigating state management
        window.dispatchEvent(
          new CustomEvent("chatEnded", {
            detail: {
              chatId: event.detail.completedChatId,
              attemptId: attemptId,
            },
          })
        );
      }
    };

    const handleSimulationError = (event: CustomEvent) => {
      if (event.detail.chatId === currentChatIdRef.current) {
        setIsSendingMessage(false);
        setIsStoppingMessage(false);
        setEndChatLoading(false);
      }
    };

    const handleEndAllCompleted = (event: CustomEvent) => {
      if (event.detail.attemptId === attemptId) {
        // Invalidate queries to refresh the UI
        queryClient.invalidateQueries({
          queryKey: ["simulationChats", attemptId],
        });
        queryClient.invalidateQueries({ queryKey: ["attempt", attemptId] });
        queryClient.invalidateQueries({ queryKey: ["simulationGrades"] });
        queryClient.invalidateQueries({ queryKey: ["simulationFeedbacks"] });

        // Show results since all chats are now completed
        setShowResults(true);
        setIsActive(false);
        onSimulationFinished?.();
        setEndChatLoading(false);
      }
    };

    window.addEventListener(
      "simulationMessageStart",
      handleSimulationMessageStart as EventListener
    );
    window.addEventListener(
      "simulationMessageComplete",
      handleSimulationMessageComplete as EventListener
    );
    window.addEventListener(
      "simulationMessageCancelled",
      handleSimulationMessageCancelled as EventListener
    );
    window.addEventListener(
      "simulationMessageError",
      handleSimulationMessageError as EventListener
    );
    window.addEventListener(
      "simulationStopped",
      handleSimulationStopped as EventListener
    );
    // Listen for the custom event dispatched from the WebSocketProvider
    window.addEventListener(
      "simulationChatEnded",
      handleChatEnded as EventListener
    );
    window.addEventListener(
      "simulationError",
      handleSimulationError as EventListener
    );

    window.addEventListener(
      "endAllCompleted",
      handleEndAllCompleted as EventListener
    );
    // Listen for data channel events
    window.addEventListener(
      "simulationMessageToken",
      handleSimulationMessageToken as EventListener
    );

    return () => {
      window.removeEventListener(
        "simulationMessageStart",
        handleSimulationMessageStart as EventListener
      );
      window.removeEventListener(
        "simulationMessageComplete",
        handleSimulationMessageComplete as EventListener
      );
      window.removeEventListener(
        "simulationMessageCancelled",
        handleSimulationMessageCancelled as EventListener
      );
      window.removeEventListener(
        "simulationMessageError",
        handleSimulationMessageError as EventListener
      );
      window.removeEventListener(
        "simulationStopped",
        handleSimulationStopped as EventListener
      );
      window.removeEventListener(
        "simulationChatEnded",
        handleChatEnded as EventListener
      );
      window.removeEventListener(
        "simulationError",
        handleSimulationError as EventListener
      );
      window.removeEventListener(
        "endAllCompleted",
        handleEndAllCompleted as EventListener
      );
      // Remove data channel event listeners
      window.removeEventListener(
        "simulationMessageToken",
        handleSimulationMessageToken as EventListener
      );
    };
  }, [queryClient, attemptId, onSimulationFinished]); // Add queryClient, attemptId, and onSimulationFinished to the dependency array

  // After chats refresh, jump to the next chat if one was provided by the server
  useEffect(() => {
    if (!chats || chats.length === 0) return;
    const desiredNextId = pendingNextChatIdRef.current;
    if (!desiredNextId) return;

    const sortedChats = [...chats].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const idx = sortedChats.findIndex((c) => c.id === desiredNextId);
    if (idx !== -1) {
      setCurrentChatIndex(idx);
      pendingNextChatIdRef.current = null;
    }
  }, [chats]);

  const value: SimulationContextType = {
    // Data
    attemptId,
    attempt: attempt || null,
    simulation: simulation || null,
    scenario: scenario || null,
    documents,
    scenarioDocuments,

    // Current chat management
    currentChatIndex,
    setCurrentChatIndex,
    currentChat: currentChat || null,
    chats,
    isLoadingChats,

    // Results and grading
    currentDynamicRubric,
    allDynamicRubrics,
    aggregatedResults,

    // Timer state
    timer,
    isActive,

    // UI state
    showResults,
    isSingleChatAttempt,
    isLastAttempt,
    expectedChatCount,
    freshlyCompletedChats,
    setFreshlyCompletedChats,

    // Connection
    isConnected,

    // WebSocket operations
    sendMessage,
    stopMessage,
    endChat,
    endAllChats,

    // Loading states
    isSendingMessage,
    isStoppingMessage,
    endChatLoading,

    // Event handlers
    onSimulationFinished,

    // Watch mode
    readOnly,
  };

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}
