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
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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
        // Stop voice session on server
        socket.emit("stop_voice", { chat_id: currentChat.id });

        // Disconnect Realtime session
        if (realtimeSessionRef.current) {
          await realtimeSessionRef.current.disconnect();
          realtimeSessionRef.current = null;
        }

        // Stop microphone
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        if (audioContextRef.current) {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }

        setVoiceModeEnabled(false);
        toast.success("Voice mode disabled");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to stop voice mode";
        toast.error(errorMessage);
      } finally {
        setIsStoppingVoice(false);
      }
    } else {
      // Start voice mode
      setIsStartingVoice(true);
      try {
        // Start voice session on server - this will return ephemeral key + tools + config
        socket.emit("start_voice", { chat_id: currentChat.id });

        // Wait for server response with ephemeral key, tools, and config
        const responseData = await new Promise<{
          success: boolean;
          message: string;
          ephemeral_key: string;
          persona_tools: Array<{
            name: string;
            description: string;
            parameters: Record<string, unknown>;
          }>;
          config: Record<string, unknown>;
        }>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for voice session start"));
          }, 10000);

          socket.once("start_voice_response", (data) => {
            clearTimeout(timeout);
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
            reject(new Error(data.message || "Failed to start voice session"));
          });
        });

        // Convert server tools to RealtimeAgent tools
        // All persona tools have a message parameter based on server implementation
        const realtimeTools = responseData.persona_tools.map((toolDef) => {
          return tool({
            name: toolDef.name,
            description: toolDef.description,
            parameters: z.object({
              message: z
                .string()
                .describe(
                  `Respond as the persona. This is the message that will be said.`
                ),
            }),
            async execute(args) {
              // Forward tool call to server via WebSocket
              socket.emit("voice_realtime_event", {
                chat_id: currentChat.id,
                event_type: "response.function_call_arguments.done",
                event_data: JSON.stringify({
                  name: toolDef.name,
                  arguments: args,
                }),
              });
              return `Tool ${toolDef.name} executed`;
            },
          });
        });

        // Create RealtimeAgent with tools
        const agent = new RealtimeAgent({
          name: "Voice Assistant",
          instructions:
            "You are a helpful voice assistant that orchestrates conversations between personas.",
          tools: realtimeTools,
        });

        // Create RealtimeSession with config from server
        const session = new RealtimeSession(agent, {
          model: "gpt-realtime",
          config: responseData.config,
        });

        // Set up event listeners - library handles audio playback automatically
        session.on(
          "function_call",
          (event: { name: string; arguments: Record<string, unknown> }) => {
            // Forward tool call to server with strongly typed event
            socket.emit("voice_tool_call", {
              chat_id: currentChat.id,
              tool_name: event.name,
              arguments: event.arguments,
            });
          }
        );

        session.on("audio_interrupted", () => {
          // Notify server of interruption
          socket.emit("voice_interrupted", {
            chat_id: currentChat.id,
          });
        });

        // Connect session with ephemeral key
        await session.connect({ apiKey: responseData.ephemeral_key });
        realtimeSessionRef.current = session;

        // Start microphone capture
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;

        // Set up audio context for processing input
        const audioContext = new AudioContext({ sampleRate: 24000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          if (realtimeSessionRef.current && voiceModeEnabled) {
            const inputData = e.inputBuffer.getChannelData(0);
            // Convert Float32Array to ArrayBuffer (PCM16) for Realtime API
            const buffer = new ArrayBuffer(inputData.length * 2);
            const view = new DataView(buffer);
            for (let i = 0; i < inputData.length; i++) {
              const sample = Math.max(-1, Math.min(1, inputData[i] ?? 0));
              const int16Value = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
              view.setInt16(i * 2, int16Value, true);
            }
            // Send audio to session - library handles output automatically
            realtimeSessionRef.current.sendAudio(buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        setVoiceModeEnabled(true);
        toast.success("Voice mode enabled");
      } catch (error) {
        // Log error for debugging (ESLint allows in catch blocks)
        const errorMessage =
          error instanceof Error ? error.message : "Failed to start voice mode";
        toast.error(errorMessage);
        // Cleanup on error
        if (realtimeSessionRef.current) {
          await realtimeSessionRef.current.disconnect();
          realtimeSessionRef.current = null;
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      } finally {
        setIsStartingVoice(false);
      }
    }
  }, [voiceModeEnabled, currentChat?.id, socket, isConnected]);

  // Cleanup on unmount or chat change
  useEffect(() => {
    return () => {
      // Cleanup voice mode when component unmounts or chat changes
      if (realtimeSessionRef.current) {
        realtimeSessionRef.current.disconnect().catch(() => {
          // Ignore disconnect errors during cleanup
        });
        realtimeSessionRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          // Ignore close errors during cleanup
        });
        audioContextRef.current = null;
      }
      setVoiceModeEnabled(false);
    };
  }, [currentChat?.id]);

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
