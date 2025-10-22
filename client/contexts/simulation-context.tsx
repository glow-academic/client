/**
 * SimulationContext.tsx
 * Used to manage the simulation state. This will be used to create all the functions to call websocket events, and handle everything smoothly between all of the components.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import type { AttemptFullResponse } from "@/lib/api/v2/schemas/attempts";

import {
  useAttemptFull,
  useUpdateChatCompletedAt,
} from "@/lib/api/v2/hooks/attempts";
import { useLogger } from "@/lib/api/v2/hooks/logs";
import { attemptsFullKeys } from "@/lib/api/v2/keys";
import { SimulationItem } from "@/lib/api/v2/schemas/simulations";
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
import { useWebSocket } from "./websocket-context";

export interface SimulationContextType {
  // Raw attempt data for lookups
  attemptData: AttemptFullResponse | null;
  // Attempt and simulation data (exact types from AttemptFullResponse)
  attemptId: string;
  attempt: AttemptFullResponse["attempt"] | null;
  simulation: AttemptFullResponse["simulation"] | null;
  scenario: AttemptFullResponse["chats"][number]["scenario"];
  scenarioDocuments: AttemptFullResponse["scenarioDocuments"];

  // Attempt profiles (exact type from AttemptFullResponse)
  attemptProfiles: AttemptFullResponse["attemptProfiles"];
  attemptProfileId: string | null;

  // Scenarios map (chatId -> scenario) for all chats
  scenariosByChatId: Record<
    string,
    AttemptFullResponse["chats"][number]["scenario"]
  >;

  // Rubric structure (exact type from AttemptFullResponse)
  rubricStructure: AttemptFullResponse["rubricStructure"];

  // Grading states (exact type from AttemptFullResponse)
  gradingStatesByChatId: Record<
    string,
    NonNullable<AttemptFullResponse["chats"][number]["gradingState"]>
  >;

  // Current chat management
  currentChatIndex: number;
  setCurrentChatIndex: (index: number) => void;
  currentChat: AttemptFullResponse["chats"][number]["chat"] | null;
  chats: AttemptFullResponse["chats"][number]["chat"][];
  isLoadingChats: boolean;

  // Messages (exact type from AttemptFullResponse)
  currentMessages: AttemptFullResponse["chats"][number]["messages"];

  // Hints (exact type from AttemptFullResponse)
  currentChatHints: AttemptFullResponse["chats"][number]["hints"];

  // Results and grading (exact types from AttemptFullResponse)
  currentDynamicRubric: AttemptFullResponse["chats"][number]["dynamicRubric"];
  allDynamicRubrics: NonNullable<
    AttemptFullResponse["chats"][number]["dynamicRubric"]
  >[];
  aggregatedResults: AttemptFullResponse["aggregatedResults"];

  // Grading progress
  gradingProgress: {
    completed: number;
    total: number;
  } | null;
  isGrading: boolean;

  // Timer state (exact type from AttemptFullResponse)
  timer: AttemptFullResponse["timer"];
  isActive: boolean;

  // UI state
  showResults: boolean;
  isSingleChatAttempt: boolean;
  isLastAttempt: boolean;
  expectedChatCount: number;
  freshlyCompletedChats: Set<string>;
  setFreshlyCompletedChats: React.Dispatch<React.SetStateAction<Set<string>>>;

  // UI preferences that persist across chat switches
  showGrades: boolean;
  setShowGrades: (show: boolean) => void;
  showDocuments: boolean;
  setShowDocuments: (show: boolean) => void;
  userHasManuallyToggledGrades: boolean;
  setUserHasManuallyToggledGrades: (toggled: boolean) => void;

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
  const [showGrades, setShowGrades] = useState(false);
  const [showDocuments, setShowDocuments] = useState(true);
  const [userHasManuallyToggledGrades, setUserHasManuallyToggledGrades] =
    useState(false);

  // Grading progress state
  const [gradingProgress, setGradingProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [isGrading, setIsGrading] = useState(false);

  const queryClient = useQueryClient();
  const { mutateAsync: updateChatCompletedAt } = useUpdateChatCompletedAt();
  const currentRoomRef = useRef<string | null>(null);
  const currentChatIdRef = useRef<string | null>(null);
  const freshlyCompletedChatsRef = useRef<Set<string>>(new Set());
  const onSimulationFinishedRef = useRef(onSimulationFinished);
  const simulationRef = useRef<SimulationItem | null>(null);
  const pendingNextChatIdRef = useRef<string | null>(null);
  const log = useLogger();

  // Use the global WebSocket context
  const {
    isConnected,
    joinRoom,
    leaveRoom,
    emitSendSimulationMessage,
    emitStopSimulation,
    emitContinueSimulation,
  } = useWebSocket();

  // Function to set viewedChat to true when simulation is completed
  // NOTE: viewedChat is now handled by TATour component when step 4 completes
  const handleSimulationCompletion = useCallback(async () => {
    return; // viewedChat is now handled by TATour component
  }, []);

  // V2: Single hook to fetch all attempt data with server-side computations
  const { data: attemptData, isLoading: isLoadingChats } =
    useAttemptFull(attemptId);

  // Extract data from v2 response
  const chats = useMemo(
    () => attemptData?.chats.map((c) => c.chat) || [],
    [attemptData]
  );
  const attempt = attemptData?.attempt || null;
  const simulation = attemptData?.simulation || null;

  // Current chat based on index (client-controlled, defaults to server's suggestion)
  const currentChat = useMemo(() => {
    if (!attemptData?.chats || attemptData.chats.length === 0) return null;
    const chatData = attemptData.chats[currentChatIndex];
    return chatData?.chat || attemptData.chats[0]?.chat || null;
  }, [attemptData, currentChatIndex]);

  // Get scenario, documents from v2 data
  const scenario = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return null;
    const chatData = attemptData.chats.find(
      (c) => c.chat.id === currentChat.id
    );
    return chatData?.scenario || null;
  }, [attemptData, currentChat]);

  const scenarioDocuments = attemptData?.scenarioDocuments || [];
  const attemptProfiles = useMemo(
    () => attemptData?.attemptProfiles || [],
    [attemptData?.attemptProfiles]
  );
  const attemptProfileId = useMemo(() => {
    const activeProfile = attemptProfiles.find((ap) => ap.active);
    return activeProfile?.profileId || null;
  }, [attemptProfiles]);

  // Scenarios map from v2 - map chatId -> scenario for all chats
  const scenariosByChatId = useMemo(() => {
    if (!attemptData?.chats) return {};
    const map: Record<
      string,
      AttemptFullResponse["chats"][number]["scenario"]
    > = {};
    attemptData.chats.forEach((chatData) => {
      map[chatData.chat.id] = chatData.scenario;
    });
    return map;
  }, [attemptData]);

  // Rubric structure from v2
  const rubricStructure = attemptData?.rubricStructure || null;

  // Grading states map from v2 - map chatId -> grading state
  const gradingStatesByChatId = useMemo(() => {
    if (!attemptData?.chats) return {};
    const map: Record<
      string,
      NonNullable<AttemptFullResponse["chats"][number]["gradingState"]>
    > = {};
    attemptData.chats.forEach((chatData) => {
      if (chatData.gradingState) {
        map[chatData.chat.id] = chatData.gradingState;
      }
    });
    return map;
  }, [attemptData]);

  // Messages from v2 - get messages for current chat
  const currentMessages = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return [];
    const chatData = attemptData.chats.find(
      (c) => c.chat.id === currentChat.id
    );
    return chatData?.messages || [];
  }, [attemptData, currentChat]);

  // Hints from v2 - get hints for current chat
  const currentChatHints = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return [];
    const chatData = attemptData.chats.find(
      (c) => c.chat.id === currentChat.id
    );
    return chatData?.hints || [];
  }, [attemptData, currentChat]);

  // Get computed data from v2 response (server-side computations)
  const currentDynamicRubric = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return null;
    const chatData = attemptData.chats.find(
      (c) => c.chat.id === currentChat.id
    );
    return chatData?.dynamicRubric || null;
  }, [attemptData, currentChat]);

  const allDynamicRubrics = useMemo(
    () =>
      attemptData?.chats
        .map((c) => c.dynamicRubric)
        .filter(
          (
            r
          ): r is NonNullable<
            AttemptFullResponse["chats"][number]["dynamicRubric"]
          > => r !== null
        ) || [],
    [attemptData]
  );

  const aggregatedResults = attemptData?.aggregatedResults || null;

  // Metadata from v2
  const expectedChatCount = attemptData?.expectedChatCount || 1;
  const isSingleChatAttempt = attemptData?.isSingleChatAttempt ?? true;
  const isLastAttempt = attemptData?.isLastAttempt ?? true;

  // Timer from v2 (server computed)
  const timer: AttemptFullResponse["timer"] = attemptData?.timer || {
    elapsed: 0,
    remaining: null,
    expired: false,
  };

  // Update simulation ref when simulation changes
  useEffect(() => {
    simulationRef.current = (simulation as unknown as SimulationItem) || null;
  }, [simulation]);

  // Check if timer expired and finish simulation
  useEffect(() => {
    // Update the ref to the latest callback
    onSimulationFinishedRef.current = onSimulationFinished;

    // Check if timer expired and finish
    if (attemptData?.timer.expired && !showResults) {
      setShowResults(true);
      onSimulationFinishedRef.current?.();
    }
  }, [attemptData?.timer.expired, showResults, onSimulationFinished]);

  // Initialize to first incomplete chat when data loads
  useEffect(() => {
    if (chats && chats.length > 0 && currentChatIndex === 0) {
      const sortedChats = [...chats].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const firstIncompleteIndex = sortedChats.findIndex(
        (chat: AttemptFullResponse["chats"][number]["chat"]) => !chat.completed
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
        (chat: AttemptFullResponse["chats"][number]["chat"]) => chat.completed
      ).length;

      if (completedChats === totalExpectedChats) {
        setShowResults(true);
        onSimulationFinished?.();
        handleSimulationCompletion();
      }
    }
  }, [chats, showResults, onSimulationFinished, handleSimulationCompletion]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // Update the database immediately for persistence
        const completionTime = new Date().toISOString();
        try {
          await updateChatCompletedAt({
            chatId: targetChatId,
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
        // Invalidate to refetch on error
        queryClient.invalidateQueries({
          queryKey: attemptsFullKeys.all,
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
      updateChatCompletedAt,
      log,
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

      // Update the database immediately for persistence
      try {
        // Update each chat individually since there's no bulk update function
        await Promise.all(
          incompleteChats.map((chat) =>
            updateChatCompletedAt({
              chatId: chat.id,
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
      // Invalidate to refetch on error
      queryClient.invalidateQueries({
        queryKey: attemptsFullKeys.all,
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
    updateChatCompletedAt,
    log,
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
        // Reset loading states
        setIsSendingMessage(false);

        // Invalidate v2 attempts for fresh data
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: attemptsFullKeys.all,
          });
        }, 0);

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
    // Note: Real-time streaming is handled via window events and UI components
    // The query cache will be updated when the message is complete
    const handleSimulationMessageToken = (event: CustomEvent) => {
      // Token streaming is handled by UI components listening to window events
      // No need for optimistic updates here
      if (event.detail.chatId === currentChatIdRef.current) {
        // Streaming handled by AttemptMessages component
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

        // Invalidate v2 attempts to refetch everything
        queryClient.invalidateQueries({
          queryKey: attemptsFullKeys.all,
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
        // Invalidate v2 attempts to refetch everything
        queryClient.invalidateQueries({
          queryKey: attemptsFullKeys.all,
        });

        // Show results since all chats are now completed
        setShowResults(true);
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
    log,
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
  }, [currentChat?.id, log]);

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
  }, [chats, log]);

  const value: SimulationContextType = {
    // Raw attempt data for lookups
    attemptData: attemptData || null,
    // Data (from v2)
    attemptId,
    attempt: attempt,
    simulation: simulation,
    scenario: scenario,
    scenarioDocuments,

    // Attempt profiles (from v2)
    attemptProfiles,
    attemptProfileId,

    // Scenarios map (from v2)
    scenariosByChatId,

    // Rubric structure (from v2)
    rubricStructure,

    // Grading states (from v2)
    gradingStatesByChatId,

    // Current chat management
    currentChatIndex,
    setCurrentChatIndex,
    currentChat,
    chats,
    isLoadingChats,

    // Messages and hints (from v2)
    currentMessages,
    currentChatHints,

    // Results and grading (from v2 server-side computations)
    currentDynamicRubric,
    allDynamicRubrics,
    aggregatedResults,
    gradingProgress,
    isGrading,

    // Timer state (from v2 server-side computation)
    timer,
    isActive: attemptData?.isActive ?? true,

    // UI state (from v2 metadata)
    showResults: showResults || (attemptData?.showResults ?? false),
    isSingleChatAttempt,
    isLastAttempt,
    expectedChatCount,
    freshlyCompletedChats,
    setFreshlyCompletedChats,

    // UI preferences that persist across chat switches
    showGrades,
    setShowGrades,
    showDocuments,
    setShowDocuments,
    userHasManuallyToggledGrades,
    setUserHasManuallyToggledGrades,

    // Connection
    isConnected,

    // WebSocket operations (unchanged)
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
