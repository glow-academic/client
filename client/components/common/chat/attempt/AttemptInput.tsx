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
import { Loader2, Mic, MicOff, Send, Square } from "lucide-react";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useProfile } from "@/contexts/profile-context";
import { useNoPasteTextarea } from "@/hooks/use-no-paste-textarea";
import { RealtimeAgent, RealtimeSession, tool } from "@openai/agents/realtime";
import { toast } from "sonner";
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

  const { socket } = useProfile();
  const inputPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const realtimeSessionRef = useRef<RealtimeSession | null>(null);

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

    // Require either text message or sketch to send
    if (!messageToSend || !currentChat || isSendingMessage || !isConnected)
      return;

    setNewMessage("");
    sendMessage(messageToSend);
  };
  const handleStopMessage = () => stopMessage();

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

    setVoiceModeEnabled(false);
  }, []);

  // Voice mode handlers
  const handleVoiceToggle = useCallback(async () => {
    if (!currentChat?.id || !socket || !isConnected) {
      toast.error("Cannot enable voice mode: chat or connection not available");
      return;
    }

    if (voiceModeEnabled) {
      // Stop voice mode
      setIsStoppingVoice(true);
      try {
        // eslint-disable-next-line no-console
        console.log("[Voice] Stopping voice mode:", {
          chat_id: currentChat.id,
        });

        // Wait for server response before disconnecting
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

          // Stop voice session on server
          socket.emit("stop_voice", { chat_id: currentChat.id });
          // eslint-disable-next-line no-console
          console.log("[Voice] Emitted stop_voice event");
        });

        if (!stopResponse.success) {
          throw new Error(
            stopResponse.message || "Failed to stop voice session"
          );
        }

        // Locally tear down session / audio
        await cleanupRealtime();
        toast.success("Voice mode disabled");
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
    } else {
      // Start voice mode
      setIsStartingVoice(true);
      try {
        // Start voice session on server - this will return ephemeral key + tools + config
        // eslint-disable-next-line no-console
        console.log("[Voice] Emitting start_voice event:", {
          chat_id: currentChat.id,
        });
        socket.emit("start_voice", { chat_id: currentChat.id });

        // Wait for server response with ephemeral key, tools, instructions, and config
        const responseData = await new Promise<{
          success: boolean;
          message: string;
          ephemeral_key: string;
          persona_tools: Array<{
            name: string;
            description: string;
            parameters: string; // JSON string from server
          }>;
          instructions: string;
          config: Record<string, unknown>;
        }>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for voice session start"));
          }, 10000);

          socket.once("start_voice_response", (data) => {
            clearTimeout(timeout);
            // eslint-disable-next-line no-console
            console.log("[Voice] Received start_voice_response:", {
              success: data.success,
              message: data.message,
              ephemeral_key: data.ephemeral_key
                ? `${data.ephemeral_key.substring(0, 20)}...`
                : null,
              persona_tools_count: data.persona_tools?.length || 0,
              persona_tools: data.persona_tools,
              instructions: data.instructions,
              config: data.config,
            });
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
        });

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

              for (const [key, value] of Object.entries(
                paramsJson.properties
              )) {
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

          return tool({
            name: toolDef.name,
            description: toolDef.description,
            parameters: parametersSchema,
            async execute(args) {
              // The tool's execute function is called by RealtimeSession
              // The actual forwarding to server happens in session.on("function_call") handler
              // Just return a confirmation - the handler will emit voice_tool_call to server
              // eslint-disable-next-line no-console
              console.log(
                `[Voice] Tool ${toolDef.name} execute called with args:`,
                args
              );
              return `Tool ${toolDef.name} executed`;
            },
          });
        });

        // Create RealtimeAgent with tools and server-provided instructions
        const agent = new RealtimeAgent({
          name: "Voice Assistant",
          instructions:
            responseData.instructions ||
            "You are a helpful voice assistant that orchestrates conversations between personas.",
          tools: realtimeTools,
        });

        // eslint-disable-next-line no-console
        console.log("[Voice] Created RealtimeAgent:", {
          name: agent.name,
          instructions_length: responseData.instructions?.length || 0,
          instructions_preview:
            responseData.instructions?.substring(0, 200) || "",
          tools_count: realtimeTools.length,
          tool_names: realtimeTools.map((t) => t.name),
        });

        // Create RealtimeSession with config from server
        const session = new RealtimeSession(agent, {
          model: "gpt-realtime-mini",
          config: responseData.config,
        });

        // eslint-disable-next-line no-console
        console.log("[Voice] Created RealtimeSession:", {
          model: "gpt-realtime-mini",
          config: responseData.config,
        });

        // Set up event listeners - library handles audio playback automatically
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

          // Forward tool call to server
          socket.emit("voice_tool_call", {
            chat_id: currentChat.id,
            tool_name: toolDef.name,
            arguments: actualArguments,
          });
          // eslint-disable-next-line no-console
          console.log("[Voice] Emitted voice_tool_call to server:", {
            chat_id: currentChat.id,
            tool_name: toolDef.name,
            arguments: actualArguments,
          });
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

        // Connect session with ephemeral key
        // WebRTC transport will automatically handle mic/speaker
        // eslint-disable-next-line no-console
        console.log("[Voice] Connecting RealtimeSession with ephemeral key...");
        await session.connect({ apiKey: responseData.ephemeral_key });
        // eslint-disable-next-line no-console
        console.log("[Voice] RealtimeSession connected successfully");
        realtimeSessionRef.current = session;

        setVoiceModeEnabled(true);
        // eslint-disable-next-line no-console
        console.log("[Voice] Voice mode enabled successfully", {
          chat_id: currentChat.id,
          tools_count: realtimeTools.length,
          session_connected: true,
        });
        toast.success("Voice mode enabled");
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
    }
  }, [voiceModeEnabled, currentChat?.id, socket, isConnected, cleanupRealtime]);

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
          {/* Voice toggle button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={voiceModeEnabled ? "default" : "outline"}
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
                {isStartingVoice || isStoppingVoice ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : voiceModeEnabled ? (
                  <Mic className="h-4 w-4" />
                ) : (
                  <MicOff className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {voiceModeEnabled
                  ? "Voice mode enabled - Click to disable"
                  : "Enable voice mode"}
              </p>
            </TooltipContent>
          </Tooltip>
          <div className="flex-1 relative">
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
                  ? "Voice mode active - speak into your microphone"
                  : "Type your message (LaTeX supported)"
              }
              disabled={readOnly ? true : false}
              className="w-full text-md resize-none overflow-y-auto text-base max-h-32"
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
          </div>

          <div className="flex gap-2">
            {/* Always show the send/stop button, just disable as needed */}
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
                    variant={isSendingMessage ? "destructive" : "default"}
                    disabled={
                      readOnly || isSendingMessage
                        ? isStoppingMessage
                        : !isConnected || !hasTextMessage
                    }
                    onClick={
                      isSendingMessage
                        ? handleStopMessage
                        : (e) => handleSendMessage(e)
                    }
                    data-testid={
                      isSendingMessage
                        ? "attempt-stop-button"
                        : "attempt-send-button"
                    }
                  >
                    {isSendingMessage ? (
                      isStoppingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                {getConnectionTooltip() && (
                  <TooltipContent>
                    <p>{getConnectionTooltip()}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </motion.div>
          </div>
        </div>

        {/* Removed "Time's up!" message - allow users to continue with negative timer */}
      </CardFooter>
    </TooltipProvider>
  );
}
