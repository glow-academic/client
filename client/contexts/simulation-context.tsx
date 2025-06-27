/**
 * SimulationContext.tsx
 * Used to manage the simulation state. This will be used to create all the functions to call webRTC, and handle everything smoothly between all of the components.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import {
  Class,
  Document,
  Scenario,
  Simulation,
  SimulationAttempt,
  SimulationChat,
} from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { getClass } from "@/utils/queries/classes/get-class";
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

interface SimulationContextType {
  // Attempt and simulation data
  attemptId: string;
  attempt: SimulationAttempt | null;
  simulation: Simulation | null;
  scenario: Scenario | null;
  classData: Class | null;
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
  expectedChatCount: number;
  freshlyCompletedChats: Set<string>;
  setFreshlyCompletedChats: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Connection state
  isConnected: boolean;

  // WebSocket operations
  sendMessage: (message: string) => void;
  stopMessage: () => void;
  endChat: () => void;

  // WebRTC Audio operations
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: boolean;
  isTranscribing: boolean;
  webRtcError: string | null;
  lastTranscription: string | null;
  isWebRTCSupported: boolean;

  // Loading states
  isSendingMessage: boolean;
  isStoppingMessage: boolean;
  endChatLoading: boolean;

  // Event handlers
  onSimulationFinished?: (() => void) | undefined;
}

const SimulationContext = createContext<SimulationContextType | null>(null);

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation must be used within SimulationProvider");
  }
  return context;
};

interface SimulationProviderProps {
  children: React.ReactNode;
  attemptId: string;
  onSimulationFinished?: () => void;
}

export function SimulationProvider({
  children,
  attemptId,
  onSimulationFinished,
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

  // WebRTC Audio state
  const [isRecording, setIsRecording] = useState(false);
  const [webRtcError, setWebRtcError] = useState<string | null>(null);
  const [lastTranscription, setLastTranscription] = useState<string | null>(
    null
  );
  const [isTranscribing, setIsTranscribing] = useState(false);

  const queryClient = useQueryClient();
  const currentRoomRef = useRef<string | null>(null);
  const currentChatIdRef = useRef<string | null>(null);

  // Use the global WebSocket context
  const {
    isConnected,
    joinRoom,
    leaveRoom,
    emitSendSimulationMessage,
    emitStopSimulation,
    emitContinueSimulation,
    isWebRTCSupported,
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

  // Fetch class data for current scenario
  const { data: classData } = useQuery({
    queryKey: ["class", scenario?.classId],
    queryFn: () => getClass(scenario!.classId!),
    enabled: !!scenario?.classId,
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
      scenario.documents?.includes(doc.id)
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

  // Timer calculation
  const timer = useMemo((): TimerState => {
    return {
      elapsed: elapsedTime,
      remaining: timeRemaining,
      expired: simulation?.timeLimit ? timeRemaining === 0 : false,
    };
  }, [elapsedTime, timeRemaining, simulation?.timeLimit]);

  // Timer logic - Update timer values every second based on actual attempt creation timestamp
  useEffect(() => {
    if (!attempt?.createdAt || !simulation || showResults) return;

    const calculateTimerValues = () => {
      const attemptStartTime = new Date(attempt.createdAt);
      const currentTime = new Date();
      const elapsedSeconds = Math.floor(
        (currentTime.getTime() - attemptStartTime.getTime()) / 1000
      );

      if (simulation.timeLimit) {
        const totalTimeSeconds = simulation.timeLimit * 60;
        const remainingSeconds = Math.max(0, totalTimeSeconds - elapsedSeconds);
        return { elapsedTime: elapsedSeconds, timeRemaining: remainingSeconds };
      } else {
        return { elapsedTime: elapsedSeconds, timeRemaining: null };
      }
    };

    const { elapsedTime: initialElapsed, timeRemaining: initialRemaining } =
      calculateTimerValues();
    setElapsedTime(initialElapsed);
    setTimeRemaining(initialRemaining);

    if (simulation.timeLimit && initialRemaining === 0) {
      setIsActive(false);
      setShowResults(true);
      toast.success(
        isSingleChatAttempt ? "Session completed!" : "Attempt completed!"
      );
      onSimulationFinished?.();
      return;
    }

    const timerInterval = setInterval(() => {
      const { elapsedTime: newElapsed, timeRemaining: newRemaining } =
        calculateTimerValues();
      setElapsedTime(newElapsed);
      setTimeRemaining(newRemaining);

      if (simulation.timeLimit && newRemaining === 0 && isActive) {
        setIsActive(false);
        setShowResults(true);
        toast.success(
          isSingleChatAttempt ? "Session completed!" : "Attempt completed!"
        );
        onSimulationFinished?.();
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [
    attempt?.createdAt,
    simulation?.timeLimit,
    showResults,
    isActive,
    isSingleChatAttempt,
    simulation,
    onSimulationFinished,
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
      const isFreshlyCompleted = freshlyCompletedChats.has(currentChat.id);

      if (isFreshlyCompleted) {
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
    }

    return () => {
      if (timerTimeout) clearTimeout(timerTimeout);
      setFreshlyCompletedChats(new Set());
    };
  }, [
    currentChat?.completed,
    currentChat?.id,
    currentChatIndex,
    chats?.length,
    showResults,
    isSingleChatAttempt,
    freshlyCompletedChats,
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
          onSimulationFinished?.();
        }
      }
    }
  }, [chats, showResults, grades, feedbacks, onSimulationFinished]);

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

    logInfo(`Joined simulation chat room: ${currentChat.id}`);

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
    async (message: string) => {
      if (!message.trim() || !currentChat || isSendingMessage) return;

      setIsSendingMessage(true);

      try {
        emitSendSimulationMessage({
          chat_id: currentChat.id,
          message: message,
        });
      } catch (err) {
        toast.error(`Failed to send message: ${err}`);
        setIsSendingMessage(false);
      }
    },
    [currentChat, isSendingMessage, emitSendSimulationMessage]
  );

  // Stop message function
  const stopMessage = useCallback(async () => {
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
  }, [currentChat, isStoppingMessage, emitStopSimulation]);

  const endChat = useCallback(async () => {
    if (!currentChat) return;

    setEndChatLoading(true);

    try {
      emitContinueSimulation({
        chat_id: currentChat.id,
        attempt_id: attemptId,
      });

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
  }, [currentChat, emitContinueSimulation, queryClient, attemptId]);

  // WebRTC Audio handlers
  const startRecording = useCallback(async () => {
    if (!currentChat?.id || !isWebRTCSupported) return;

    try {
      setIsRecording(true);
      setIsTranscribing(false);
      setLastTranscription(null);
      setWebRtcError(null);
      toast.success("Setting up audio connection...");
    } catch (error) {
      setIsRecording(false);
      setIsTranscribing(false);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start recording";
      setWebRtcError(errorMessage);
      toast.error(`Failed to start audio recording: ${errorMessage}`);
    }
  }, [currentChat?.id, isWebRTCSupported]);

  const stopRecording = useCallback(async () => {
    if (!currentChat?.id) return;

    try {
      setIsTranscribing(true);
    } catch (error) {
      setIsRecording(false);
      setIsTranscribing(false);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to stop recording";
      toast.error(`Failed to stop audio recording: ${errorMessage}`);
    }
  }, [currentChat?.id]);

  // Listen for WebRTC events
  useEffect(() => {
    const handleWebRtcSetupStarted = (event: CustomEvent) => {
      if (event.detail.chatId === currentChat?.id) {
        setIsRecording(true);
        setWebRtcError(null);
        logInfo(`WebRTC setup started for chat ${event.detail.chatId}`);
      }
    };

    const handleWebRtcAudioStarted = (event: CustomEvent) => {
      if (event.detail.chatId === currentChat?.id) {
        setIsRecording(true);
        setWebRtcError(null);
        toast.success("🎤 Audio recording active - speak now!");
        logInfo(`WebRTC audio started for chat ${event.detail.chatId}`);
      }
    };

    const handleWebRtcAudioStopped = (event: CustomEvent) => {
      if (event.detail.chatId === currentChat?.id) {
        setIsRecording(false);
        setIsTranscribing(false);
        setLastTranscription(null);
        logInfo(`WebRTC audio stopped for chat ${event.detail.chatId}`);
      }
    };

    const handleWebRtcAudioError = (event: CustomEvent) => {
      if (event.detail.chatId === currentChat?.id) {
        setIsRecording(false);
        setIsTranscribing(false);
        setWebRtcError(event.detail.error);
        toast.error(`Audio error: ${event.detail.error}`);
        logError(
          `WebRTC audio error for chat ${event.detail.chatId}`,
          event.detail.error
        );
      }
    };

    const handleWebRtcConnectionFailed = (event: CustomEvent) => {
      if (event.detail.chatId === currentChat?.id) {
        setIsRecording(false);
        setIsTranscribing(false);
        setWebRtcError("WebRTC connection failed");
        toast.error("Audio connection failed - please try again");
        logError(`WebRTC connection failed for chat ${event.detail.chatId}`);
      }
    };

    const handleWebRtcAudioTranscribed = (event: CustomEvent) => {
      if (event.detail.chatId === currentChat?.id) {
        setIsTranscribing(false);
        setLastTranscription(event.detail.transcribedText);
        logInfo(
          `WebRTC audio transcribed for chat ${event.detail.chatId}: ${event.detail.transcribedText}`
        );
      }
    };

    window.addEventListener(
      "webrtcSetupStarted",
      handleWebRtcSetupStarted as EventListener
    );
    window.addEventListener(
      "webrtcAudioStarted",
      handleWebRtcAudioStarted as EventListener
    );
    window.addEventListener(
      "webrtcAudioStopped",
      handleWebRtcAudioStopped as EventListener
    );
    window.addEventListener(
      "webrtcAudioError",
      handleWebRtcAudioError as EventListener
    );
    window.addEventListener(
      "webrtcConnectionFailed",
      handleWebRtcConnectionFailed as EventListener
    );
    window.addEventListener(
      "webrtcAudioTranscribed",
      handleWebRtcAudioTranscribed as EventListener
    );

    return () => {
      window.removeEventListener(
        "webrtcSetupStarted",
        handleWebRtcSetupStarted as EventListener
      );
      window.removeEventListener(
        "webrtcAudioStarted",
        handleWebRtcAudioStarted as EventListener
      );
      window.removeEventListener(
        "webrtcAudioStopped",
        handleWebRtcAudioStopped as EventListener
      );
      window.removeEventListener(
        "webrtcAudioError",
        handleWebRtcAudioError as EventListener
      );
      window.removeEventListener(
        "webrtcConnectionFailed",
        handleWebRtcConnectionFailed as EventListener
      );
      window.removeEventListener(
        "webrtcAudioTranscribed",
        handleWebRtcAudioTranscribed as EventListener
      );
    };
  }, [currentChat?.id]);

  // Listen for WebSocket loading state changes
  useEffect(() => {
    const handleSimulationMessageStart = (event: CustomEvent) => {
      if (event.detail.chatId === currentChatIdRef.current) {
        setIsSendingMessage(true);
      }
    };

    const handleSimulationMessageComplete = (event: CustomEvent) => {
      if (event.detail.chatId === currentChatIdRef.current) {
        setIsSendingMessage(false);
      }
    };

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

    const handleSimulationContinued = (event: CustomEvent) => {
      if (event.detail.chatId === currentChatIdRef.current) {
        setEndChatLoading(false);
      }
    };

    const handleSimulationError = (event: CustomEvent) => {
      if (event.detail.chatId === currentChatIdRef.current) {
        setIsSendingMessage(false);
        setIsStoppingMessage(false);
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
    window.addEventListener(
      "simulationContinued",
      handleSimulationContinued as EventListener
    );
    window.addEventListener(
      "simulationError",
      handleSimulationError as EventListener
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
        "simulationContinued",
        handleSimulationContinued as EventListener
      );
      window.removeEventListener(
        "simulationError",
        handleSimulationError as EventListener
      );
    };
  }, []);

  const value: SimulationContextType = {
    // Data
    attemptId,
    attempt: attempt || null,
    simulation: simulation || null,
    scenario: scenario || null,
    classData: classData || null,
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
    expectedChatCount,
    freshlyCompletedChats,
    setFreshlyCompletedChats,

    // Connection
    isConnected,

    // WebSocket operations
    sendMessage,
    stopMessage,
    endChat,

    // WebRTC Audio operations
    startRecording,
    stopRecording,
    isRecording,
    isTranscribing,
    webRtcError,
    lastTranscription,
    isWebRTCSupported,

    // Loading states
    isSendingMessage,
    isStoppingMessage,
    endChatLoading,

    // Event handlers
    onSimulationFinished,
  };

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}
