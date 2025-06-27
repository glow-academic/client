/**
 * Global WebSocket Context for managing a single WebSocket connection
 * This provides a centralized way to manage WebSocket connections and events
 * across all components based on the user's profile ID
 */
"use client";

import { getApiUrl } from "@/lib/utils";
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
  joinRoom: (
    roomId: string,
    roomType: "assistant" | "simulation"
  ) => void; // should create webRTC data channel (for text) and optionally media channel (for audio, for simulation only)
  leaveRoom: (
    roomId: string,
    roomType: "assistant" | "simulation"
  ) => void; // should close webRTC data channel (for text) and optionally media channel (for audio, for simulation only)

  // Simulation event emitters
  emitStartSimulation: (data: {
    simulation_id: string;
    profile_id: string;
  }) => void;
  emitSendSimulationMessage: (data: {
    chat_id: string;
    message: string;
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
    message: string;
  }) => void; // this should automatically send over webRTC data channel (for text)
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

  // WebRTC state
  const [isWebRTCConnected, setIsWebRTCConnected] = useState(false);
  const [webRTCConnectionState, setWebRTCConnectionState] = useState("new");
  const [isWebRTCSupported, setIsWebRTCSupported] = useState(false);
  const webRTCPeerConnection = useRef<RTCPeerConnection | null>(null);
  const webRTCDataChannels = useRef<Map<string, RTCDataChannel>>(new Map());

  // Check if WebRTC is supported
  useEffect(() => {
    setIsWebRTCSupported(
      typeof RTCPeerConnection !== "undefined" &&
        typeof RTCDataChannel !== "undefined"
    );
  }, []);

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
        (data: { chat_id: string; success: boolean; message: string }) => {
          logInfo("Simulation continued", data);
          setIsContinuingSimulation(false);
          if (data.success) {
            toast.success(data.message);
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
          offer: { sdp: string; type: string };
          ice_config: RTCIceServer[];
        }) => {
          logInfo("Received WebRTC offer", { profileId: data.profile_id });

          try {
            // Create peer connection using the configuration from the server
            const pc = new RTCPeerConnection({ iceServers: data.ice_config });
            webRTCPeerConnection.current = pc;

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
              if (socket.connected) {
                socket.emit("webrtc_ice_candidate", {
                  profile_id: profileId,
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

            // Handle connection state changes
            pc.onconnectionstatechange = () => {
              setWebRTCConnectionState(pc.connectionState);
              setIsWebRTCConnected(pc.connectionState === "connected");
              logInfo(`WebRTC connection state: ${pc.connectionState}`);
            };

            // Set remote description
            await pc.setRemoteDescription({
              sdp: data.offer.sdp,
              type: data.offer.type as RTCSdpType,
            });

            // Create answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Send answer
            socket.emit("webrtc_answer", {
              profile_id: data.profile_id,
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

      socket.on("webrtc_ready", (data: { profile_id: string }) => {
        logInfo("WebRTC connection ready", { profileId: data.profile_id });

        // Create data channels for different chat types
        const pc = webRTCPeerConnection.current;
        if (pc) {
          // We'll create channels dynamically when needed
          toast.success("WebRTC connection established!");
        }
      });

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
    },
    [queryClient, profileId]
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

    const connectWebSocket = () => {
      logInfo("Initializing global WebSocket connection", {
        profileId,
        attempt: connectionAttempts.current + 1,
      });

      const socketUrl = getApiUrl();
      const socketPath = "/socket.io";
      const socket = io(socketUrl, {
        path: socketPath,
        transports: ["websocket"],
        autoConnect: true,
        forceNew: true, // Force new connection to avoid stale connections
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

      // Set up common event handlers that update React Query cache
      setupCommonEventHandlers(socket);
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
    },
    [isConnected]
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
    (data: { chat_id: string; message: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot send simulation message - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsSendingSimulationMessage(true);
      logInfo("Emitting send_simulation_message", { chatId: data.chat_id });
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

  // WebRTC functions
  const startWebRTC = useCallback(async () => {
    if (!isWebRTCSupported || !profileId || !socketRef.current) {
      logError("Cannot start WebRTC - not supported or missing requirements");
      return;
    }

    try {
      logInfo("Starting WebRTC connection", { profileId });

      // Request WebRTC start from server
      socketRef.current.emit("webrtc_start", { profile_id: profileId });
    } catch (error) {
      logError("Error starting WebRTC", error);
    }
  }, [isWebRTCSupported, profileId]);

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
      !isWebRTCConnected && // we haven’t finished ICE yet
      isWebRTCSupported && // browser supports it
      profileId // we know who we are
    ) {
      startWebRTC(); // fire the "webrtc_start" emit
    }
  }, [
    isConnected,
    isWebRTCConnected,
    isWebRTCSupported,
    profileId,
    startWebRTC,
  ]);

  useEffect(() => {
    if (!isConnected && isWebRTCConnected) {
      stopWebRTC(); // close data channels + RTCPeerConnection
    }
  }, [isConnected, isWebRTCConnected, stopWebRTC]);

  // Helper function to create data channel if it doesn't exist
  const createDataChannelIfNeeded = useCallback(
    (channelLabel: string): RTCDataChannel | undefined => {
      const pc = webRTCPeerConnection.current;
      if (!pc || pc.connectionState !== "connected") {
        return undefined;
      }

      let channel = webRTCDataChannels.current.get(channelLabel);
      if (!channel || channel.readyState === "closed") {
        // Create new data channel
        channel = pc.createDataChannel(channelLabel, {
          ordered: true,
        });

        channel.onopen = () => {
          logInfo(`WebRTC data channel opened: ${channelLabel}`);
        };

        channel.onclose = () => {
          logInfo(`WebRTC data channel closed: ${channelLabel}`);
          webRTCDataChannels.current.delete(channelLabel);
        };

        channel.onerror = (error) => {
          logError(`WebRTC data channel error for ${channelLabel}`, error);
        };

        webRTCDataChannels.current.set(channelLabel, channel);
        logInfo(`Created WebRTC data channel: ${channelLabel}`);
      }

      return channel;
    },
    []
  );

  const _sendWebRTCMessage = useCallback(
    (chatId: string, message: string, isAudio = false) => {
      try {
        const channelLabel = isAudio ? `audio-${chatId}` : `text-${chatId}`;

        // Try to get or create the data channel
        let channel = webRTCDataChannels.current.get(channelLabel);
        if (!channel || channel.readyState !== "open") {
          channel = createDataChannelIfNeeded(channelLabel);
        }

        if (!channel || channel.readyState !== "open") {
          logError(
            `WebRTC data channel not available for ${channelLabel}, falling back to WebSocket`
          );
          // Fallback to WebSocket
          if (isAudio) {
            // Handle audio fallback (could send as base64)
            logInfo("Audio fallback not implemented yet");
          } else {
            // Send text via WebSocket
            if (chatId.includes("simulation")) {
              emitSendSimulationMessage({ chat_id: chatId, message });
            } else if (chatId.includes("assistant")) {
              emitSendAssistantMessage({ chat_id: chatId, message });
            }
          }
          return;
        }

        const messageData = {
          type: "message_complete",
          chat_id: chatId,
          content: message,
          is_audio: isAudio,
          timestamp: Date.now(),
        };

        channel.send(JSON.stringify(messageData));
        logInfo(`Sent WebRTC message via ${channelLabel}`, {
          chatId,
          messageLength: message.length,
        });
      } catch (error) {
        logError("Error sending WebRTC message", error);
      }
    },
    [
      emitSendSimulationMessage,
      emitSendAssistantMessage,
      createDataChannelIfNeeded,
    ]
  );

  const _sendWebRTCAudio = useCallback((chatId: string, audioData: string) => {
    try {
      const channelLabel = `audio-${chatId}`;
      const channel = webRTCDataChannels.current.get(channelLabel);

      if (!channel || channel.readyState !== "open") {
        logError(
          `WebRTC audio channel not available, falling back to WebSocket`
        );
        // Could implement base64 audio fallback here
        return;
      }

      const messageData = {
        type: "message_complete",
        chat_id: chatId,
        content: "",
        is_audio: true,
        audio_data: audioData,
        timestamp: Date.now(),
      };

      channel.send(JSON.stringify(messageData));
      logInfo(`Sent WebRTC audio via ${channelLabel}`, { chatId });
    } catch (error) {
      logError("Error sending WebRTC audio", error);
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
    emitStartSimulation,
    emitSendSimulationMessage,
    emitStopSimulation,
    emitContinueSimulation,
    emitStartAssistant,
    emitSendAssistantMessage,
    emitStopAssistant,
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
