/**
 * SimulationContext.tsx
 * Used to manage the simulation state. This will be used to create all the functions to call webRTC, and handle everything smoothly between all of the components.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import { SimulationChat } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { getSimulationChatsByAttempt } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempt";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useWebSocket } from "./websocket-context";

interface SimulationContextType {
  // Current chat management
  currentChatIndex: number;
  setCurrentChatIndex: (index: number) => void;
  currentChat: SimulationChat | null;
  chats: SimulationChat[];
  isLoadingChats: boolean;

  // Connection state
  isConnected: boolean;

  // WebSocket operations
  sendMessage: (message: string) => void;
  stopMessage: () => void;
  endChat: (attemptId: string) => void;

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

  // Chat completion tracking
  freshlyCompletedChats: Set<string>;
  setFreshlyCompletedChats: React.Dispatch<React.SetStateAction<Set<string>>>;
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
}

export function SimulationProvider({
  children,
  attemptId,
}: SimulationProviderProps) {
  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isStoppingMessage, setIsStoppingMessage] = useState(false);
  const [endChatLoading, setEndChatLoading] = useState(false);
  const [freshlyCompletedChats, setFreshlyCompletedChats] = useState<
    Set<string>
  >(new Set());

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

  // Get chats for the attempt
  const { data: chats = [], isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", attemptId],
    queryFn: () => getSimulationChatsByAttempt(attemptId),
    enabled: !!attemptId,
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

  // Join/leave chat rooms when currentChat changes - using global WebSocket
  useEffect(() => {
    if (!isConnected || !currentChat?.id) return;

    // Don't rejoin the same room
    if (currentRoomRef.current === currentChat.id) return;

    // Leave current room if we're in one
    if (currentRoomRef.current) {
      leaveRoom(currentRoomRef.current, "simulation");
    }

    // Join new room
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

  // Update the ref whenever currentChat changes and handle cleanup
  useEffect(() => {
    const newChatId = currentChat?.id || null;
    currentChatIdRef.current = newChatId;
  }, [currentChat?.id]);

  // WebSocket-based message handler using global context
  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || !currentChat || isSendingMessage) return;

      setIsSendingMessage(true);

      try {
        // Send message via global WebSocket context
        emitSendSimulationMessage({
          chat_id: currentChat.id,
          message: message,
        });

        // The response will be handled via WebSocket events in the global context
      } catch (err) {
        toast.error(`Failed to send message: ${err}`);
        setIsSendingMessage(false);
      }
    },
    [currentChat, isSendingMessage, emitSendSimulationMessage]
  );

  // Stop message function using global context
  const stopMessage = useCallback(async () => {
    if (!currentChat || isStoppingMessage) return;

    setIsStoppingMessage(true);

    try {
      // Send stop request via global WebSocket context
      emitStopSimulation({
        chat_id: currentChat.id,
      });

      // The WebSocket event will handle state updates
    } catch (error) {
      toast.error(`Failed to stop message: ${error}`);
      setIsStoppingMessage(false);
    }
  }, [currentChat, isStoppingMessage, emitStopSimulation]);

  const endChat = useCallback(
    async (attemptId: string) => {
      if (!currentChat) return;

      setEndChatLoading(true);

      try {
        // Send continue request via global WebSocket context
        emitContinueSimulation({
          chat_id: currentChat.id,
          attempt_id: attemptId,
        });

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
    },
    [currentChat, emitContinueSimulation, queryClient]
  );

  // WebRTC Audio handlers
  const startRecording = useCallback(async () => {
    if (!currentChat?.id || !isWebRTCSupported) return;

    try {
      setIsRecording(true);
      setIsTranscribing(false);
      setLastTranscription(null);
      setWebRtcError(null);
      // Show immediate feedback
      toast.success("Setting up audio connection...");
      // Success toast will be shown by the webrtcAudioStarted event
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
      setIsTranscribing(true); // Show that we're processing the audio
      // Don't immediately set recording to false - let the event handler do it
      // setIsRecording(false); // This will be handled by the event
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
        // The transcription will be automatically sent as a message by the server
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

    // Listen to WebSocket events via window events (emitted by websocket-context)
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
    currentChatIndex,
    setCurrentChatIndex,
    currentChat: currentChat || null,
    chats,
    isLoadingChats,
    isConnected,
    sendMessage,
    stopMessage,
    endChat,
    startRecording,
    stopRecording,
    isRecording,
    isTranscribing,
    webRtcError,
    lastTranscription,
    isWebRTCSupported,
    isSendingMessage,
    isStoppingMessage,
    endChatLoading,
    freshlyCompletedChats,
    setFreshlyCompletedChats,
  };

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}
