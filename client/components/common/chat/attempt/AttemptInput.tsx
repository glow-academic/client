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
// Note: After ws.json is regenerated with simulation_voice_start_response, import and use:
// import type { ServerToClientEvents } from "@/lib/ws/types";
// type EventPayload<T extends keyof ServerToClientEvents> =
//   ServerToClientEvents[T] extends (payload: infer P) => unknown ? P : never;
// type StartVoiceResponsePayload = EventPayload<"simulation_voice_start_response">;
import { toast } from "sonner";

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
  scenario: {
    copyPasteAllowed?: boolean;
    textEnabled?: boolean;
    audioEnabled?: boolean;
  } | null;
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
  
  // AudioWorklet refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const userMediaStreamRef = useRef<MediaStream | null>(null);
  const audioPlaybackContextRef = useRef<AudioContext | null>(null);
  const audioPlaybackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferQueueRef = useRef<Float32Array[]>([]);
  const runIdRef = useRef<string | null>(null);

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

    // In voice mode: text input is disabled, but if somehow we get here, just send normally
    if (voiceModeEnabled) {
      // Voice mode - text input should be disabled, but handle gracefully
      console.warn("[Voice] Text message sent in voice mode - this should not happen");
    }

    // Normal text mode: go through your existing backend
    if (isSendingMessage) return;
    sendMessage(messageToSend);

    setNewMessage("");
  };
  const handleStopMessage = () => stopMessage();

  // Cleanup helper for AudioWorklet session
  const cleanupRealtime = useCallback(async () => {
    try {
      // Stop AudioWorklet capture
      if (audioWorkletNodeRef.current) {
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current = null;
      }

      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Stop user media stream
      if (userMediaStreamRef.current) {
        userMediaStreamRef.current.getTracks().forEach((track) => track.stop());
        userMediaStreamRef.current = null;
      }

      // Stop audio playback
      if (audioPlaybackSourceRef.current) {
        audioPlaybackSourceRef.current.stop();
        audioPlaybackSourceRef.current = null;
      }

      if (audioPlaybackContextRef.current) {
        await audioPlaybackContextRef.current.close();
        audioPlaybackContextRef.current = null;
      }

      audioBufferQueueRef.current = [];
      runIdRef.current = null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[Voice] Error cleaning up audio:", err);
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
          reject(
            new Error("Timeout waiting for simulation_voice_stop response")
          );
        }, 5000);

        socket.once("simulations_voice_stop_response", (data) => {
          clearTimeout(timeout);
          // eslint-disable-next-line no-console
          console.log(
            "[Voice] Received simulations_voice_stop_response:",
            data
          );
          resolve(data);
        });

        socket.once("simulations_voice_stop_error", (data) => {
          clearTimeout(timeout);
          // eslint-disable-next-line no-console
          console.error("[Voice] Received simulations_voice_stop_error:", data);
          reject(new Error(data.message || "Failed to stop voice session"));
        });

        socket.emit("simulation_voice_stop", { chat_id: currentChat.id });
        // eslint-disable-next-line no-console
        console.log("[Voice] Emitted simulation_voice_stop event");
      });

      if (!stopResponse.success) {
        throw new Error(stopResponse.message || "Failed to stop voice session");
      }

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
      // Emit simulation_voice_start event
      socket.emit("simulation_voice_start", { chat_id: currentChat.id });

      // Wait for server response
      type StartVoiceResponsePayload = {
        success: boolean;
        message: string;
        model?: string;
      };
      const responseData = await new Promise<StartVoiceResponsePayload>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for voice session start"));
          }, 10000);

          socket.once("simulation_voice_start_response", (data) => {
            clearTimeout(timeout);
            if (data.success) {
              resolve(data);
            } else {
              reject(new Error(data.message || "Failed to start voice session"));
            }
          });

          socket.once("simulations_voice_start_error", (data) => {
            clearTimeout(timeout);
            reject(new Error(data.message || "Failed to start voice session"));
          });
        }
      );

      // Get microphone access
      const userMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      userMediaStreamRef.current = userMediaStream;

      // Create AudioContext for capture (24kHz mono)
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      // Create AudioWorklet processor for PCM16 capture
      const processorCode = `
        class PCM16Processor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (input.length > 0) {
              const inputChannel = input[0];
              // Convert Float32Array to Int16Array (PCM16)
              const pcm16 = new Int16Array(inputChannel.length);
              for (let i = 0; i < inputChannel.length; i++) {
                const s = Math.max(-1, Math.min(1, inputChannel[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              // Send PCM16 data to main thread
              this.port.postMessage({ pcm16: pcm16.buffer }, [pcm16.buffer]);
            }
            return true;
          }
        }
        registerProcessor('pcm16-processor', PCM16Processor);
      `;

      // Create blob URL for processor code
      const processorBlob = new Blob([processorCode], {
        type: "application/javascript",
      });
      const processorUrl = URL.createObjectURL(processorBlob);

      // Load AudioWorklet processor
      await audioContext.audioWorklet.addModule(processorUrl);
      URL.revokeObjectURL(processorUrl);

      // Create AudioWorkletNode
      const workletNode = new AudioWorkletNode(audioContext, "pcm16-processor");
      audioWorkletNodeRef.current = workletNode;

      // Connect microphone to worklet
      const source = audioContext.createMediaStreamSource(userMediaStream);
      source.connect(workletNode);

      // Handle PCM16 data from worklet
      workletNode.port.onmessage = (event) => {
        if (!isMicMuted && socket && runIdRef.current) {
          const pcm16Buffer = event.data.pcm16;
          // Send binary frame to server
          socket.emit("audio_frame_send", {
            audio: pcm16Buffer,
            run_id: runIdRef.current,
          });
        }
      };

      // Create AudioContext for playback (24kHz mono)
      const playbackContext = new AudioContext({ sampleRate: 24000 });
      audioPlaybackContextRef.current = playbackContext;

      setVoiceModeEnabled(true);
      setIsMicMuted(false);
      setIsStartingVoice(false);

      console.log("[Voice] Voice mode enabled successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start voice mode";
      console.error("[Voice] Error starting voice mode:", errorMessage);
      toast.error(errorMessage);
      await cleanupRealtime();
    } finally {
      setIsStartingVoice(false);
    }
  }, [cleanupRealtime, currentChat?.id, isConnected, socket, isMicMuted]);

  // Cleanup event listeners when voice mode is disabled
  useEffect(() => {
    if (!voiceModeEnabled || !socket) return;

    const handleAssistantAudioDelta = (data: {
      chat_id: string;
      audio: ArrayBuffer | string;
    }) => {
      if (data.chat_id !== currentChat?.id) return;

      try {
        // Decode audio data (can be binary ArrayBuffer or base64 string)
        let audioBuffer: ArrayBuffer;
        if (typeof data.audio === "string") {
          // Base64 string - decode to binary
          const binaryString = atob(data.audio);
          audioBuffer = new ArrayBuffer(binaryString.length);
          const view = new Uint8Array(audioBuffer);
          for (let i = 0; i < binaryString.length; i++) {
            view[i] = binaryString.charCodeAt(i);
          }
        } else {
          audioBuffer = data.audio;
        }

        // Convert PCM16 Int16Array to Float32Array for Web Audio API
        const pcm16 = new Int16Array(audioBuffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
          float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
        }

        // Queue audio buffer for playback
        audioBufferQueueRef.current.push(float32);

        // Play queued audio buffers
        if (!audioPlaybackSourceRef.current) {
          playQueuedAudio();
        }
      } catch (err) {
        console.error("[Voice] Error handling audio delta:", err);
      }
    };

    const playQueuedAudio = async () => {
      if (audioBufferQueueRef.current.length === 0) {
        audioPlaybackSourceRef.current = null;
        return;
      }

      const float32 = audioBufferQueueRef.current.shift();
      if (!float32 || !audioPlaybackContextRef.current) return;

      try {
        const audioBuffer = audioPlaybackContextRef.current.createBuffer(
          1, // mono
          float32.length,
          24000 // 24kHz
        );
        audioBuffer.copyToChannel(float32, 0);

        const source = audioPlaybackContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioPlaybackContextRef.current.destination);
        audioPlaybackSourceRef.current = source;

        source.onended = () => {
          audioPlaybackSourceRef.current = null;
          playQueuedAudio();
        };

        source.start(0);
      } catch (err) {
        console.error("[Voice] Error playing audio:", err);
        audioPlaybackSourceRef.current = null;
        playQueuedAudio();
      }
    };

    const handleGenerateProgress = (data: {
      run_id?: string;
      chat_id?: string;
      type?: string;
    }) => {
      if (data.run_id && data.chat_id === currentChat?.id) {
        runIdRef.current = data.run_id;
      }
    };

    socket.on("simulation_voice_assistant_delta", handleAssistantAudioDelta);
    socket.on("simulation_voice_assistant_start", handleGenerateProgress);
    socket.on("simulation_voice_user_start", handleGenerateProgress);

    return () => {
      socket.off("simulation_voice_assistant_delta", handleAssistantAudioDelta);
      socket.off("simulation_voice_assistant_start", handleGenerateProgress);
      socket.off("simulation_voice_user_start", handleGenerateProgress);
    };
  }, [voiceModeEnabled, socket, currentChat?.id]);

  // Voice mode handlers
  const handleVoiceToggle = useCallback(async () => {
    // If voice mode is not enabled, this button starts it
    if (!voiceModeEnabled) {
      await startVoiceMode();
      return;
    }

    // Voice mode is enabled → toggle mute
    if (!socket || !runIdRef.current) {
      console.warn("[Voice] No socket or run_id present while toggling mute");
      return;
    }

    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);

    // Send mute control message to server
    socket.emit("mic.set_muted", {
      muted: nextMuted,
      run_id: runIdRef.current,
    });

    console.log("[Voice] Toggled mute:", { nextMuted });
  }, [startVoiceMode, voiceModeEnabled, isMicMuted, socket]);

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

  // Get settings from scenario (defaults to true/false if not provided)
  const textEnabled = scenario?.textEnabled !== false; // Default true
  const audioEnabled = scenario?.audioEnabled === true; // Default false

  // Hide input entirely if both text and audio are disabled
  if (!textEnabled && !audioEnabled) return null;

  // When text is disabled but audio is enabled, show disabled textarea with voice mode prompt
  const showDisabledTextForVoice = !textEnabled && audioEnabled;

  return (
    <TooltipProvider>
      <CardFooter
        ref={inputPanelRef}
        className="h-full px-2 pb-1.5 pt-0 border-t flex flex-col justify-end min-h-0"
      >
        {/* --- Dynamic Input Area --- */}
        <div className="w-full flex items-end gap-2 shrink-0">
          {/* Voice toggle button - show when voice mode is disabled and audio is enabled */}
          {!voiceModeEnabled && audioEnabled && (
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
            {(() => {
              // If voice mode is enabled and not muted, show waveform
              if (voiceModeEnabled && !isMicMuted) {
                return (
                  <div className="w-full h-[40px] rounded-md border border-input bg-background px-3 py-2 flex items-center justify-center ring-offset-background overflow-hidden">
                    <VoiceWaveform
                      mediaStream={userMediaStreamRef.current}
                      className="w-full h-full"
                    />
                  </div>
                );
              }
              // Otherwise show textarea (when voice mode is disabled OR when muted)
              return (
                <Textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) =>
                    pastePrevention.handleChange(e, (value) =>
                      setNewMessage(sanitizeInputLength(value))
                    )
                  }
                  placeholder={
                    showDisabledTextForVoice
                      ? voiceModeEnabled && isMicMuted
                        ? "Unmute to start talking"
                        : "Turn on voice mode to start talking"
                      : voiceModeEnabled
                        ? "Voice mode active – mute to type and send"
                        : "Type your message (LaTeX supported)"
                  }
                  disabled={readOnly || showDisabledTextForVoice}
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
              );
            })()}
          </div>

          <div className="flex gap-2">
            {/* Show stop button when sending message (but not in voice mode) */}
            {isSendingMessage && !voiceModeEnabled ? (
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
            ) : voiceModeEnabled && !hasTextMessage && textEnabled ? (
              /* Show mute/unmute button in send position when voice mode enabled, no text, and text is enabled */
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
            ) : textEnabled && !showDisabledTextForVoice ? (
              /* Show send button when text is enabled and not in disabled-for-voice mode */
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
            ) : null}
          </div>
        </div>

        {/* Removed "Time's up!" message - allow users to continue with negative timer */}
      </CardFooter>
    </TooltipProvider>
  );
}
