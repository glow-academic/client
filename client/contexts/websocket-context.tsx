/**
 * Global WebSocket Context for managing a single WebSocket connection
 * This provides a centralized way to manage WebSocket connections and events
 * across all components based on the user's profile ID
 */
"use client";

import { getApiBase } from "@/lib/api-base";
import { AssistantChat, AssistantMessage, SimulationMessage } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

interface WebSocketContextType {
  // Connection state
  isConnected: boolean;
  socket: Socket | null;

  // WebRTC state
  isWebRTCConnected: boolean;
  webRTCConnectionState: string;
  isWebRTCSupported: boolean;

  // Loading states for debugging
  isStartingSimulation: boolean;
  isSendingSimulationMessage: boolean;
  isStoppingSimulation: boolean;
  isContinuingSimulation: boolean;
  isStartingAssistant: boolean;
  isSendingAssistantMessage: boolean;
  isStoppingAssistant: boolean;

  // Room management
  joinRoom: (roomId: string, roomType: "assistant" | "simulation") => void; // should create webRTC data channel (for text) and optionally media channel (for audio, for simulation only)
  leaveRoom: (roomId: string, roomType: "assistant" | "simulation") => void; // should close webRTC data channel (for text) and optionally media channel (for audio, for simulation only)

  // WebRTC Emitters
  sendWebRTCMessage: (
    chatId: string,
    message: string,
    assistantAudioEnabled?: boolean
  ) => void;
  startAudioStream: (
    chatId: string,
    assistantAudioEnabled?: boolean
  ) => Promise<void>;
  stopAudioStream: (chatId: string) => void;
  playRemoteAudio: () => Promise<void>;
  testAndEnableAudio: () => Promise<void>;

  // User audio stream for waveform visualization
  userAudioStream: MediaStream | null;

  // Simulation event emitters
  emitStartSimulation: (data: {
    simulation_id: string;
    profile_id: string;
  }) => void;
  emitSendSimulationMessage: (data: {
    chat_id: string;
    message: string; // sending a message here would be fallback if webRTC is not supported.
    assistant_audio_enabled?: boolean;
  }) => void; // this should be modified to send over webRTC data channel (for text)
  emitStopSimulation: (data: { chat_id: string }) => void;
  emitContinueSimulation: (data: {
    chat_id: string;
    attempt_id: string;
  }) => void;

  // Assistant event emitters
  emitStartAssistant: (data: {
    chat_id: string;
    initial_message: string;
  }) => void;
  emitSendAssistantMessage: (data: {
    chat_id: string;
    message: string; // sending a message here would be fallback if webRTC is not supported.
  }) => void; // this should be modified to send over webRTC data channel (for text)
  emitStopAssistant: (data: { chat_id: string }) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
};

interface WebSocketProviderProps {
  children: React.ReactNode;
  profileId?: string | undefined;
}

// Connection Status Indicator Component
function ConnectionStatusIndicator({
  wsConnected,
  webRTCConnected,
}: {
  wsConnected: boolean;
  webRTCConnected: boolean;
}) {
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2">
      <div
        className={`px-3 py-1 rounded-full text-xs font-medium shadow-lg transition-all duration-300 ${
          wsConnected
            ? "bg-green-100 text-green-800 border border-green-200"
            : "bg-red-100 text-red-800 border border-red-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              wsConnected ? "bg-green-500" : "bg-red-500"
            } ${wsConnected ? "animate-pulse" : ""}`}
          />
          {wsConnected ? "WebSocket Connected" : "WebSocket Disconnected"}
        </div>
      </div>
      <div
        className={`px-3 py-1 rounded-full text-xs font-medium shadow-lg transition-all duration-300 ${
          webRTCConnected
            ? "bg-green-100 text-green-800 border border-green-200"
            : "bg-red-100 text-red-800 border border-red-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              webRTCConnected ? "bg-green-500" : "bg-red-500"
            } ${webRTCConnected ? "animate-pulse" : ""}`}
          />
          {webRTCConnected ? "WebRTC Connected" : "WebRTC Disconnected"}
        </div>
      </div>
    </div>
  );
}

// ADD THIS HELPER FUNCTION
// Creates a short, silent audio buffer. This is a reliable way to
// get audio playback consent from the browser without needing an MP3 file.
const createSilentAudio = (context: AudioContext) => {
  const buffer = context.createBuffer(1, 1, 22050);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  return source;
};

export function WebSocketProvider({
  children,
  profileId,
}: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const connectionAttempts = useRef(0);
  const maxConnectionAttempts = 5;
  const currentRoomsRef = useRef<Set<string>>(new Set());

  // Loading states for debugging
  const [isStartingSimulation, setIsStartingSimulation] = useState(false);
  const [isSendingSimulationMessage, setIsSendingSimulationMessage] =
    useState(false);
  const [isStoppingSimulation, setIsStoppingSimulation] = useState(false);
  const [isContinuingSimulation, setIsContinuingSimulation] = useState(false);
  const [isStartingAssistant, setIsStartingAssistant] = useState(false);
  const [isSendingAssistantMessage, setIsSendingAssistantMessage] =
    useState(false);
  const [isStoppingAssistant, setIsStoppingAssistant] = useState(false);

  // WebRTC state with connection tracking
  const [isWebRTCConnected, setIsWebRTCConnected] = useState(false);
  const [webRTCConnectionState, setWebRTCConnectionState] = useState("new");
  const [isWebRTCSupported, setIsWebRTCSupported] = useState(false);
  const webRTCPeerConnection = useRef<RTCPeerConnection | null>(null);
  const webRTCDataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const userMediaStream = useRef<MediaStream | null>(null);
  const audioTrackSenders = useRef<Map<string, RTCRtpSender>>(new Map());
  const remoteAudioStreams = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Message queues for data channels (text messages)
  const messageQueues = useRef<Map<string, string[]>>(new Map());

  // State to hold the user audio stream for waveform visualization
  const [userAudioStream, setUserAudioStream] = useState<MediaStream | null>(
    null
  );

  // Connection state persistence to prevent React re-render triggers
  const currentConnectionId = useRef<string | null>(null);
  const webRTCRetryCount = useRef(0);
  const maxWebRTCRetries = 3;
  const webRTCStartDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const lastPongReceived = useRef<number>(Date.now());

  // Check if WebRTC is supported
  useEffect(() => {
    setIsWebRTCSupported(
      typeof RTCPeerConnection !== "undefined" &&
        typeof RTCDataChannel !== "undefined"
    );
  }, []);

  // Create data channels for text messaging and process queued messages when they open
  const createDataChannelIfNeeded = useCallback(
    (channelLabel: string): RTCDataChannel | undefined => {
      const pc = webRTCPeerConnection.current;
      if (!pc) {
        logError("Cannot create data channel, PeerConnection is null.");
        return undefined;
      }
      // Allow channel creation even if PC isn't fully "connected" yet, as long as it's not closed.
      if (pc.connectionState === "closed" || pc.connectionState === "failed") {
        logError(
          `Cannot create data channel, PeerConnection is in state: ${pc.connectionState}`
        );
        return undefined;
      }

      let channel = webRTCDataChannels.current.get(channelLabel);
      if (!channel || channel.readyState === "closed") {
        channel = pc.createDataChannel(channelLabel, { ordered: true });
        logInfo(`Created WebRTC data channel: ${channelLabel}`);

        channel.onopen = () => {
          logInfo(`WebRTC data channel opened: ${channelLabel}`);
          // Now that it's open, drain any messages that were queued for it
          const queue = messageQueues.current.get(channelLabel);
          if (queue && queue.length > 0) {
            logInfo(
              `Draining ${queue.length} queued messages for ${channelLabel}`
            );
            queue.forEach((msg) => {
              if (channel && channel.readyState === "open") {
                channel.send(msg);
              }
            });
            messageQueues.current.delete(channelLabel); // Clear the queue
          }
        };

        // Handle incoming messages on data channels
        channel.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            logInfo(
              `Received data channel message: ${data.type} for ${channelLabel}`
            );

            // Route data channel messages to appropriate handlers
            if (data.type === "token") {
              // Reuse existing token handling logic
              window.dispatchEvent(
                new CustomEvent("simulationMessageToken", {
                  detail: {
                    messageId: data.message_id,
                    chatId: data.chat_id,
                    token: data.token,
                    accumulatedContent: data.accumulated_content,
                  },
                })
              );
            } else if (data.type === "complete") {
              // Reuse existing completion handling logic
              window.dispatchEvent(
                new CustomEvent("simulationMessageComplete", {
                  detail: {
                    messageId: data.message_id,
                    chatId: data.chat_id,
                    finalContent: data.final_content,
                    audio: data.audio,
                  },
                })
              );
            } else {
              logInfo("Unknown data channel payload type:", data.type);
            }
          } catch (error) {
            logError("Error parsing data channel message:", error);
          }
        };

        channel.onclose = () => {
          logInfo(`WebRTC data channel closed: ${channelLabel}`);
          webRTCDataChannels.current.delete(channelLabel);
          // Clean up any pending messages for this channel
          messageQueues.current.delete(channelLabel);
        };

        channel.onerror = (error) => {
          logError(`WebRTC data channel error for ${channelLabel}`, error);
        };

        webRTCDataChannels.current.set(channelLabel, channel);
      }
      return channel;
    },
    []
  );

  // Set up section-specific event handlers
  const setupCommonEventHandlers = useCallback(
    (socket: Socket) => {
      // Assistant-specific message events
      socket.on(
        "assistant_new_message",
        (data: {
          message_id: string;
          chat_id: string;
          role: string;
          content: string;
          completed: boolean;
          created_at: string;
        }) => {
          logInfo("Received assistant_new_message event", {
            messageId: data.message_id,
            chatId: data.chat_id,
            role: data.role,
          });

          queryClient.setQueryData(
            ["assistantMessages", data.chat_id],
            (old: AssistantMessage[] = []) => {
              const exists = old.find((msg) => msg.id === data.message_id);
              if (exists) return old;

              const newMessage = {
                id: data.message_id,
                chatId: data.chat_id,
                role: data.role,
                content: data.content,
                completed: data.completed,
                createdAt: data.created_at,
                updatedAt: data.created_at,
                completedAt: data.created_at,
              };

              return [...old, newMessage].sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              );
            }
          );

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
            });
          }, 0);
        }
      );

      // Simulation-specific message events
      socket.on(
        "simulation_new_message",
        (data: {
          message_id: string;
          chat_id: string;
          role: string;
          content: string;
          completed: boolean;
          created_at: string;
        }) => {
          logInfo("Received simulation_new_message event", {
            messageId: data.message_id,
            chatId: data.chat_id,
            role: data.role,
          });

          queryClient.setQueryData(
            ["simulationMessages", data.chat_id],
            (old: SimulationMessage[] = []) => {
              const exists = old.find((msg) => msg.id === data.message_id);
              if (exists) return old;

              const newMessage = {
                id: data.message_id,
                chatId: data.chat_id,
                type: data.role === "user" ? "query" : "response",
                content: data.content,
                completed: data.completed,
                createdAt: data.created_at,
                audio: false,
                filePath: null,
              };

              return [...old, newMessage].sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              );
            }
          );

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", data.chat_id],
            });
          }, 0);
        }
      );

      // Assistant message token updates
      socket.on(
        "assistant_message_token",
        (data: {
          message_id: string;
          chat_id: string;
          accumulated_content: string;
        }) => {
          logInfo("Received assistant_message_token event", {
            messageId: data.message_id,
            chatId: data.chat_id,
          });

          queryClient.setQueryData(
            ["assistantMessages", data.chat_id],
            (old: AssistantMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id
                  ? { ...msg, content: data.accumulated_content }
                  : msg
              );
            }
          );

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
            });
          }, 0);
        }
      );

      // Simulation message token updates
      socket.on(
        "simulation_message_token",
        (data: {
          message_id: string;
          chat_id: string;
          token: string;
          accumulated_content: string;
        }) => {
          logInfo("Received simulation_message_token event", {
            messageId: data.message_id,
            chatId: data.chat_id,
          });

          queryClient.setQueryData(
            ["simulationMessages", data.chat_id],
            (old: SimulationMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id
                  ? { ...msg, content: data.accumulated_content }
                  : msg
              );
            }
          );

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", data.chat_id],
            });
          }, 0);
        }
      );

      // Assistant message completion
      socket.on(
        "assistant_message_complete",
        (data: {
          message_id: string;
          chat_id: string;
          final_content: string;
          completed?: boolean;
        }) => {
          logInfo("Received assistant_message_complete event", {
            messageId: data.message_id,
            chatId: data.chat_id,
          });

          queryClient.setQueryData(
            ["assistantMessages", data.chat_id],
            (old: AssistantMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id
                  ? { ...msg, content: data.final_content, completed: true }
                  : msg
              );
            }
          );

          // Reset loading states
          setIsSendingAssistantMessage(false);

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
            });
          }, 0);
        }
      );

      // Assistant message cancellation
      socket.on(
        "assistant_message_cancelled",
        (data: {
          message_id: string;
          chat_id: string;
          final_content: string;
        }) => {
          logInfo("Received assistant_message_cancelled event", {
            messageId: data.message_id,
            chatId: data.chat_id,
          });

          queryClient.setQueryData(
            ["assistantMessages", data.chat_id],
            (old: AssistantMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id
                  ? { ...msg, content: data.final_content, completed: true }
                  : msg
              );
            }
          );

          // Reset loading states
          setIsSendingAssistantMessage(false);
          setIsStoppingAssistant(false);

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
            });
          }, 0);
        }
      );

      // Simulation message completion
      socket.on(
        "simulation_message_complete",
        (data: {
          message_id: string;
          chat_id: string;
          final_content: string;
          completed?: boolean;
        }) => {
          logInfo("Received simulation_message_complete event", {
            messageId: data.message_id,
            chatId: data.chat_id,
          });

          queryClient.setQueryData(
            ["simulationMessages", data.chat_id],
            (old: SimulationMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id
                  ? { ...msg, content: data.final_content, completed: true }
                  : msg
              );
            }
          );

          // Reset loading states
          setIsSendingSimulationMessage(false);

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", data.chat_id],
            });
          }, 0);
        }
      );

      // Simulation message cancellation
      socket.on(
        "simulation_message_cancelled",
        (data: {
          message_id: string;
          chat_id: string;
          final_content: string;
        }) => {
          logInfo("Received simulation_message_cancelled event", {
            messageId: data.message_id,
            chatId: data.chat_id,
          });

          queryClient.setQueryData(
            ["simulationMessages", data.chat_id],
            (old: SimulationMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id
                  ? { ...msg, content: data.final_content, completed: true }
                  : msg
              );
            }
          );

          // Reset loading states
          setIsSendingSimulationMessage(false);
          setIsStoppingSimulation(false);

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", data.chat_id],
            });
          }, 0);
        }
      );

      // Simulation message error
      socket.on(
        "simulation_message_error",
        (data: { chat_id: string; error: string }) => {
          logError("Received simulation_message_error event", {
            chatId: data.chat_id,
            error: data.error,
          });

          // Reset loading states
          setIsSendingSimulationMessage(false);
          setIsStoppingSimulation(false);

          toast.error(`Simulation error: ${data.error}`);
        }
      );

      // WebRTC Audio Transcription Event
      socket.on(
        "webrtc_audio_transcribed",
        (data: {
          chat_id: string;
          transcribed_text: string;
          status: string;
        }) => {
          logInfo("Received webrtc_audio_transcribed event", {
            chatId: data.chat_id,
            transcribedText: data.transcribed_text,
            status: data.status,
          });

          // Show the transcribed text to the user with a toast
          toast.success(`🎤 Transcribed: "${data.transcribed_text}"`);

          // Dispatch custom event for components that need to show transcription
          window.dispatchEvent(
            new CustomEvent("webrtcAudioTranscribed", {
              detail: {
                chatId: data.chat_id,
                transcribedText: data.transcribed_text,
                status: data.status,
              },
            })
          );
        }
      );

      socket.on(
        "message_cancelled",
        (data: { message_id: string; chat_id: string }) => {
          logInfo("Received message_cancelled event", {
            messageId: data.message_id,
            chatId: data.chat_id,
          });

          // Update both caches
          queryClient.setQueryData(
            ["assistantMessages", data.chat_id],
            (old: AssistantMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id ? { ...msg, completed: true } : msg
              );
            }
          );

          queryClient.setQueryData(
            ["simulationMessages", data.chat_id],
            (old: SimulationMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id ? { ...msg, completed: true } : msg
              );
            }
          );

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", data.chat_id],
            });
          }, 0);
        }
      );

      socket.on("title_updated", (data: { chat_id: string; title: string }) => {
        logInfo("Received title_updated event", {
          chatId: data.chat_id,
          title: data.title,
        });

        queryClient.setQueryData(
          ["assistantChat", data.chat_id],
          (old: AssistantChat) => {
            if (old) {
              return { ...old, title: data.title };
            }
            return old;
          }
        );

        queryClient.setQueryData(
          ["assistantChats", profileId],
          (old: AssistantChat[] = []) => {
            return old.map((chat) =>
              chat.id === data.chat_id ? { ...chat, title: data.title } : chat
            );
          }
        );
      });

      socket.on(
        "joined_chat",
        (data: { chat_type: string; chat_id: string }) => {
          logInfo(
            `Successfully joined ${data.chat_type} chat: ${data.chat_id}`
          );
        }
      );

      // Tool call events
      socket.on(
        "tool_call_created",
        (data: { tool_name: string; chat_id: string }) => {
          logInfo(
            `Tool call created: ${data.tool_name} for chat ${data.chat_id}`
          );
          queryClient.invalidateQueries({
            queryKey: ["assistantToolCalls", data.chat_id],
          });
        }
      );

      socket.on(
        "tool_call_completed",
        (data: { tool_name: string; chat_id: string }) => {
          logInfo(
            `Tool call completed: ${data.tool_name} for chat ${data.chat_id}`
          );
          queryClient.invalidateQueries({
            queryKey: ["assistantToolCalls", data.chat_id],
          });
        }
      );

      // Simulation-specific events
      socket.on(
        "simulation_started",
        (data: {
          success: boolean;
          message: string;
          attempt_id: string;
          chat_id: string;
        }) => {
          logInfo("Simulation started", data);
          setIsStartingSimulation(false);
          if (data.success) {
            toast.success(data.message);
            // Trigger navigation by emitting a custom event
            window.dispatchEvent(
              new CustomEvent("simulationStarted", {
                detail: { attemptId: data.attempt_id },
              })
            );
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "simulation_message_processing",
        (data: { chat_id: string; status: string; message: string }) => {
          logInfo("Simulation message processing", data);
        }
      );

      socket.on(
        "simulation_stopped",
        (data: { chat_id: string; success: boolean; message: string }) => {
          logInfo("Simulation stopped", data);
          setIsStoppingSimulation(false);
          if (data.success) {
            toast.success(data.message);
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "simulation_continued",
        (data: {
          success: boolean;
          message: string;
          completed_chat_id: string;
          next_chat_id: string;
          is_attempt_finished: boolean;
        }) => {
          logInfo("Simulation continued", data);
          setIsContinuingSimulation(false);

          if (data.success) {
            toast.success(data.message);
            // Dispatch a custom event with the new, richer detail object
            window.dispatchEvent(
              new CustomEvent("simulationChatEnded", {
                detail: {
                  completedChatId: data.completed_chat_id,
                  nextChatId: data.next_chat_id,
                  isAttemptFinished: data.is_attempt_finished,
                },
              })
            );
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "simulation_error",
        (data: { success: boolean; message: string }) => {
          logError("Simulation error", data.message);
          setIsStartingSimulation(false);
          setIsSendingSimulationMessage(false);
          setIsStoppingSimulation(false);
          setIsContinuingSimulation(false);
          toast.error(data.message);
          // Trigger error event for components that need to reset state
          window.dispatchEvent(new CustomEvent("simulationError"));
        }
      );

      // Assistant-specific events
      socket.on(
        "assistant_started",
        (data: { success: boolean; message: string; chat_id: string }) => {
          logInfo("Assistant started", data);
          setIsStartingAssistant(false);
          if (data.success) {
            toast.success(data.message);
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "assistant_message_processing",
        (data: { chat_id: string; status: string; message: string }) => {
          logInfo("Assistant message processing", data);
        }
      );

      socket.on(
        "assistant_stopped",
        (data: { chat_id: string; success: boolean; message: string }) => {
          logInfo("Assistant stopped", data);
          setIsStoppingAssistant(false);
          if (data.success) {
            toast.success(data.message);
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "assistant_error",
        (data: { success: boolean; message: string }) => {
          logError("Assistant error", data.message);
          setIsStartingAssistant(false);
          setIsSendingAssistantMessage(false);
          setIsStoppingAssistant(false);
          toast.error(data.message);
        }
      );

      // WebRTC event handlers
      socket.on(
        "webrtc_offer",
        async (data: {
          profile_id: string;
          connection_id: string;
          offer: { sdp: string; type: string };
          ice_config: RTCIceServer[];
        }) => {
          logInfo("Received WebRTC offer", {
            profileId: data.profile_id,
            connectionId: data.connection_id,
          });

          try {
            let pc = webRTCPeerConnection.current;

            // State guard: check if we should handle this offer
            if (pc && pc.signalingState === "closed") {
              logInfo("Ignoring offer for closed peer connection");
              return;
            }

            // Store the connection ID for tracking
            currentConnectionId.current = data.connection_id;

            if (!pc) {
              logInfo("Creating new PeerConnection for initial setup.");
              pc = new RTCPeerConnection({
                iceServers: data.ice_config,
              });
              webRTCPeerConnection.current = pc;

              // Handle ICE candidates with connection ID
              pc.onicecandidate = (event) => {
                if (
                  socket.connected &&
                  currentConnectionId.current === data.connection_id
                ) {
                  socket.emit("webrtc_ice_candidate", {
                    profile_id: profileId,
                    connection_id: data.connection_id,
                    // When event.candidate is null we send null → end-of-candidates
                    candidate: event.candidate
                      ? {
                          candidate: event.candidate.candidate,
                          sdpMid: event.candidate.sdpMid,
                          sdpMLineIndex: event.candidate.sdpMLineIndex,
                        }
                      : null,
                  });
                }
              };

              // Handle connection state changes with retry logic
              pc.onconnectionstatechange = () => {
                if (
                  webRTCPeerConnection.current &&
                  currentConnectionId.current === data.connection_id
                ) {
                  const currentState =
                    webRTCPeerConnection.current.connectionState;
                  setWebRTCConnectionState(currentState);
                  setIsWebRTCConnected(currentState === "connected");
                  logInfo(`WebRTC connection state: ${currentState}`);

                  if (
                    currentState === "failed" &&
                    webRTCRetryCount.current < maxWebRTCRetries
                  ) {
                    logInfo(
                      `WebRTC connection failed, retrying (${webRTCRetryCount.current + 1}/${maxWebRTCRetries})`
                    );
                    webRTCRetryCount.current++;
                    setTimeout(() => {
                      if (profileId && socket.connected) {
                        startWebRTCRef.current();
                      }
                    }, 2000); // 2 second delay before retry
                  } else if (currentState === "connected") {
                    webRTCRetryCount.current = 0; // Reset retry count on success
                  }
                }
              };

              // SPEC CHANGE: This handler now fires only once per connection for the persistent audio track
              pc.ontrack = (event) => {
                logInfo("Received persistent remote audio track", {
                  streamId: event.streams[0]?.id,
                  trackKind: event.track.kind,
                });

                if (event.track.kind !== "audio") {
                  logInfo("Skipping non-audio track");
                  return;
                }

                // SPEC CHANGE: Create a new MediaStream and add the specific track to it
                const newStream = new MediaStream();
                newStream.addTrack(event.track);

                // Prevent duplicate audio elements if ontrack fires unexpectedly
                if (remoteAudioStreams.current.has("persistent")) {
                  logInfo(
                    "Persistent audio element already exists, updating stream."
                  );
                  const persistentAudio =
                    remoteAudioStreams.current.get("persistent");
                  if (persistentAudio) {
                    persistentAudio.srcObject = newStream;
                  }
                  return;
                }

                // Create a single audio element for the persistent track
                // This will handle all TTS audio for this WebRTC connection
                const audio = new Audio();
                audio.srcObject = newStream; // Assign the new, clean stream
                audio.autoplay = true; // The browser may still block this initially

                // SPEC CHANGE: Add explicit audio properties to prevent silent playback
                audio.volume = 1.0;
                audio.muted = false;
                audio.setAttribute("playsinline", "true"); // Good practice for mobile browsers

                audio.addEventListener("play", () =>
                  logInfo("Persistent audio track playback started")
                );
                audio.addEventListener("error", (e) =>
                  logError("Persistent audio track error", e)
                );

                // Store the audio element with a global key since it handles all rooms
                remoteAudioStreams.current.set("persistent", audio);
                logInfo(
                  "Created persistent audio element for all TTS responses",
                  {
                    volume: audio.volume,
                    muted: audio.muted,
                    autoplay: audio.autoplay,
                    totalAudioElements: remoteAudioStreams.current.size,
                  }
                );

                // Attempt to play it. If it fails, our `playRemoteAudio` function will handle it later.
                audio.play().catch((error) => {
                  logError(
                    "Autoplay was blocked for persistent audio track. User interaction is required.",
                    error
                  );
                  toast.info(
                    "Audio is ready. Click the audio button or page to play."
                  );
                });
              };

              // Handle incoming data channels from server (like the persistent text channel)
              pc.ondatachannel = (event) => {
                const channel = event.channel;
                logInfo(`Received data channel from server: ${channel.label}`);

                // Store the channel for easy access
                webRTCDataChannels.current.set(channel.label, channel);

                // Set up event handlers for the server-created channel
                channel.onopen = () => {
                  logInfo(`Server data channel opened: ${channel.label}`);
                };

                channel.onclose = () => {
                  logInfo(`Server data channel closed: ${channel.label}`);
                  webRTCDataChannels.current.delete(channel.label);
                };

                channel.onerror = (error) => {
                  logError(
                    `Server data channel error for ${channel.label}:`,
                    error
                  );
                };

                // Handle incoming messages from server (tokens, completions, etc.)
                channel.onmessage = (event) => {
                  try {
                    const data = JSON.parse(event.data);
                    logInfo(
                      `Received server data channel message: ${data.type} on ${channel.label}`
                    );

                    // Route data channel messages to appropriate handlers
                    if (data.type === "token") {
                      // Reuse existing token handling logic
                      window.dispatchEvent(
                        new CustomEvent("simulationMessageToken", {
                          detail: {
                            messageId: data.message_id,
                            chatId: data.chat_id,
                            token: data.token,
                            accumulatedContent: data.accumulated_content,
                          },
                        })
                      );
                    } else if (data.type === "complete") {
                      // Reuse existing completion handling logic
                      window.dispatchEvent(
                        new CustomEvent("simulationMessageComplete", {
                          detail: {
                            messageId: data.message_id,
                            chatId: data.chat_id,
                            finalContent: data.final_content,
                            audio: data.audio,
                          },
                        })
                      );
                    } else {
                      logInfo(
                        "Unknown server data channel payload type:",
                        data.type
                      );
                    }
                  } catch (error) {
                    logError(
                      "Error parsing server data channel message:",
                      error
                    );
                  }
                };
              };
            } else {
              logInfo("Using existing PeerConnection for renegotiation.");
            }

            // Set remote description
            await pc.setRemoteDescription({
              sdp: data.offer.sdp,
              type: data.offer.type as RTCSdpType,
            });

            // Create answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Send answer with connection ID
            socket.emit("webrtc_answer", {
              profile_id: data.profile_id,
              connection_id: data.connection_id,
              answer: {
                sdp: answer.sdp,
                type: answer.type,
              },
            });

            logInfo("Sent WebRTC answer");
          } catch (error) {
            logError("Error handling WebRTC offer", error);
          }
        }
      );

      socket.on(
        "webrtc_ice_candidate",
        async (data: {
          profile_id: string;
          candidate: {
            candidate: string;
            sdpMid?: string;
            sdpMLineIndex?: number;
          };
        }) => {
          try {
            const pc = webRTCPeerConnection.current;
            if (pc && data.candidate) {
              const iceCandidate = new RTCIceCandidate(data.candidate);
              await pc.addIceCandidate(iceCandidate);

              logInfo("Added WebRTC ICE candidate");
            }
          } catch (error) {
            logError("Error adding ICE candidate", error);
          }
        }
      );

      socket.on("webrtc_server_audio_starting", (data: { chat_id: string }) => {
        logInfo("Server is preparing to send an audio stream for", {
          chatId: data.chat_id,
        });
        // This event now serves as a signal, the ontrack event will handle the stream itself.
      });

      socket.on(
        "webrtc_ready",
        (data: { profile_id: string; connection_id: string }) => {
          logInfo("WebRTC connection ready", {
            profileId: data.profile_id,
            connectionId: data.connection_id,
          });

          // Only handle if this is the current connection
          if (currentConnectionId.current === data.connection_id) {
            const pc = webRTCPeerConnection.current;
            if (pc) {
              toast.success("WebRTC connection established!");

              // Now that WebRTC is ready, create data channels for any rooms we're already in.
              // The persistent audio track is already established and ready to receive TTS audio.
              currentRoomsRef.current.forEach((roomId) => {
                createDataChannelIfNeeded(`text-${roomId}`);
              });
            }
          }
        }
      );

      socket.on(
        "webrtc_connection_state",
        (data: { profile_id: string; state: string }) => {
          setWebRTCConnectionState(data.state);
          setIsWebRTCConnected(data.state === "connected");
          logInfo(`WebRTC connection state: ${data.state}`);
        }
      );

      socket.on("webrtc_error", (data: { error: string }) => {
        logError("WebRTC error", data.error);
        toast.error(`WebRTC error: ${data.error}`);
        setIsWebRTCConnected(false);
      });

      // SPEC CHANGE: Renegotiation handler is no longer needed
      // The server now uses a persistent audio track, eliminating the need for renegotiation
    },
    [queryClient, profileId, createDataChannelIfNeeded]
  );

  // Initialize WebSocket connection when profileId is available
  useEffect(() => {
    if (!profileId) {
      logInfo("Waiting for profile ID before connecting WebSocket", {
        profileId,
      });
      return;
    }

    // Don't create multiple connections
    if (socketRef.current?.connected) {
      logInfo("WebSocket already connected, skipping initialization", {
        profileId,
      });
      return;
    }

    // Capture current rooms at effect creation time for cleanup
    const roomsToCleanup = currentRoomsRef.current;

    const connectWebSocket = async () => {
      logInfo("Initializing global WebSocket connection", {
        profileId,
        attempt: connectionAttempts.current + 1,
      });

      const socket = io(getApiBase(), {
        path: "/socket.io",
        autoConnect: true,
        timeout: 30000, // Increase timeout
        reconnection: true,
        reconnectionAttempts: 3, // Reduce attempts to avoid spam
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        upgrade: true,
        rememberUpgrade: false, // Don't remember upgrade to allow fallback
        query: {
          profileId,
          timestamp: Date.now(),
          EIO: "4",
        },
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        connectionAttempts.current = 0;
        logInfo("Global WebSocket connected successfully", {
          socketId: socket.id,
          profileId,
          transport: socket.io.engine.transport.name,
        });
      });

      // Handle connection confirmation from server
      socket.on(
        "connection_confirmed",
        (data: { sid: string; profile_id: string; server_time: number }) => {
          logInfo("Server confirmed WebSocket connection", {
            serverSid: data.sid,
            profileId: data.profile_id,
            serverTime: data.server_time,
            clientTime: Date.now(),
          });
        }
      );

      socket.on("disconnect", (reason: string) => {
        setIsConnected(false);
        logInfo(`Global WebSocket disconnected: ${reason}`, {
          socketId: socket.id,
          profileId,
        });
      });

      socket.on("connect_error", (error: Error) => {
        connectionAttempts.current++;
        logError("Global WebSocket connection error:", error.message, {
          attempt: connectionAttempts.current,
          maxAttempts: maxConnectionAttempts,
          profileId,
          errorType: error.name,
          errorStack: error.stack,
          fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
        setIsConnected(false);

        if (connectionAttempts.current >= maxConnectionAttempts) {
          toast.error(
            "Unable to connect to real-time updates. Some features may be limited."
          );
        }
      });

      socket.on("reconnect", (attemptNumber: number) => {
        setIsConnected(true);
        logInfo("Global WebSocket reconnected", {
          socketId: socket.id,
          profileId,
          attemptNumber,
        });
        toast.success("Connection restored!");
      });

      socket.on("reconnect_error", (error: Error) => {
        logError("Global WebSocket reconnection failed:", error.message, {
          profileId,
        });
      });

      socket.on("reconnect_failed", () => {
        setIsConnected(false);
        logError("Global WebSocket reconnection failed permanently", {
          profileId,
        });
        toast.error("Connection lost. Please refresh the page to reconnect.");
      });

      // Handle heartbeat pong responses
      socket.on("pong", (data: { timestamp: number }) => {
        lastPongReceived.current = Date.now();
        logInfo("Received heartbeat pong", { serverTimestamp: data.timestamp });
      });

      // Set up common event handlers that update React Query cache
      setupCommonEventHandlers(socket);

      // Start heartbeat mechanism
      const startHeartbeat = () => {
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }

        heartbeatInterval.current = setInterval(() => {
          if (socket.connected) {
            const now = Date.now();
            // Check if we haven't received a pong in 30 seconds (2x heartbeat interval)
            if (now - lastPongReceived.current > 30000) {
              logError("Heartbeat timeout - reconnecting WebSocket");
              socket.disconnect();
              socket.connect();
            } else {
              socket.emit("ping", { timestamp: now });
            }
          }
        }, 15000); // Send ping every 15 seconds
      };

      socket.on("connect", () => {
        startHeartbeat();
      });

      socket.on("disconnect", () => {
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }
      });
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        logInfo("Cleaning up global WebSocket connection");
        // Leave all rooms before disconnecting using captured rooms
        roomsToCleanup.forEach((roomId) => {
          socketRef.current?.emit("leave_chat", {
            chat_id: roomId,
            chat_type: "any",
          });
        });
        roomsToCleanup.clear();

        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }

      // Clean up timers
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      if (webRTCStartDebounceTimer.current) {
        clearTimeout(webRTCStartDebounceTimer.current);
        webRTCStartDebounceTimer.current = null;
      }
    };
  }, [profileId, setupCommonEventHandlers]);

  // Room management
  const joinRoom = useCallback(
    (roomId: string, roomType: "assistant" | "simulation") => {
      if (!socketRef.current || !isConnected) {
        logInfo("Cannot join room - WebSocket not connected", {
          roomId,
          roomType,
        });
        return;
      }

      logInfo(`Joining room: ${roomId} (${roomType})`);
      socketRef.current.emit("join_chat", {
        chat_id: roomId,
        chat_type: roomType,
      });
      currentRoomsRef.current.add(roomId);

      // Proactively create a data channel for this room if the WebRTC connection is ready.
      // The persistent audio track is already available for TTS responses.
      if (isWebRTCConnected) {
        createDataChannelIfNeeded(`text-${roomId}`);
      }
    },
    [isConnected, isWebRTCConnected, createDataChannelIfNeeded] // Add isWebRTCConnected and createDataChannelIfNeeded to dependencies
  );

  const leaveRoom = useCallback(
    (roomId: string, roomType: "assistant" | "simulation") => {
      if (!socketRef.current) {
        logInfo("Cannot leave room - WebSocket not available", {
          roomId,
          roomType,
        });
        return;
      }

      logInfo(`Leaving room: ${roomId} (${roomType})`);
      socketRef.current.emit("leave_chat", {
        chat_id: roomId,
        chat_type: roomType,
      });
      currentRoomsRef.current.delete(roomId);

      // Close and remove the data channel
      const channelLabel = `text-${roomId}`;
      const channel = webRTCDataChannels.current.get(channelLabel);
      if (channel) {
        channel.close();
        webRTCDataChannels.current.delete(channelLabel);
        logInfo(`Closed and removed WebRTC data channel: ${channelLabel}`);
      }

      // Note: We don't remove the persistent audio track here as it's shared across all rooms
    },
    []
  );

  // Event emitters
  const emitStartSimulation = useCallback(
    (data: { simulation_id: string; profile_id: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot start simulation - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsStartingSimulation(true);
      logInfo("Emitting start_simulation", data);
      socketRef.current.emit("start_simulation", data);
    },
    [isConnected]
  );

  const emitSendSimulationMessage = useCallback(
    (data: {
      chat_id: string;
      message: string;
      assistant_audio_enabled?: boolean;
    }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot send simulation message - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsSendingSimulationMessage(true);
      logInfo("Emitting send_simulation_message", {
        chatId: data.chat_id,
        assistantAudioEnabled: data.assistant_audio_enabled,
      });
      socketRef.current.emit("send_simulation_message", data);
    },
    [isConnected]
  );

  const emitStopSimulation = useCallback(
    (data: { chat_id: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot stop simulation - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsStoppingSimulation(true);
      logInfo("Emitting stop_simulation", data);
      socketRef.current.emit("stop_simulation", data);
    },
    [isConnected]
  );

  const emitContinueSimulation = useCallback(
    (data: { chat_id: string; attempt_id: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot continue simulation - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsContinuingSimulation(true);
      logInfo("Emitting continue_simulation", data);
      socketRef.current.emit("continue_simulation", data);
    },
    [isConnected]
  );

  // Assistant event emitters
  const emitStartAssistant = useCallback(
    (data: { chat_id: string; initial_message: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot start assistant - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsStartingAssistant(true);
      logInfo("Emitting start_assistant", data);
      socketRef.current.emit("start_assistant", data);
    },
    [isConnected]
  );

  const emitSendAssistantMessage = useCallback(
    (data: { chat_id: string; message: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot send assistant message - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsSendingAssistantMessage(true);
      logInfo("Emitting send_assistant_message", { chatId: data.chat_id });
      socketRef.current.emit("send_assistant_message", data);
    },
    [isConnected]
  );

  const emitStopAssistant = useCallback(
    (data: { chat_id: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot stop assistant - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsStoppingAssistant(true);
      logInfo("Emitting stop_assistant", data);
      socketRef.current.emit("stop_assistant", data);
    },
    [isConnected]
  );

  // WebRTC functions with debouncing
  const startWebRTC = useCallback(async () => {
    if (!isWebRTCSupported || !profileId || !socketRef.current) {
      logError("Cannot start WebRTC - not supported or missing requirements");
      return;
    }

    // Debounce WebRTC start to prevent Fast-Refresh spam
    if (webRTCStartDebounceTimer.current) {
      clearTimeout(webRTCStartDebounceTimer.current);
    }

    webRTCStartDebounceTimer.current = setTimeout(() => {
      if (!socketRef.current || !profileId) return;

      try {
        logInfo("Starting WebRTC connection", { profileId });

        // Request WebRTC start from server
        socketRef.current.emit("webrtc_start", { profile_id: profileId });
      } catch (error) {
        logError("Error starting WebRTC", error);
      }
    }, 500); // 500ms debounce
  }, [isWebRTCSupported, profileId]);

  // Store startWebRTC in a ref to avoid circular dependencies
  const startWebRTCRef = useRef(startWebRTC);
  useEffect(() => {
    startWebRTCRef.current = startWebRTC;
  }, [startWebRTC]);

  const stopWebRTC = useCallback(async () => {
    try {
      logInfo("Stopping WebRTC connection");

      // Close data channels
      webRTCDataChannels.current.forEach((channel) => {
        if (channel.readyState === "open") {
          channel.close();
        }
      });
      webRTCDataChannels.current.clear();

      // Clean up persistent audio element
      const persistentAudio = remoteAudioStreams.current.get("persistent");
      if (persistentAudio) {
        persistentAudio.pause();
        persistentAudio.srcObject = null;
        remoteAudioStreams.current.delete("persistent");
        logInfo("Cleaned up persistent audio element");
      }

      // Close peer connection
      if (webRTCPeerConnection.current) {
        webRTCPeerConnection.current.close();
        webRTCPeerConnection.current = null;
      }

      setIsWebRTCConnected(false);
      setWebRTCConnectionState("closed");
    } catch (error) {
      logError("Error stopping WebRTC", error);
    }
  }, []);

  useEffect(() => {
    if (
      isConnected && // WebSocket is green
      !isWebRTCConnected && // we haven't finished ICE yet
      isWebRTCSupported && // browser supports it
      profileId // we know who we are
    ) {
      startWebRTCRef.current(); // fire the "webrtc_start" emit
    }
  }, [isConnected, isWebRTCConnected, isWebRTCSupported, profileId]);

  useEffect(() => {
    if (!isConnected && isWebRTCConnected) {
      stopWebRTC(); // close data channels + RTCPeerConnection
    }
  }, [isConnected, isWebRTCConnected, stopWebRTC]);

  // Send messages via WebRTC data channels with queuing for unopened channels
  const sendWebRTCMessage = useCallback(
    (
      chatId: string,
      message: string,
      assistantAudioEnabled: boolean = false
    ) => {
      try {
        // Try to use the persistent text data channel first
        const textChannel = webRTCDataChannels.current.get("text");

        if (textChannel && textChannel.readyState === "open") {
          const messagePayload = JSON.stringify({
            chat_id: chatId,
            content: message,
            assistant_audio_enabled: assistantAudioEnabled,
          });

          logInfo(`Sending message via persistent text data channel`);
          textChannel.send(messagePayload);
          return;
        }

        // Fallback to the old per-chat channel approach if persistent channel unavailable
        const channelLabel = `text-${chatId}`;
        let legacyTextChannel = webRTCDataChannels.current.get(channelLabel);

        // Attempt to create the channel if it doesn't exist or is closed
        if (!legacyTextChannel || legacyTextChannel.readyState === "closed") {
          legacyTextChannel = createDataChannelIfNeeded(channelLabel);
        }

        // If channel creation failed (e.g., PC is down), then fall back.
        if (!legacyTextChannel) {
          logError(
            `Could not create or get WebRTC channel ${channelLabel}, falling back to WebSocket`
          );
          if (chatId.includes("simulation")) {
            emitSendSimulationMessage({
              chat_id: chatId,
              message,
              assistant_audio_enabled: assistantAudioEnabled,
            });
          } else if (chatId.includes("assistant")) {
            emitSendAssistantMessage({ chat_id: chatId, message });
          }
          return;
        }

        const messagePayload = JSON.stringify({
          chat_id: chatId,
          content: message,
          assistant_audio_enabled: assistantAudioEnabled,
        });

        // If the channel is open, send immediately.
        if (legacyTextChannel.readyState === "open") {
          logInfo(
            `Sending WebRTC message directly via open channel ${channelLabel}`
          );
          legacyTextChannel.send(messagePayload);
        }
        // If it's still connecting, queue the message.
        else if (legacyTextChannel.readyState === "connecting") {
          logInfo(
            `WebRTC channel ${channelLabel} is connecting. Queuing message.`
          );
          if (!messageQueues.current.has(channelLabel)) {
            messageQueues.current.set(channelLabel, []);
          }
          messageQueues.current.get(channelLabel)?.push(messagePayload);
        }
        // As a final safety net, fall back if the channel is in a weird state.
        else {
          logError(
            `WebRTC channel ${channelLabel} in unhandled state: ${legacyTextChannel.readyState}. Falling back to WebSocket.`
          );
          if (chatId.includes("simulation")) {
            emitSendSimulationMessage({
              chat_id: chatId,
              message,
              assistant_audio_enabled: assistantAudioEnabled,
            });
          } else if (chatId.includes("assistant")) {
            emitSendAssistantMessage({ chat_id: chatId, message });
          }
        }
      } catch (error) {
        logError("Error sending WebRTC message", error);
      }
    },
    [
      createDataChannelIfNeeded,
      emitSendSimulationMessage,
      emitSendAssistantMessage,
    ]
  );

  const startAudioStream = useCallback(
    async (chatId: string, assistantAudioEnabled: boolean = false) => {
      if (
        !isWebRTCSupported ||
        !profileId ||
        !socketRef.current ||
        !webRTCPeerConnection.current
      ) {
        logError(
          "Cannot start audio stream - not supported or missing requirements"
        );
        toast.error("WebRTC not ready. Cannot start audio.");
        return;
      }

      try {
        logInfo(`Starting audio stream for chat: ${chatId}`);

        // Get user media stream if not already available
        if (!userMediaStream.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          userMediaStream.current = stream;
          setUserAudioStream(stream);
        }

        const audioTrack = userMediaStream.current.getAudioTracks()[0];
        if (audioTrack && webRTCPeerConnection.current) {
          const sender = webRTCPeerConnection.current.addTrack(
            audioTrack,
            userMediaStream.current
          );
          audioTrackSenders.current.set(chatId, sender);

          // Notify server to associate this new track with the chat
          socketRef.current.emit("webrtc_start_audio", {
            chat_id: chatId,
            profile_id: profileId,
            connection_id: currentConnectionId.current,
            assistant_audio_enabled: assistantAudioEnabled,
          });
          logInfo(`Started and sent audio stream for chat: ${chatId}`);
        }
      } catch (error) {
        logError("Error starting audio stream", error);
        toast.error("Failed to start microphone. Please check permissions.");
        setUserAudioStream(null);
      }
    },
    [isWebRTCSupported, profileId]
  );

  const stopAudioStream = useCallback(
    (chatId: string) => {
      logInfo(`Stopping audio stream for chat: ${chatId}`);
      const sender = audioTrackSenders.current.get(chatId);
      if (sender && webRTCPeerConnection.current) {
        webRTCPeerConnection.current.removeTrack(sender);
        audioTrackSenders.current.delete(chatId);
      }

      // If no other chats are using the stream, stop the tracks.
      if (audioTrackSenders.current.size === 0 && userMediaStream.current) {
        userMediaStream.current.getTracks().forEach((track) => track.stop());
        userMediaStream.current = null;
        setUserAudioStream(null);
        logInfo("All audio streams stopped. Mic released.");
      }

      if (socketRef.current && profileId) {
        socketRef.current.emit("webrtc_stop_audio", {
          chat_id: chatId,
          profile_id: profileId,
          connection_id: currentConnectionId.current,
        });
      }
    },
    [profileId]
  );

  const playRemoteAudio = useCallback(async () => {
    // This function will be called by a user gesture
    logInfo(
      "Attempting to play persistent audio stream due to user interaction."
    );
    const persistentAudio = remoteAudioStreams.current.get("persistent");
    if (persistentAudio && persistentAudio.paused) {
      try {
        await persistentAudio.play();
        logInfo(
          "Successfully started persistent audio track playback after user gesture."
        );
      } catch (error) {
        logError(
          "Error attempting to play persistent audio after gesture.",
          error
        );
        toast.error("Could not start audio. Please check browser permissions.");
      }
    } else if (persistentAudio) {
      logInfo("Persistent audio track is already playing.");
    } else {
      logInfo("No persistent audio track available to play.");
    }
  }, []);

  const testAndEnableAudio = useCallback(async () => {
    logInfo("Testing audio playback with a user gesture.");

    // 1. Create a temporary AudioContext to play a silent sound
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) {
      toast.error("Audio not supported", {
        description: "Your browser doesn't support Web Audio API.",
      });
      return;
    }
    const audioContext = new AudioContextClass();
    const silentSound = createSilentAudio(audioContext);

    try {
      // This is the most important part: getting user-gesture consent
      silentSound.start(0);
      // If the line above doesn't throw an error, we have consent!
      toast.success("Audio enabled! 🎉", {
        description: "Your browser has granted audio playback permission.",
      });

      // 2. Now, immediately try to play the persistent audio stream if available
      const persistentAudio = remoteAudioStreams.current.get("persistent");
      if (persistentAudio && persistentAudio.paused) {
        await persistentAudio.play();
        logInfo("Played the persistent audio stream.");
      }
    } catch (error) {
      logError("Audio consent was denied by the browser.", error);
      toast.error("Audio Blocked! 🔇", {
        description:
          "Your browser is blocking audio. Please check site settings.",
      });
    } finally {
      // Clean up the context
      if (audioContext.state !== "closed") {
        await audioContext.close();
      }
    }
  }, []);

  const value: WebSocketContextType = {
    isConnected,
    socket: socketRef.current,
    isWebRTCConnected,
    webRTCConnectionState,
    isWebRTCSupported,
    isStartingSimulation,
    isSendingSimulationMessage,
    isStoppingSimulation,
    isContinuingSimulation,
    isStartingAssistant,
    isSendingAssistantMessage,
    isStoppingAssistant,
    joinRoom,
    leaveRoom,
    sendWebRTCMessage,
    startAudioStream,
    stopAudioStream,
    emitStartSimulation,
    emitSendSimulationMessage,
    emitStopSimulation,
    emitContinueSimulation,
    emitStartAssistant,
    emitSendAssistantMessage,
    emitStopAssistant,
    playRemoteAudio,
    testAndEnableAudio,
    userAudioStream,
  };

  return (
    <WebSocketContext.Provider value={value}>
      <ConnectionStatusIndicator
        wsConnected={isConnected}
        webRTCConnected={isWebRTCConnected}
      />
      {children}
    </WebSocketContext.Provider>
  );
}
