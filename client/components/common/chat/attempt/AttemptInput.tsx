/**
 * AttemptInput.tsx
 * Used to display the attempt input, supporting text, audio, and sketching.
 * @AshokSaravanan222 & @siladiea
 * 07/01/2025
 */
"use client";
import { motion } from "framer-motion";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// UI Components
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

// Icons
import { Loader2, Mic, MicOff, Send, Square, Volume2, X } from "lucide-react";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useProfile } from "@/contexts/profile-context";
import { useNoPasteTextarea } from "@/hooks/use-no-paste-textarea";
import VoiceWaveform from "./VoiceWaveform";
// Note: After ws.json is regenerated with start_voice_response, import and use:
// import type { ServerToClientEvents } from "@/lib/ws/types";
// type EventPayload<T extends keyof ServerToClientEvents> =
//   ServerToClientEvents[T] extends (payload: infer P) => unknown ? P : never;
// type StartVoiceResponsePayload = EventPayload<"start_voice_response">;
import {
  RealtimeAgent,
  RealtimeSession,
  tool,
  type RealtimeItem,
  type RealtimeSessionConfig,
} from "@openai/agents/realtime";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { z } from "zod";

export interface AttemptInputProps {
  isAttemptOwner?: boolean;
  onHeightChange?: (height: number) => void;
  currentMessages: Array<{
    id: string;
    type: string;
    content: string;
    createdAt: string;
    completed?: boolean;
  }>;
  currentChatHints: Array<{
    messageId: string;
    hints: Array<unknown>;
  }>;
  currentChat: { id: string; completed?: boolean } | null;
  sendMessage: (message: string, isRetry?: boolean) => void;
  stopMessage: () => void;
  isSendingMessage: boolean;
  isStoppingMessage: boolean;
  isConnected: boolean;
  simulation: {
    practiceSimulation?: boolean;
    copyPasteAllowed?: boolean;
  } | null;
  scenario: { copyPasteAllowed?: boolean } | null;
  readOnly?: boolean;
}

export default function AttemptInput({
  isAttemptOwner = true,
  onHeightChange,
  currentMessages: _currentMessages,
  currentChatHints: _currentChatHints,
  currentChat,
  sendMessage,
  stopMessage,
  isSendingMessage,
  isStoppingMessage,
  isConnected,
  simulation,
  scenario,
  readOnly = false,
}: AttemptInputProps) {
  const MAX_INPUT_CHARS = 5000; // generous limit to allow deep explanations without spam
  const [newMessage, setNewMessage] = useState("");
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  const [isStartingVoice, setIsStartingVoice] = useState(false);
  const [isStoppingVoice, setIsStoppingVoice] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  const { socket } = useProfile();
  const inputPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const realtimeSessionRef = useRef<RealtimeSession | null>(null);
  // Track which Realtime items we've already forwarded to the server
  const processedItemIdsRef = useRef<Set<string>>(new Set());
  // Use strongly typed tool context map from WebSocket event payload
  // Fallback type until ws.json is regenerated with start_voice_response
  type ToolContextMap = Record<
    string,
    {
      persona_id: string;
      profile_id: string | null;
    }
  >;
  const toolContextMapRef = useRef<ToolContextMap>({});

  // Audio recording refs
  const userMediaStreamRef = useRef<MediaStream | null>(null);
  const userRecorderRef = useRef<MediaRecorder | null>(null);
  const userAudioChunksRef = useRef<BlobPart[]>([]);
  // Map item_id to upload_id for linking audio to messages when transcript arrives
  const audioUploadIdRef = useRef<Map<string, string>>(new Map());

  const sanitizeInputLength = (value: string) =>
    value.length > MAX_INPUT_CHARS ? value.slice(0, MAX_INPUT_CHARS) : value;

  // Get copyPasteAllowed from scenario or simulation (scenario takes precedence)
  const copyPasteAllowed = useMemo(() => {
    return scenario?.copyPasteAllowed ?? simulation?.copyPasteAllowed ?? false;
  }, [scenario?.copyPasteAllowed, simulation?.copyPasteAllowed]);

  // Initialize paste prevention hook
  const pastePrevention = useNoPasteTextarea(textareaRef, {
    enabled: !copyPasteAllowed, // Disable paste prevention if copyPasteAllowed is true
    onPasteAttempt: () => {
      // Paste attempt blocked - no logging needed
    },
    enableBurstDetection: true,
    maxBurstSize: 1,
  });

  // Connection state for send button
  const hasTextMessage = newMessage.trim().length > 0;

  const getConnectionTooltip = () => {
    if (!isConnected) {
      return "Initializing (0/1)";
    }
    if (isSendingMessage) {
      return "Stop sending";
    }
    if (!hasTextMessage) {
      return "Enter a message";
    }
    return "Send message";
  };

  // --- Handlers ---
  const handleSendMessage = async (
    e:
      | React.FormEvent<HTMLFormElement>
      | React.KeyboardEvent<HTMLTextAreaElement>
      | React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    const messageToSend = newMessage.trim();

    if (!messageToSend || !currentChat || !isConnected) return;

    // In voice mode: send to RealtimeSession instead of backend text path
    if (voiceModeEnabled && realtimeSessionRef.current) {
      const session = realtimeSessionRef.current;
      try {
        // Send text message to RealtimeSession
        session.sendMessage({
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: messageToSend,
            },
          ],
        });
        // eslint-disable-next-line no-console
        console.log("[Voice] Sent text to RealtimeSession:", messageToSend);

        // The history_added listener will see this new user message and
        // forward it to the server in one unified path.
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to send message to voice session";
        // eslint-disable-next-line no-console
        console.error("[Voice] Error sending text to RealtimeSession:", {
          error: errorMessage,
          error_object: error,
        });
        toast.error(errorMessage);
        return; // don't clear input on failure
      }
    } else {
      // Normal text mode: go through your existing backend
      if (isSendingMessage) return;
      sendMessage(messageToSend);
    }

    setNewMessage("");
  };
  const handleStopMessage = () => stopMessage();

  // TUS upload helper for audio files
  const uploadAudioWithTus = async (
    blob: Blob,
    metadata: Record<string, string> = {}
  ): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      let tusUploadInstance: tus.Upload | null = null;

      tusUploadInstance = new tus.Upload(blob, {
        endpoint: `/api/uploads/upload`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: metadata["filename"] ?? "audio.webm",
          filetype: metadata["filetype"] ?? blob.type,
          ...metadata,
        },
        onError: (error) => {
          reject(error);
        },
        onSuccess: async () => {
          try {
            const uploadUrl = tusUploadInstance?.url || "";
            const tusUploadIdMatch = uploadUrl.match(/\/upload\/([^/]+)/);
            if (!tusUploadIdMatch || !tusUploadIdMatch[1]) {
              throw new Error("Could not extract TUS upload ID");
            }
            const tusUploadId = tusUploadIdMatch[1];

            const res = await fetch(
              `/api/uploads/upload/${tusUploadId}/finalize`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
              }
            );

            const json = await res.json();
            if (!json.success || !json.uploadId) {
              throw new Error(json.message || "Failed to finalize upload");
            }

            resolve(json.uploadId as string);
          } catch (e) {
            reject(e);
          }
        },
      });

      tusUploadInstance.start();
    });
  };

  // Cleanup helper for Realtime session
  // WebRTC transport handles mic/speaker automatically, so we only need to close the session
  const cleanupRealtime = useCallback(() => {
    const session = realtimeSessionRef.current;
    realtimeSessionRef.current = null;

    if (session) {
      try {
        // Correct way to tear down the session (closes WebRTC transport automatically)
        session.close();
        // eslint-disable-next-line no-console
        console.log("[Voice] RealtimeSession closed");
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[Voice] Error closing session:", err);
      }
    }

    processedItemIdsRef.current = new Set(); // reset
    audioUploadIdRef.current.clear(); // reset audio upload mappings

    // Cleanup audio recording
    try {
      if (
        userRecorderRef.current &&
        userRecorderRef.current.state !== "inactive"
      ) {
        userRecorderRef.current.stop();
      }
      userRecorderRef.current = null;
      userMediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      userMediaStreamRef.current = null;
      userAudioChunksRef.current = [];
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[Voice] Error cleaning up user audio recorder:", err);
    }

    setVoiceModeEnabled(false);
    setIsMicMuted(false);
  }, []);

  // Voice mode handlers
  const handleVoiceStop = useCallback(async () => {
    if (!currentChat?.id || !socket || !isConnected || !voiceModeEnabled)
      return;

    setIsStoppingVoice(true);
    try {
      // eslint-disable-next-line no-console
      console.log("[Voice] Stopping voice mode:", {
        chat_id: currentChat.id,
      });

      const stopResponse = await new Promise<{
        success: boolean;
        message: string;
      }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for stop_voice response"));
        }, 5000);

        socket.once("stop_voice_response", (data) => {
          clearTimeout(timeout);
          // eslint-disable-next-line no-console
          console.log("[Voice] Received stop_voice_response:", data);
          resolve(data);
        });

        socket.once("stop_voice_error", (data) => {
          clearTimeout(timeout);
          // eslint-disable-next-line no-console
          console.error("[Voice] Received stop_voice_error:", data);
          reject(new Error(data.message || "Failed to stop voice session"));
        });

        socket.emit("stop_voice", { chat_id: currentChat.id });
        // eslint-disable-next-line no-console
        console.log("[Voice] Emitted stop_voice event");
      });

      if (!stopResponse.success) {
        throw new Error(stopResponse.message || "Failed to stop voice session");
      }

      toolContextMapRef.current = {};
      await cleanupRealtime();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to stop voice mode";
      // eslint-disable-next-line no-console
      console.error("[Voice] Error stopping voice mode:", {
        error: errorMessage,
        error_object: error,
      });
      toast.error(errorMessage);
    } finally {
      setIsStoppingVoice(false);
    }
  }, [cleanupRealtime, currentChat?.id, isConnected, socket, voiceModeEnabled]);

  const startVoiceMode = useCallback(async () => {
    if (!currentChat?.id || !socket || !isConnected) {
      toast.error("Cannot enable voice mode: chat or connection not available");
      return;
    }

    setIsStartingVoice(true);
    try {
      // Start voice session on server - this will return ephemeral key + tools + config
      // eslint-disable-next-line no-console
      console.log("[Voice] Emitting start_voice event:", {
        chat_id: currentChat.id,
      });
      socket.emit("start_voice", { chat_id: currentChat.id });

      // Wait for server response with ephemeral key, tools, instructions, config, and tool context map
      // Type definition (will use auto-generated types after ws.json regeneration)
      type StartVoiceResponsePayload = {
        success: boolean;
        message: string;
        ephemeral_key: string;
        persona_tools: Array<{
          name: string;
          description: string;
          parameters: string;
        }>;
        tool_context_map: ToolContextMap;
        instructions: string;
        model: string;
        voice?: string | null;
        transcription_model?: string | null;
        transcription_prompt?: string | null;
        history?: RealtimeItem[]; // Conversation history in RealtimeItem format
      };
      const responseData = await new Promise<StartVoiceResponsePayload>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for voice session start"));
          }, 10000);

          socket.once("start_voice_response", (data) => {
            clearTimeout(timeout);
            // eslint-disable-next-line no-console
            console.log("[Voice] ===== FULL SERVER RESPONSE =====");
            // eslint-disable-next-line no-console
            console.log(
              "[Voice] Received start_voice_response (FULL):",
              JSON.stringify(data, null, 2)
            );
            // eslint-disable-next-line no-console
            console.log("[Voice] Response summary:", {
              success: data.success,
              message: data.message,
              ephemeral_key: data.ephemeral_key
                ? `${data.ephemeral_key.substring(0, 20)}...`
                : null,
              persona_tools_count: data.persona_tools?.length || 0,
              persona_tools: data.persona_tools,
              tool_context_map: data.tool_context_map,
              instructions_length: data.instructions?.length || 0,
              instructions_full: data.instructions,
              model: data.model,
            });
            // eslint-disable-next-line no-console
            console.log("[Voice] ===== END SERVER RESPONSE =====");
            if (data.success) {
              resolve(data);
            } else {
              reject(
                new Error(data.message || "Failed to start voice session")
              );
            }
          });

          socket.once("start_voice_error", (data) => {
            clearTimeout(timeout);
            // eslint-disable-next-line no-console
            console.error("[Voice] Received start_voice_error:", data);
            reject(new Error(data.message || "Failed to start voice session"));
          });
        }
      );

      // Store tool context map for later use
      toolContextMapRef.current = responseData.tool_context_map || {};
      // eslint-disable-next-line no-console
      console.log(
        "[Voice] Stored tool context map:",
        toolContextMapRef.current
      );

      // Convert server tools to RealtimeAgent tools
      // Parse parameters from server (JSON string) and convert to zod schema
      // eslint-disable-next-line no-console
      console.log("[Voice] Processing persona tools:", {
        count: responseData.persona_tools.length,
        tools: responseData.persona_tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters_raw: t.parameters,
        })),
      });

      const realtimeTools = responseData.persona_tools.map((toolDef) => {
        // Parse parameters from server (it's a JSON string)
        let parametersSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
        try {
          const paramsJson = JSON.parse(toolDef.parameters);
          // eslint-disable-next-line no-console
          console.log(
            `[Voice] Parsed parameters for ${toolDef.name}:`,
            paramsJson
          );

          // Convert JSON schema to zod schema
          // For now, we'll construct zod schema based on the JSON schema structure
          if (paramsJson.type === "object" && paramsJson.properties) {
            const zodProps: Record<string, z.ZodTypeAny> = {};

            for (const [key, value] of Object.entries(paramsJson.properties)) {
              const prop = value as { type: string; description?: string };

              let zodType: z.ZodTypeAny;
              switch (prop.type) {
                case "string":
                  zodType = z.string();
                  break;
                case "integer":
                case "number":
                  zodType = z.number();
                  break;
                case "boolean":
                  zodType = z.boolean();
                  break;
                default:
                  zodType = z.string(); // fallback
              }

              // Add description if available
              if (prop.description) {
                zodType = zodType.describe(prop.description);
              }

              // Check if required
              const isRequired = paramsJson.required?.includes(key) ?? true;
              if (!isRequired) {
                zodType = zodType.optional();
              }

              zodProps[key] = zodType;
            }

            parametersSchema = z.object(zodProps);
          } else {
            // Fallback: use default schema for persona tools
            parametersSchema = z.object({
              message: z
                .string()
                .describe(
                  `Respond as the persona. This is the message that will be said.`
                ),
            });
          }
        } catch (error) {
          // If parsing fails, use default schema
          // eslint-disable-next-line no-console
          console.warn(
            `Failed to parse parameters for tool ${toolDef.name}:`,
            error
          );
          parametersSchema = z.object({
            message: z
              .string()
              .describe(
                `Respond as the persona. This is the message that will be said.`
              ),
          });
        }

        // Tool descriptions are minimal (how to use, when to call)
        // Persona instructions are included in the main instructions field
        const toolInstance = tool({
          name: toolDef.name,
          description: toolDef.description,
          parameters: parametersSchema,
          async execute(args) {
            // The tool's execute function is called by RealtimeSession
            // The actual forwarding to server happens in session.on("agent_tool_start") handler
            // Just return a confirmation - streaming is handled via transport events (voice_tool_call_delta/done)
            // eslint-disable-next-line no-console
            console.log(`[Voice] ===== TOOL EXECUTE CALLED =====`, {
              tool_name: toolDef.name,
              args,
              args_type: typeof args,
              args_stringified: JSON.stringify(args),
            });
            // eslint-disable-next-line no-console
            console.log(`[Voice] ===== END TOOL EXECUTE =====`);
            return `Tool ${toolDef.name} executed`;
          },
        });

        // eslint-disable-next-line no-console
        console.log(`[Voice] Created tool instance:`, {
          name: toolInstance.name,
          description: toolInstance.description,
        });

        return toolInstance;
      });

      // Create RealtimeAgent with tools and server-provided instructions
      const agent = new RealtimeAgent({
        name: "Voice Agent",
        instructions:
          responseData.instructions ||
          "You are a voice agent that manages conversations between personas.",
        tools: realtimeTools,
      });

      // eslint-disable-next-line no-console
      console.log("[Voice] ===== REALTIME AGENT CREATION =====");
      // eslint-disable-next-line no-console
      console.log("[Voice] Created RealtimeAgent:", {
        name: agent.name,
        instructions_length: responseData.instructions?.length || 0,
        instructions_full: responseData.instructions,
        tools_count: realtimeTools.length,
        tool_names: realtimeTools.map((t) => t.name),
        tools_full: realtimeTools.map((t) => ({
          name: t.name,
          description: t.description,
          // @ts-expect-error - accessing internal properties for debugging
          parameters: t.parameters?._def?.shape || t.parameters,
        })),
      });
      // eslint-disable-next-line no-console
      console.log("[Voice] RealtimeAgent instance:", agent);
      // eslint-disable-next-line no-console
      console.log("[Voice] ===== END REALTIME AGENT =====");

      // Map server fields to full RealtimeSessionConfigDefinition
      // Build outputModalities array - Realtime API only supports ONE modality at a time
      // For voice mode, default to "audio" for output (we can still get transcripts from input transcription)
      const outputModalities: ("text" | "audio")[] = ["audio"];

      // Build audio.input.transcription from transcription_model and transcription_prompt
      const audioInputTranscription: {
        model?: string;
        prompt?: string;
        language?: string;
      } = {};
      if (responseData.transcription_model) {
        audioInputTranscription.model = responseData.transcription_model;
      }
      if (responseData.transcription_prompt) {
        audioInputTranscription.prompt = responseData.transcription_prompt;
      }

      // Build audio config with input and output
      const audioConfig: {
        input?: {
          format?: string | { type: string; rate: number };
          transcription?: {
            model?: string;
            prompt?: string;
            language?: string;
          };
        };
        output?: {
          format?: string | { type: string; rate: number };
          voice?: string;
          speed?: number;
        };
      } = {
        input: {
          format: "pcm16", // Default format
          ...(Object.keys(audioInputTranscription).length > 0
            ? { transcription: audioInputTranscription }
            : {}),
        },
        output: {
          format: "pcm16", // Default format
          ...(responseData.voice ? { voice: responseData.voice } : {}),
        },
      };

      // Construct full config object
      // Use strongly typed config that excludes tools - tools come from RealtimeAgent
      // Explicitly exclude 'tools' from config type to enforce that tools come from agent
      type RealtimeSessionConfigWithoutTools = Omit<
        Partial<RealtimeSessionConfig>,
        "tools"
      >;

      const config: RealtimeSessionConfigWithoutTools = {
        model: responseData.model,
        instructions: responseData.instructions,
        // Tools are provided via RealtimeAgent, not config - TypeScript will error if we try to add tools
        ...(outputModalities.length > 0 ? { outputModalities } : {}),
        ...(Object.keys(audioConfig).length > 0 ? { audio: audioConfig } : {}),
        ...(responseData.voice ? { voice: responseData.voice } : {}), // Backwards compatibility
      };

      // Create RealtimeSession with mapped config
      const session = new RealtimeSession(agent, {
        model: responseData.model,
        config,
      });

      // eslint-disable-next-line no-console
      console.log("[Voice] ===== REALTIME SESSION CREATION =====");
      // eslint-disable-next-line no-console
      console.log("[Voice] Created RealtimeSession:", {
        model: responseData.model,
        config,
        agent_name: agent.name,
      });

      // Get the actual session config that will be sent to the API
      session
        .getInitialSessionConfig()
        .then((actualConfig) => {
          // eslint-disable-next-line no-console
          console.log(
            "[Voice] ===== ACTUAL SESSION CONFIG (what gets sent to API) ====="
          );
          // eslint-disable-next-line no-console
          console.log(
            "[Voice] Actual session config:",
            JSON.stringify(actualConfig, null, 2)
          );
          // eslint-disable-next-line no-console
          console.log(
            "[Voice] Config tools count:",
            actualConfig.tools?.length || 0
          );
          // eslint-disable-next-line no-console
          console.log(
            "[Voice] Config tools:",
            actualConfig.tools?.map((t) => {
              if (t.type === "function") {
                return {
                  name: t.name,
                  description: t.description,
                  type: t.type,
                };
              } else {
                return {
                  type: t.type,
                  server_label:
                    "server_label" in t ? t.server_label : undefined,
                };
              }
            }) || []
          );
          // eslint-disable-next-line no-console
          console.log(
            "[Voice] Config instructions:",
            actualConfig.instructions
          );
          // eslint-disable-next-line no-console
          console.log("[Voice] ===== END ACTUAL SESSION CONFIG =====");
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error("[Voice] Failed to get initial session config:", err);
        });
      // eslint-disable-next-line no-console
      console.log("[Voice] ===== END REALTIME SESSION =====");

      // Set up event listeners - library handles audio playback automatically
      // Listen for ALL events to debug tool call issues
      session.on("error", (error) => {
        // eslint-disable-next-line no-console
        console.error("[Voice] ===== REALTIME SESSION ERROR =====");
        // eslint-disable-next-line no-console
        console.error("[Voice] Error object:", error);
        // eslint-disable-next-line no-console
        console.error("[Voice] Error string:", String(error));
        // eslint-disable-next-line no-console
        console.error("[Voice] ===== END ERROR =====");
      });

      // Listen to ALL transport events for debugging
      session.transport.on(
        "*",
        (event: { type: string; [key: string]: unknown }) => {
          // eslint-disable-next-line no-console
          console.log("[Voice] ===== TRANSPORT EVENT =====");
          // eslint-disable-next-line no-console
          console.log("[Voice] Transport event type:", event.type);
          // eslint-disable-next-line no-console
          console.log("[Voice] Transport event data:", event);
          // eslint-disable-next-line no-console
          console.log("[Voice] ===== END TRANSPORT EVENT =====");
        }
      );

      // Listen for speech started event and transport to server
      session.transport.on(
        "input_audio_buffer.speech_started",
        (evt: {
          type: "input_audio_buffer.speech_started";
          event_id: string;
          item_id: string;
          audio_start_ms: number;
        }) => {
          // eslint-disable-next-line no-console
          console.log("[Voice] ===== SPEECH STARTED =====");
          // eslint-disable-next-line no-console
          console.log("[Voice] Speech started event:", {
            type: evt.type,
            item_id: evt.item_id,
            audio_start_ms: evt.audio_start_ms,
          });

          if (!socket || !currentChat?.id) {
            // eslint-disable-next-line no-console
            console.warn(
              "[Voice] Missing socket or chat_id, cannot transport event"
            );
            return;
          }

          // Transport event to server (AttemptMessages will handle optimistic UI)
          socket.emit("voice_speech_started", {
            chat_id: currentChat.id,
            item_id: evt.item_id,
          });

          // eslint-disable-next-line no-console
          console.log("[Voice] Transported voice_speech_started to server:", {
            chat_id: currentChat.id,
            item_id: evt.item_id,
          });
          // eslint-disable-next-line no-console
          console.log("[Voice] ===== END SPEECH STARTED =====");

          // Start user audio recording
          (async () => {
            try {
              if (!userMediaStreamRef.current) {
                userMediaStreamRef.current =
                  await navigator.mediaDevices.getUserMedia({ audio: true });
              }

              if (!userRecorderRef.current) {
                userRecorderRef.current = new MediaRecorder(
                  userMediaStreamRef.current,
                  {
                    mimeType: "audio/webm;codecs=opus",
                  }
                );

                userRecorderRef.current.ondataavailable = (e) => {
                  if (e.data.size > 0) {
                    userAudioChunksRef.current.push(e.data);
                  }
                };
              }

              userAudioChunksRef.current = [];
              userRecorderRef.current.start();
              // eslint-disable-next-line no-console
              console.log(
                "[Voice] Started user audio recording for item:",
                evt.item_id
              );
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error(
                "[Voice] Failed to start user audio recording:",
                err
              );
            }
          })();
        }
      );

      // Listen for tool call argument deltas and forward to server
      session.transport.on(
        "response.function_call_arguments.delta",
        (evt: {
          type: "response.function_call_arguments.delta";
          call_id: string;
          item_id: string;
          delta: string;
          response_id: string;
        }) => {
          // eslint-disable-next-line no-console
          console.log("[Voice] ===== TOOL CALL DELTA =====");
          // eslint-disable-next-line no-console
          console.log("[Voice] Tool call delta event:", {
            call_id: evt.call_id,
            item_id: evt.item_id,
            delta_length: evt.delta.length,
            response_id: evt.response_id,
          });

          if (!socket || !currentChat?.id) {
            // eslint-disable-next-line no-console
            console.warn(
              "[Voice] Missing socket or chat_id, cannot forward delta event"
            );
            return;
          }

          // Forward delta event to server
          socket.emit("voice_tool_call_delta", {
            chat_id: currentChat.id,
            call_id: evt.call_id,
            item_id: evt.item_id,
            delta: evt.delta,
            response_id: evt.response_id,
          });

          // eslint-disable-next-line no-console
          console.log("[Voice] Forwarded tool call delta to server");
          // eslint-disable-next-line no-console
          console.log("[Voice] ===== END TOOL CALL DELTA =====");
        }
      );

      // Listen for tool call argument completion and forward to server
      session.transport.on(
        "response.function_call_arguments.done",
        (evt: {
          type: "response.function_call_arguments.done";
          call_id: string;
          item_id: string;
          arguments: string;
          response_id: string;
        }) => {
          // eslint-disable-next-line no-console
          console.log("[Voice] ===== TOOL CALL DONE =====");
          // eslint-disable-next-line no-console
          console.log("[Voice] Tool call done event:", {
            call_id: evt.call_id,
            item_id: evt.item_id,
            arguments_length: evt.arguments.length,
            response_id: evt.response_id,
          });

          if (!socket || !currentChat?.id) {
            // eslint-disable-next-line no-console
            console.warn(
              "[Voice] Missing socket or chat_id, cannot forward done event"
            );
            return;
          }

          // Forward done event to server
          socket.emit("voice_tool_call_done", {
            chat_id: currentChat.id,
            call_id: evt.call_id,
            item_id: evt.item_id,
            arguments: evt.arguments,
            response_id: evt.response_id,
          });

          // eslint-disable-next-line no-console
          console.log("[Voice] Forwarded tool call done to server");
          // eslint-disable-next-line no-console
          console.log("[Voice] ===== END TOOL CALL DONE =====");
        }
      );

      // Listen for speech stopped event to stop user audio recording
      session.transport.on(
        "input_audio_buffer.speech_stopped",
        async (evt: {
          type: "input_audio_buffer.speech_stopped";
          event_id: string;
          item_id: string;
        }) => {
          // eslint-disable-next-line no-console
          console.log("[Voice] Speech stopped event:", {
            type: evt.type,
            item_id: evt.item_id,
          });

          if (
            !userRecorderRef.current ||
            userRecorderRef.current.state === "inactive"
          ) {
            return;
          }

          try {
            userRecorderRef.current.stop();

            userRecorderRef.current.onstop = async () => {
              try {
                const blob = new Blob(userAudioChunksRef.current, {
                  type: "audio/webm",
                });
                userAudioChunksRef.current = [];

                if (!socket || !currentChat?.id) {
                  // eslint-disable-next-line no-console
                  console.warn(
                    "[Voice] Missing socket or chat_id, cannot upload user audio"
                  );
                  return;
                }

                const uploadId = await uploadAudioWithTus(blob, {
                  filename: `user-${evt.item_id}.webm`,
                  filetype: "audio/webm",
                  role: "user",
                  subfolder: "audio",
                });

                // Store upload_id for this item_id to link when transcript arrives
                audioUploadIdRef.current.set(evt.item_id, uploadId);

                // eslint-disable-next-line no-console
                console.log("[Voice] Uploaded user audio:", {
                  item_id: evt.item_id,
                  upload_id: uploadId,
                });
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[Voice] Failed to upload user audio:", err);
              }
            };
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[Voice] Error stopping user audio recorder:", err);
          }
        }
      );

      // Listen for audio transcription completion events
      // These fire when mic audio is transcribed (not from history_added)
      session.transport.on(
        "conversation.item.input_audio_transcription.completed",
        (evt: {
          type: "conversation.item.input_audio_transcription.completed";
          transcript: string;
          item_id: string;
          content_index: number;
        }) => {
          // eslint-disable-next-line no-console
          console.log(
            "[Voice] ===== INPUT AUDIO TRANSCRIPTION COMPLETED ====="
          );
          // eslint-disable-next-line no-console
          console.log("[Voice] Transcription event:", {
            type: evt.type,
            transcript: evt.transcript,
            item_id: evt.item_id,
            content_index: evt.content_index,
          });

          const transcript = (evt.transcript || "").trim();
          if (!transcript) {
            // eslint-disable-next-line no-console
            console.warn("[Voice] Empty transcript, skipping");
            return;
          }

          if (!socket || !currentChat?.id) {
            // eslint-disable-next-line no-console
            console.warn(
              "[Voice] Missing socket or chat_id, cannot transport transcript"
            );
            return;
          }

          // Get upload_id for this item_id if it exists
          const uploadId = audioUploadIdRef.current.get(evt.item_id);

          // Transport transcript to server
          // This will:
          // 1. Update optimistic UI (via voice_transcript_ready event)
          // 2. Create the real user message (via simulation_new_message event)
          // 3. Link audio upload to message if upload_id is available
          socket.emit("voice_transcript_ready", {
            chat_id: currentChat.id,
            item_id: evt.item_id,
            transcript: transcript,
            upload_id: uploadId || undefined,
          });

          // Clean up stored upload_id after sending
          if (uploadId) {
            audioUploadIdRef.current.delete(evt.item_id);
          }

          // eslint-disable-next-line no-console
          console.log("[Voice] Transported voice_transcript_ready to server:", {
            chat_id: currentChat.id,
            item_id: evt.item_id,
            transcript: transcript.substring(0, 100),
          });
          // eslint-disable-next-line no-console
          console.log("[Voice] ===== END TRANSCRIPTION COMPLETED =====");
        }
      );

      // Listen for audio transcription delta events (streaming partials)
      session.transport.on(
        "conversation.item.input_audio_transcription.delta",
        (evt: {
          type: "conversation.item.input_audio_transcription.delta";
          delta: string;
          item_id: string;
          content_index: number;
        }) => {
          // eslint-disable-next-line no-console
          console.log("[Voice] ===== INPUT AUDIO TRANSCRIPTION DELTA =====");
          // eslint-disable-next-line no-console
          console.log("[Voice] Transcription delta:", {
            type: evt.type,
            delta: evt.delta,
            item_id: evt.item_id,
            content_index: evt.content_index,
          });
          // eslint-disable-next-line no-console
          console.log("[Voice] ===== END TRANSCRIPTION DELTA =====");
        }
      );

      // Listen for tool calls using agent_tool_start event
      session.on("agent_tool_start", (_runCtx, _agent, toolDef, args) => {
        // eslint-disable-next-line no-console
        console.log("[Voice] agent_tool_start:", {
          tool_name: toolDef.name,
          args,
        });

        // Extract actual arguments from the args parameter
        // The SDK may wrap arguments in different structures, so we need to handle both cases
        let actualArguments: Record<string, unknown> = {};

        // Check if args has a toolCall property with nested arguments
        if (
          args &&
          typeof args === "object" &&
          "toolCall" in args &&
          args.toolCall &&
          typeof args.toolCall === "object"
        ) {
          const toolCall = args.toolCall as {
            arguments?: string | Record<string, unknown>;
          };
          // If arguments is a JSON string, parse it
          if (typeof toolCall.arguments === "string") {
            try {
              actualArguments = JSON.parse(toolCall.arguments);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn(
                "[Voice] Failed to parse toolCall.arguments as JSON:",
                e
              );
              actualArguments = args as Record<string, unknown>;
            }
          } else if (toolCall.arguments) {
            actualArguments = toolCall.arguments as Record<string, unknown>;
          } else {
            // Fallback: use args directly
            actualArguments = args as Record<string, unknown>;
          }
        } else {
          // If args is already the flat arguments object, use it directly
          actualArguments = args as Record<string, unknown>;
        }

        // eslint-disable-next-line no-console
        console.log("[Voice] Extracted actual arguments:", actualArguments);

        // Handle debug_info tool separately
        if (toolDef.name === "debug_info") {
          const content = actualArguments["content"] as string;
          if (!content) {
            // eslint-disable-next-line no-console
            console.error(
              `[Voice] No content in arguments for debug_info tool`
            );
            return;
          }

          // Emit debug_info event to server
          socket.emit("voice_debug_info", {
            chat_id: currentChat.id,
            content: content,
          });
          // eslint-disable-next-line no-console
          console.log("[Voice] Emitted voice_debug_info to server:", {
            chat_id: currentChat.id,
            content: content.substring(0, 100),
          });
          return;
        }

        // Handle speak tool - now handled via transport events (response.function_call_arguments.delta/done)
        // The transport events are forwarded to voice_tool_call_delta/voice_tool_call_done handlers
        if (toolDef.name === "speak") {
          // eslint-disable-next-line no-console
          console.log(
            "[Voice] speak tool detected - streaming handled via transport events"
          );
          return;
        }

        // Unknown tool
        // eslint-disable-next-line no-console
        console.warn(`[Voice] Unknown tool: ${toolDef.name}`);
      });

      session.on(
        "agent_tool_end",
        (_runCtx, _agent, toolDef, result, rawResult) => {
          // eslint-disable-next-line no-console
          console.log("[Voice] agent_tool_end:", {
            tool_name: toolDef.name,
            result,
            rawResult,
          });
        }
      );

      session.on("audio_interrupted", () => {
        // eslint-disable-next-line no-console
        console.log("[Voice] RealtimeSession audio_interrupted event");
        // Notify server of interruption
        socket.emit("voice_interrupted", {
          chat_id: currentChat.id,
        });
      });

      // Assistant finished speaking (natural completion)
      // Listen for response.done which fires when the entire response completes
      // This includes usage data and signals the end of the response cycle
      session.transport.on(
        "response.done",
        (evt: {
          type: "response.done";
          event_id: string;
          response: {
            id: string;
            conversation_id: string;
            usage: {
              input_token_details: {
                audio_tokens: number;
                text_tokens: number;
                image_tokens: number;
                cached_tokens: number;
                cached_tokens_details?: {
                  audio_tokens: number;
                  text_tokens: number;
                  image_tokens: number;
                };
              };
              output_token_details: {
                audio_tokens: number;
                text_tokens: number;
              };
              input_tokens: number;
              output_tokens: number;
            };
          };
        }) => {
          // eslint-disable-next-line no-console
          console.log("[Voice] response.done (response complete):", {
            event_id: evt.event_id,
            response_id: evt.response.id,
            conversation_id: evt.response.conversation_id,
            usage: evt.response.usage,
          });

          if (!socket || !currentChat?.id) return;

          // Extract usage details
          const inputTokenDetails = evt.response.usage.input_token_details;
          const outputTokenDetails = evt.response.usage.output_token_details;
          const cachedDetails = inputTokenDetails.cached_tokens_details || {
            audio_tokens: 0,
            text_tokens: 0,
            image_tokens: 0,
          };

          // Send usage data to backend for run creation and token tracking
          socket.emit("voice_response_done", {
            chat_id: currentChat.id,
            event_id: evt.event_id,
            response_id: evt.response.id,
            conversation_id: evt.response.conversation_id,
            usage: {
              input_token_details: {
                audio_tokens: inputTokenDetails.audio_tokens || 0,
                text_tokens: inputTokenDetails.text_tokens || 0,
                image_tokens: inputTokenDetails.image_tokens || 0,
                cached_tokens: inputTokenDetails.cached_tokens || 0,
                cached_tokens_details: {
                  audio_tokens: cachedDetails.audio_tokens || 0,
                  text_tokens: cachedDetails.text_tokens || 0,
                  image_tokens: cachedDetails.image_tokens || 0,
                },
              },
              output_token_details: {
                audio_tokens: outputTokenDetails.audio_tokens || 0,
                text_tokens: outputTokenDetails.text_tokens || 0,
              },
              input_tokens: evt.response.usage.input_tokens,
              output_tokens: evt.response.usage.output_tokens,
            },
          });
        }
      );

      // Unify *all* user messages (typed or microphone transcripts)
      session.on("history_added", (item: RealtimeItem) => {
        try {
          // Only care about message items
          if (!item || item.type !== "message") return;

          // Only forward user messages
          if (item.role !== "user") return;

          // Avoid double-processing the same item
          if (processedItemIdsRef.current.has(item.itemId)) return;
          processedItemIdsRef.current.add(item.itemId);

          // RealtimeMessageItem.content: array of input_text or input_audio
          // We want either the text or the transcript.
          const contentArray = item.content as Array<
            | { type: "input_text"; text: string }
            | {
                type: "input_audio";
                audio?: string | null;
                transcript: string | null;
              }
          >;

          const textParts: string[] = [];

          for (let i = 0; i < (contentArray ?? []).length; i++) {
            const c = contentArray[i];
            if (!c) continue;

            if (c.type === "input_text" && typeof c.text === "string") {
              textParts.push(c.text);
            } else if (
              c.type === "input_audio" &&
              typeof c.transcript === "string" &&
              c.transcript.trim().length > 0
            ) {
              textParts.push(c.transcript);
            }
          }

          const finalText = textParts.join(" ").trim();
          if (!finalText) return;
          if (!socket || !currentChat?.id) return;

          socket.emit("voice_user_message", {
            chat_id: currentChat.id,
            message: finalText,
          });

          // eslint-disable-next-line no-console
          console.log("[Voice] Forwarded user message from history_added:", {
            itemId: item.itemId,
            message: finalText,
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[Voice] Error in history_added handler:", err);
        }
      });

      // Connect session with ephemeral key
      // WebRTC transport will automatically handle mic/speaker
      // eslint-disable-next-line no-console
      console.log("[Voice] Connecting RealtimeSession with ephemeral key...");
      // eslint-disable-next-line no-console
      console.log("[Voice] ===== CONNECTING SESSION =====");
      // eslint-disable-next-line no-console
      console.log("[Voice] About to connect with ephemeral key:", {
        ephemeral_key_preview:
          responseData.ephemeral_key?.substring(0, 20) + "...",
        config_instructions: config.instructions,
        config_instructions_length: config.instructions?.length || 0,
      });

      await session.connect({ apiKey: responseData.ephemeral_key });

      // eslint-disable-next-line no-console
      console.log("[Voice] RealtimeSession connected successfully");
      // eslint-disable-next-line no-console
      console.log("[Voice] ===== END CONNECTION =====");

      // Reset history with existing conversation history after connecting
      // This ensures the RealtimeSession sees the same history as the React chat
      // resetHistory is the officially supported way to load existing chat history
      // Must be called after connect() because it sends events to the API
      if (responseData.history && responseData.history.length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          "[Voice] Resetting history with",
          responseData.history.length,
          "items"
        );
        // eslint-disable-next-line no-console
        console.log("[Voice] History items:", responseData.history);
        // resetHistory is available on the transport layer, not directly on session
        session.transport.resetHistory([], responseData.history);
        // eslint-disable-next-line no-console
        console.log("[Voice] History reset completed");
      } else {
        // eslint-disable-next-line no-console
        console.log("[Voice] No history to reset (new chat)");
      }

      realtimeSessionRef.current = session;

      // Get microphone stream for waveform visualization
      // This is separate from the RealtimeSession's WebRTC stream
      try {
        if (!userMediaStreamRef.current) {
          userMediaStreamRef.current =
            await navigator.mediaDevices.getUserMedia({ audio: true });
          // eslint-disable-next-line no-console
          console.log(
            "[Voice] Got microphone stream for waveform visualization"
          );
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "[Voice] Failed to get microphone stream for visualization:",
          err
        );
        // Continue anyway - waveform will just not show audio levels
      }

      // Ensure we start unmuted when entering voice mode
      try {
        session.mute(false);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(
          "[Voice] mute(false) failed (transport might not support mute):",
          e
        );
      }
      setIsMicMuted(false);
      setVoiceModeEnabled(true);

      // eslint-disable-next-line no-console
      console.log("[Voice] Voice mode enabled successfully", {
        chat_id: currentChat.id,
        tools_count: realtimeTools.length,
        session_connected: true,
      });
    } catch (error) {
      // Log error for debugging (ESLint allows in catch blocks)
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start voice mode";
      // eslint-disable-next-line no-console
      console.error("[Voice] Error starting voice mode:", {
        error: errorMessage,
        error_object: error,
        chat_id: currentChat.id,
      });
      toast.error(errorMessage);
      // Cleanup on error
      await cleanupRealtime();
    } finally {
      setIsStartingVoice(false);
    }
  }, [cleanupRealtime, currentChat?.id, isConnected, socket]);

  // Voice mode handlers
  const handleVoiceToggle = useCallback(async () => {
    // If voice mode is not enabled, this button starts it
    if (!voiceModeEnabled) {
      await startVoiceMode();
      return;
    }

    // Voice mode is enabled → toggle mute
    const session = realtimeSessionRef.current;
    if (!session) {
      // eslint-disable-next-line no-console
      console.warn("[Voice] No RealtimeSession present while toggling mute");
      return;
    }

    const currentlyMuted = session.muted ?? isMicMuted;
    const nextMuted = !currentlyMuted;

    try {
      session.mute(nextMuted);
      setIsMicMuted(nextMuted);
      // eslint-disable-next-line no-console
      console.log("[Voice] Toggled mute:", { nextMuted });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[Voice] Error toggling mute:", e);
      toast.error("Could not toggle microphone mute");
    }
  }, [startVoiceMode, voiceModeEnabled, isMicMuted]);

  // Cleanup on unmount or chat change
  useEffect(() => {
    return () => {
      // Fire-and-forget async cleanup
      (async () => {
        await cleanupRealtime();
      })();
    };
  }, [currentChat?.id, cleanupRealtime]);

  // --- Effects ---
  useEffect(() => {
    setNewMessage("");
  }, [currentChat?.id]);

  // Auto-resize the textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;

      // Notify parent of height change
      if (onHeightChange) {
        const maxTextareaHeight = 128; // max-h-32 = 8rem = 128px
        const actualTextareaHeight = Math.min(
          textarea.scrollHeight,
          maxTextareaHeight
        );
        const totalHeight = actualTextareaHeight + 24; // Add padding (0px top + 8px bottom + 24px for button area)
        const clampedHeight = Math.min(Math.max(totalHeight, 60), 160); // Clamp between 60px and 160px
        onHeightChange(clampedHeight);
      }
    }
  }, [newMessage, onHeightChange]);

  // Initialize paste prevention previous value
  useEffect(() => {
    pastePrevention.updatePrevValue(newMessage);
  }, [newMessage, pastePrevention]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !currentChat?.completed &&
        // Always allow input - don't disable based on timer
        true &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        e.key.length === 1 &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        textareaRef.current
      ) {
        textareaRef.current.focus();
        setNewMessage((prev) => sanitizeInputLength(prev + e.key));
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentChat?.completed]);

  // Hide input if not the attempt owner or if read-only/completed
  if (readOnly || currentChat?.completed || !isAttemptOwner) return null;

  return (
    <TooltipProvider>
      <CardFooter
        ref={inputPanelRef}
        className="h-full px-2 pb-1.5 pt-0 border-t flex flex-col justify-end min-h-0"
      >
        {/* --- Dynamic Input Area --- */}
        <div className="w-full flex items-end gap-2 shrink-0">
          {/* Voice toggle button - only show when voice mode is disabled */}
          {!voiceModeEnabled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="min-h-[40px] h-[40px] w-[40px] shrink-0"
                  onClick={handleVoiceToggle}
                  disabled={
                    readOnly ||
                    !isConnected ||
                    !currentChat?.id ||
                    isStartingVoice ||
                    isStoppingVoice
                  }
                  data-testid="voice-toggle-button"
                >
                  {isStartingVoice ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Enable voice mode</p>
              </TooltipContent>
            </Tooltip>
          )}

          {voiceModeEnabled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="min-h-[40px] h-[40px] w-[40px] shrink-0"
                  onClick={handleVoiceStop}
                  disabled={
                    readOnly ||
                    !isConnected ||
                    !currentChat?.id ||
                    isStartingVoice ||
                    isStoppingVoice
                  }
                  data-testid="voice-exit-button"
                >
                  {isStoppingVoice ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Exit voice mode</p>
              </TooltipContent>
            </Tooltip>
          )}
          {/* Wrap both the Waveform and Textarea in a container that enforces the
              "Input Box" look (Border, Radius, Background) */}
          <div className="flex-1 relative min-h-[40px] max-h-32 flex items-center">
            {voiceModeEnabled && !isMicMuted ? (
              <div className="w-full h-[40px] rounded-md border border-input bg-background px-3 py-2 flex items-center justify-center ring-offset-background overflow-hidden">
                <VoiceWaveform
                  mediaStream={userMediaStreamRef.current}
                  className="w-full h-full"
                />
              </div>
            ) : (
              /* Show textarea when voice mode is disabled OR when muted */
              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) =>
                  pastePrevention.handleChange(e, (value) =>
                    setNewMessage(sanitizeInputLength(value))
                  )
                }
                placeholder={
                  voiceModeEnabled
                    ? "Voice mode active – mute to type and send"
                    : "Type your message (LaTeX supported)"
                }
                disabled={readOnly ? true : false}
                className="w-full text-md resize-none overflow-y-auto text-base max-h-32 min-h-[40px]"
                rows={1}
                maxLength={MAX_INPUT_CHARS}
                data-testid="attempt-chat-input"
                // Block paste/drop at the earliest stage
                onBeforeInput={pastePrevention.handleBeforeInput}
                onPaste={pastePrevention.handlePaste}
                onPasteCapture={pastePrevention.handlePasteCapture}
                onDrop={pastePrevention.handleDrop}
                // Kill context menu (mouse + long-press)
                onContextMenu={pastePrevention.handleContextMenu}
                // Block middle-click paste (Linux/X11 primary selection)
                onMouseDown={pastePrevention.handleMouseDown}
                onKeyDown={(e) =>
                  pastePrevention.handleKeyDown(e, handleSendMessage)
                }
                // IME composition support
                onCompositionStart={pastePrevention.handleCompositionStart}
                onCompositionEnd={pastePrevention.handleCompositionEnd}
                // Reduce "smart" automatic inserts that look like paste/autofill
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            )}
          </div>

          <div className="flex gap-2">
            {/* Show stop button when sending message (takes priority) */}
            {isSendingMessage ? (
              <motion.div
                layout
                key="stop-btn"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      className="min-h-[40px] h-[40px] px-3"
                      variant="destructive"
                      disabled={readOnly || isStoppingMessage}
                      onClick={handleStopMessage}
                      data-testid="attempt-stop-button"
                    >
                      {isStoppingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stop sending</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            ) : voiceModeEnabled && !hasTextMessage ? (
              /* Show mute/unmute button in send position when voice mode enabled and no text */
              <motion.div
                layout
                key="mute-btn"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      className="min-h-[40px] h-[40px] px-3"
                      variant={isMicMuted ? "outline" : "default"}
                      disabled={
                        readOnly ||
                        !isConnected ||
                        !currentChat?.id ||
                        isStartingVoice ||
                        isStoppingVoice
                      }
                      onClick={handleVoiceToggle}
                      data-testid="voice-mute-toggle-button"
                    >
                      {isMicMuted ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {isMicMuted ? "Unmute microphone" : "Mute microphone"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            ) : (
              /* Show send button when text is present or voice mode is disabled */
              <motion.div
                layout
                key="send-btn-short"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="submit"
                      className="min-h-[40px] h-[40px] px-3"
                      variant="default"
                      disabled={readOnly || !isConnected || !hasTextMessage}
                      onClick={(e) => handleSendMessage(e)}
                      data-testid="attempt-send-button"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  {getConnectionTooltip() && (
                    <TooltipContent>
                      <p>{getConnectionTooltip()}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </motion.div>
            )}
          </div>
        </div>

        {/* Removed "Time's up!" message - allow users to continue with negative timer */}
      </CardFooter>
    </TooltipProvider>
  );
}
