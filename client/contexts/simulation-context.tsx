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

import { useDocumentsByDepartmentIdBatch } from "@/lib/api/hooks/documents";
import { useUpdateProfile } from "@/lib/api/hooks/profiles";
import { useRubricsByDepartmentIdBatch } from "@/lib/api/hooks/rubrics";
import { useScenario } from "@/lib/api/hooks/scenarios";
import { useSimulationAttempt } from "@/lib/api/hooks/simulation_attempts";
import { useSimulationChatFeedbacksBySimulationChatGradeIdBatch } from "@/lib/api/hooks/simulation_chat_feedbacks";
import { useSimulationChatGradesBySimulationChatIdBatch } from "@/lib/api/hooks/simulation_chat_grades";
import {
  useSimulationChatsByAttemptId,
  useUpdateSimulationChat,
} from "@/lib/api/hooks/simulation_chats";
import { useSimulation as useSimulationHook } from "@/lib/api/hooks/simulations";
import { useStandardGroupsByRubricIdBatch } from "@/lib/api/hooks/standard_groups";
import { useStandardsByStandardGroupIdBatch } from "@/lib/api/hooks/standards";
import {
  profileKeys,
  simulationAttemptKeys,
  simulationChatFeedbackKeys,
  simulationChatGradeKeys,
  simulationChatKeysByAttemptId,
  simulationMessageKeysByChatId,
} from "@/lib/api/keys";
import { useQueryClient } from "@tanstack/react-query";
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
import { useDepartments } from "./departments-context";
import { useProfile } from "./profile-context";
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

  // Grading progress
  gradingProgress: {
    completed: number;
    total: number;
  } | null;
  isGrading: boolean;

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

  // Grading progress state
  const [gradingProgress, setGradingProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [isGrading, setIsGrading] = useState(false);

  const queryClient = useQueryClient();
  const updateProfileMutation = useUpdateProfile();
  const updateSimulationChatMutation = useUpdateSimulationChat();
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

  const { effectiveDepartmentIds } = useDepartments();

  // Use the profile context to access the effective profile
  const { effectiveProfile } = useProfile();

  // Function to set viewedChat to true when simulation is completed
  const handleSimulationCompletion = useCallback(async () => {
    if (!effectiveProfile?.id || effectiveProfile.viewedChat) {
      return; // Already viewed or no profile
    }

    try {
      // mark both complete for simplicity
      await updateProfileMutation.mutateAsync({
        id: effectiveProfile.id,
        viewedIntro: true,
        viewedChat: true,
      });
      log.info("simulation.completion.viewedChat.updated", {
        message: "Updated profile viewedChat flag after simulation completion",
        actor: { profileId: effectiveProfile.id },
        subject: { entityType: "profile", entityId: effectiveProfile.id },
        context: {
          component: "SimulationContext",
          function: "handleSimulationCompletion",
        },
      });

      // Invalidate profile queries to ensure UI updates
      queryClient.invalidateQueries({
        queryKey: profileKeys.detail(effectiveProfile.id),
      });
      queryClient.invalidateQueries({
        queryKey: profileKeys.detail(effectiveProfile.id),
      });
      queryClient.invalidateQueries({
        queryKey: profileKeys.all,
      });
    } catch (error) {
      log.error("simulation.completion.viewedChat.update.failed", {
        message: "Failed to update viewedChat flag after simulation completion",
        error,
        actor: { profileId: effectiveProfile.id },
        context: {
          component: "SimulationContext",
          function: "handleSimulationCompletion",
        },
      });
    }
  }, [
    effectiveProfile?.id,
    effectiveProfile?.viewedChat,
    queryClient,
    updateProfileMutation,
  ]);

  const { data: attempt } = useSimulationAttempt(attemptId);
  const { data: chats = [], isLoading: isLoadingChats } =
    useSimulationChatsByAttemptId(attemptId);
  const { data: simulation } = useSimulationHook(
    attempt?.simulationId || "",
    attempt !== undefined && attempt !== null
  );
  const { data: rubrics = [] } = useRubricsByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: standardGroups = [] } = useStandardGroupsByRubricIdBatch(
    rubrics.map((rubric) => rubric.id)
  );
  const { data: standards = [] } = useStandardsByStandardGroupIdBatch(
    standardGroups.map((group) => group.id)
  );
  const { data: grades = [] } = useSimulationChatGradesBySimulationChatIdBatch(
    chats.map((chat) => chat.id)
  );
  const { data: feedbacks = [] } =
    useSimulationChatFeedbacksBySimulationChatGradeIdBatch(
      grades.map((grade) => grade.id)
    );

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

  const { data: scenario } = useScenario(
    currentChat?.scenarioId || "",
    currentChat !== null
  );
  const { data: documents = [] } = useDocumentsByDepartmentIdBatch(
    effectiveDepartmentIds
  );

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

  // Helper function to check if a chat has ended (either completed or has completedAt timestamp)
  const isChatEnded = useCallback((chat: SimulationChat): boolean => {
    return chat.completed || !!chat.completedAt;
  }, []);

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

    // Check if current chat has ended (completed or has completedAt timestamp)
    const currentChatEnded = currentChat ? isChatEnded(currentChat) : false;

    const calculateTimerValues = () => {
      const attemptStartTime = new Date(attempt.createdAt);
      const currentTime = new Date();

      // Calculate total elapsed time across all chats
      let totalElapsedSeconds = 0;

      if (chats && chats.length > 0) {
        // Sort chats by creation time to ensure proper order
        const sortedChats = [...chats].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        for (let i = 0; i < sortedChats.length; i++) {
          const chat = sortedChats[i];
          if (!chat) continue;

          const chatStartTime = new Date(chat.createdAt);

          if (isChatEnded(chat) && chat.completedAt) {
            // Chat has ended, use its completion time
            const chatEndTime = new Date(chat.completedAt);
            const chatDuration = Math.floor(
              (chatEndTime.getTime() - chatStartTime.getTime()) / 1000
            );
            totalElapsedSeconds += chatDuration;
          } else if (i === currentChatIndex) {
            // Current active chat - calculate time from start to now
            const chatDuration = Math.floor(
              (currentTime.getTime() - chatStartTime.getTime()) / 1000
            );
            totalElapsedSeconds += chatDuration;
          }
          // Skip future chats that haven't started yet
        }
      } else {
        // Fallback to simple calculation if no chats available
        totalElapsedSeconds = Math.floor(
          (currentTime.getTime() - attemptStartTime.getTime()) / 1000
        );
      }

      // If current chat has ended, freeze the timer at the completion time
      if (currentChatEnded && currentChat?.completedAt) {
        // Timer is already frozen at the total elapsed time calculated above
        const frozenElapsedSeconds = totalElapsedSeconds;

        // Infinite mode uses attempt.infiniteMode and optional attempt.infiniteModeTimeLimit
        if (attempt.infiniteMode) {
          if (attempt.infiniteModeTimeLimit) {
            const totalTimeSeconds = attempt.infiniteModeTimeLimit * 60;
            const remainingSeconds = totalTimeSeconds - frozenElapsedSeconds;
            return {
              elapsedTime: frozenElapsedSeconds,
              timeRemaining: Math.max(remainingSeconds, 0),
            };
          }
          // No limit: count up only
          return { elapsedTime: frozenElapsedSeconds, timeRemaining: null };
        }

        // Normal mode uses simulation.timeLimit (can go negative for display)
        if (currentSimulation.timeLimit) {
          const totalTimeSeconds = currentSimulation.timeLimit * 60;
          const remainingSeconds = totalTimeSeconds - frozenElapsedSeconds;
          return {
            elapsedTime: frozenElapsedSeconds,
            timeRemaining: remainingSeconds,
          };
        }
        return { elapsedTime: frozenElapsedSeconds, timeRemaining: null };
      }

      // Infinite mode uses attempt.infiniteMode and optional attempt.infiniteModeTimeLimit
      if (attempt.infiniteMode) {
        if (attempt.infiniteModeTimeLimit) {
          const totalTimeSeconds = attempt.infiniteModeTimeLimit * 60;
          const remainingSeconds = totalTimeSeconds - totalElapsedSeconds;
          // Clamp to zero for display; we'll trigger results on expiry below
          return {
            elapsedTime: totalElapsedSeconds,
            timeRemaining: Math.max(remainingSeconds, 0),
          };
        }
        // No limit: count up only
        return { elapsedTime: totalElapsedSeconds, timeRemaining: null };
      }

      // Normal mode uses simulation.timeLimit (can go negative for display)
      if (currentSimulation.timeLimit) {
        const totalTimeSeconds = currentSimulation.timeLimit * 60;
        const remainingSeconds = totalTimeSeconds - totalElapsedSeconds;
        return {
          elapsedTime: totalElapsedSeconds,
          timeRemaining: remainingSeconds,
        };
      }
      return { elapsedTime: totalElapsedSeconds, timeRemaining: null };
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
    currentChat,
    isChatEnded,
    chats,
    currentChatIndex,
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
          handleSimulationCompletion();
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
    handleSimulationCompletion,
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
        handleSimulationCompletion();
      }
    }
  }, [chats, showResults, onSimulationFinished, handleSimulationCompletion]);

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
          handleSimulationCompletion();
        }
      }
    }
  }, [
    grades,
    feedbacks,
    chats,
    showResults,
    onSimulationFinished,
    handleSimulationCompletion,
  ]);

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
      if (!scenario?.departmentId) {
        toast.error("No department found. Please contact support.");
        return;
      }

      setIsSendingMessage(true);

      try {
        emitSendSimulationMessage({
          chat_id: currentChat.id,
          message: message,
          ...(isRetry && { isRetry }),
          department_id: scenario?.departmentId,
        });
      } catch (err) {
        toast.error(`Failed to send message: ${err}`);
        setIsSendingMessage(false); // Reset sending state on error
      }
      // Note: setIsSendingMessage(false) is handled by WebSocket event handlers
      // (handleSimulationMessageComplete, handleSimulationMessageCancelled, etc.)
      // to ensure proper state management with server responses
    },
    [
      currentChat,
      isSendingMessage,
      emitSendSimulationMessage,
      readOnly,
      scenario?.departmentId,
    ]
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
        // Optimistically update the chat's completedAt timestamp
        const completionTime = new Date().toISOString();
        queryClient.setQueryData(
          simulationChatKeysByAttemptId.one(attemptId),
          (old: SimulationChat[] = []) => {
            return old.map((chat) =>
              chat.id === targetChatId
                ? {
                    ...chat,
                    completedAt: completionTime,
                  }
                : chat
            );
          }
        );

        // Also update the database immediately for persistence
        try {
          await updateSimulationChatMutation.mutateAsync({
            id: targetChatId,
            completedAt: completionTime,
          });
        } catch (dbError) {
          log.error("chat.completion.db_update.failed", {
            message: "Failed to update chat completion in database",
            subject: { entityType: "simulation_chat", entityId: targetChatId },
            context: {
              component: "SimulationContext",
              function: "endChat",
              attemptId,
            },
            error: dbError,
          });
          // Continue with the flow even if DB update fails - backend will handle it
        }

        // Call backend with end_all=false for single chat ending
        emitContinueSimulation({
          chat_id: targetChatId,
          attempt_id: attemptId,
          end_all: false,
        });
      } catch (error) {
        // Revert the optimistic update on error
        queryClient.invalidateQueries({
          queryKey: simulationChatKeysByAttemptId.one(attemptId),
        });
        toast.error(`Failed to end chat: ${error}`);
        setEndChatLoading(false);
      }
    },
    [
      currentChat?.id,
      emitContinueSimulation,
      attemptId,
      readOnly,
      queryClient,
      updateSimulationChatMutation,
    ]
  );

  const endAllChats = useCallback(async () => {
    if (readOnly) return;
    if (!simulation || !attempt || !currentChat) return;

    setEndChatLoading(true);

    try {
      // Get all incomplete chats
      const incompleteChats = chats.filter((chat) => !chat.completed);
      const completionTime = new Date().toISOString();

      // Optimistically update all incomplete chats' completedAt timestamps
      queryClient.setQueryData(
        simulationChatKeysByAttemptId.one(attemptId),
        (old: SimulationChat[] = []) => {
          return old.map((chat) =>
            !chat.completed
              ? {
                  ...chat,
                  completedAt: completionTime,
                }
              : chat
          );
        }
      );

      // Also update the database immediately for persistence
      try {
        // Update each chat individually since there's no bulk update function
        await Promise.all(
          incompleteChats.map((chat) =>
            updateSimulationChatMutation.mutateAsync({
              id: chat.id,
              completedAt: completionTime,
            })
          )
        );
      } catch (dbError) {
        log.error("chat.completion.db_update.failed", {
          message: "Failed to update chat completions in database",
          subject: { entityType: "simulation_chat" },
          context: {
            component: "SimulationContext",
            function: "endAllChats",
            attemptId,
            chatCount: incompleteChats.length,
          },
          error: dbError,
        });
        // Continue with the flow even if DB update fails - backend will handle it
      }

      // Call backend with end_all=true to handle all remaining chats
      emitContinueSimulation({
        chat_id: currentChat.id,
        attempt_id: attemptId,
        end_all: true,
      });
    } catch (error) {
      // Revert the optimistic update on error
      queryClient.invalidateQueries({
        queryKey: simulationChatKeysByAttemptId.one(attemptId),
      });
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
    queryClient,
    chats,
    updateSimulationChatMutation,
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
            simulationMessageKeysByChatId.one(event.detail.chatId),
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
              queryKey: simulationMessageKeysByChatId.one(event.detail.chatId),
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
          simulationMessageKeysByChatId.one(event.detail.chatId),
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
          queryKey: simulationChatKeysByAttemptId.one(attemptId),
        });
        queryClient.invalidateQueries({
          queryKey: simulationAttemptKeys.detail(attemptId),
        });
        queryClient.invalidateQueries({
          queryKey: simulationChatGradeKeys.all,
        });
        queryClient.invalidateQueries({
          queryKey: simulationChatFeedbackKeys.all,
        });

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
          queryKey: simulationChatKeysByAttemptId.one(attemptId),
        });
        queryClient.invalidateQueries({
          queryKey: simulationAttemptKeys.detail(attemptId),
        });
        queryClient.invalidateQueries({
          queryKey: simulationChatGradeKeys.all,
        });
        queryClient.invalidateQueries({
          queryKey: simulationChatFeedbackKeys.all,
        });

        // Show results since all chats are now completed
        setShowResults(true);
        setIsActive(false);
        onSimulationFinished?.();
        setEndChatLoading(false);

        // Set viewedChat to true when simulation is completed
        handleSimulationCompletion();
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
  }, [
    queryClient,
    attemptId,
    onSimulationFinished,
    handleSimulationCompletion,
  ]); // Add queryClient, attemptId, onSimulationFinished, and handleSimulationCompletion to the dependency array

  // Listen for grading progress events
  useEffect(() => {
    const handleGradingProgress = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { type, chat_id, completed_count, total_count } =
        customEvent.detail;

      // Only process events for current chat
      if (chat_id !== currentChat?.id) return;

      if (
        type === "standard_graded" &&
        completed_count !== undefined &&
        total_count !== undefined
      ) {
        setIsGrading(true);
        setGradingProgress({
          completed: completed_count,
          total: total_count,
        });
        log.debug("grading.progress", {
          context: {
            chatId: chat_id,
            completed: completed_count,
            total: total_count,
            progress: `${completed_count}/${total_count}`,
          },
        });
      } else if (type === "complete") {
        // Reset grading state on completion
        setIsGrading(false);
        setGradingProgress(null);
        log.info("grading.complete", {
          context: { chatId: chat_id },
        });
      }
    };

    window.addEventListener("simulationGradingProgress", handleGradingProgress);

    return () => {
      window.removeEventListener(
        "simulationGradingProgress",
        handleGradingProgress
      );
    };
  }, [currentChat?.id]);

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
    gradingProgress,
    isGrading,

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
