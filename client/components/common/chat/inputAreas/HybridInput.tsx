/**
 * HybridInput.tsx
 * Wrapper component that manages toggle between TextInput and VoiceInput.
 * Shows voice toggle button when audio_enabled, allowing seamless mode switching.
 */
"use client";

import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Mic, MicOff, Send, Square, Volume2, X } from "lucide-react";
import { motion } from "framer-motion";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { useNoPasteTextarea } from "@/hooks/use-no-paste-textarea";
import { VoiceWaveform } from "./VoiceWaveform";
import { useAudioWorklet } from "./hooks/useAudioWorklet";

const MAX_INPUT_CHARS = 5000;

export interface HybridInputProps {
  // Mode flags
  text_enabled: boolean;
  audio_enabled: boolean;

  // Common props
  enabled: boolean;
  is_connected: boolean;
  disabled?: boolean;
  is_attempt_owner?: boolean;
  current_chat?: {
    id: string;
    completed?: boolean | null;
  } | null;

  // Text input props
  copy_paste_allowed: boolean;
  on_send_message: (message: string) => void;
  on_stop_message: () => void;
  is_sending_message: boolean;
  is_stopping_message: boolean;
  on_height_change?: (height: number) => void;

  // Voice input props
  on_voice_start: () => Promise<void>;
  on_voice_stop: () => Promise<void>;
  on_mic_mute?: (muted: boolean) => void;
  on_pcm16_data?: (data: ArrayBuffer) => void;
  audio_worklet_config?: {
    sample_rate: number;
    channel_count: number;
  };
}

export interface HybridInputHandle {
  enqueue_audio_delta: (audio: ArrayBuffer | string) => void;
}

export const HybridInput = forwardRef<HybridInputHandle, HybridInputProps>(
  function HybridInput(
    {
      text_enabled,
      audio_enabled,
      enabled,
      is_connected,
      disabled = false,
      is_attempt_owner = true,
      current_chat,
      copy_paste_allowed,
      on_send_message,
      on_stop_message,
      is_sending_message,
      is_stopping_message,
      on_height_change,
      on_voice_start,
      on_voice_stop,
      on_mic_mute,
      on_pcm16_data,
      audio_worklet_config = {
        sample_rate: 24000,
        channel_count: 1,
      },
    },
    ref
  ) {
    // Text input state
    const [newMessage, setNewMessage] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inputPanelRef = useRef<HTMLDivElement>(null);

    // Voice mode state
    const [isStartingVoice, setIsStartingVoice] = useState(false);
    const [isStoppingVoice, setIsStoppingVoice] = useState(false);
    const [isMicMuted, setIsMicMuted] = useState(false);

    // AudioWorklet hook
    const {
      user_media_stream,
      is_voice_mode_enabled,
      is_mic_muted,
      start_voice_mode,
      stop_voice_mode,
      set_mic_muted,
      enqueue_audio_delta,
      cleanup,
    } = useAudioWorklet(audio_worklet_config, on_pcm16_data);

    // Expose audio methods via ref
    useImperativeHandle(
      ref,
      () => ({
        enqueue_audio_delta,
      }),
      [enqueue_audio_delta]
    );

    // Paste prevention for text input
    const pastePrevention = useNoPasteTextarea(textareaRef, {
      enabled: !copy_paste_allowed,
      onPasteAttempt: () => {},
      enableBurstDetection: true,
      maxBurstSize: 1,
    });

    const sanitizeInputLength = (value: string) =>
      value.length > MAX_INPUT_CHARS ? value.slice(0, MAX_INPUT_CHARS) : value;

    const hasTextMessage = newMessage.trim().length > 0;

    // --- Voice handlers ---
    const handleVoiceStart = useCallback(async () => {
      if (!current_chat?.id || !is_connected) {
        toast.error("Cannot enable voice mode: chat or connection not available");
        return;
      }

      setIsStartingVoice(true);
      try {
        await on_voice_start();
        await start_voice_mode();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to start voice mode";
        console.error("[Voice] Error starting voice mode:", errorMessage);
        toast.error(errorMessage);
        await cleanup();
      } finally {
        setIsStartingVoice(false);
      }
    }, [current_chat?.id, is_connected, on_voice_start, start_voice_mode, cleanup]);

    const handleVoiceStop = useCallback(async () => {
      if (!current_chat?.id || !is_connected) return;

      setIsStoppingVoice(true);
      try {
        await on_voice_stop();
        await stop_voice_mode();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to stop voice mode";
        console.error("[Voice] Error stopping voice mode:", errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsStoppingVoice(false);
      }
    }, [current_chat?.id, is_connected, on_voice_stop, stop_voice_mode]);

    const handleMicToggle = useCallback(() => {
      const nextMuted = !isMicMuted;
      setIsMicMuted(nextMuted);
      set_mic_muted(nextMuted);
      on_mic_mute?.(nextMuted);
    }, [isMicMuted, set_mic_muted, on_mic_mute]);

    // --- Text handlers ---
    const handleSendMessage = useCallback(
      async (
        e:
          | React.FormEvent<HTMLFormElement>
          | React.KeyboardEvent<HTMLTextAreaElement>
          | React.MouseEvent<HTMLButtonElement>
      ) => {
        e.preventDefault();
        const messageToSend = newMessage.trim();

        if (!messageToSend || !current_chat || !is_connected) return;
        if (is_sending_message) return;

        on_send_message(messageToSend);
        setNewMessage("");
      },
      [newMessage, current_chat, is_connected, is_sending_message, on_send_message]
    );

    const handleStopMessage = useCallback(() => {
      on_stop_message();
    }, [on_stop_message]);

    // --- Effects ---

    // Cleanup voice on unmount or chat change
    useEffect(() => {
      return () => {
        cleanup();
      };
    }, [current_chat?.id, cleanup]);

    // Reset message on chat change
    useEffect(() => {
      setNewMessage("");
    }, [current_chat?.id]);

    // Auto-resize textarea
    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;

        if (on_height_change) {
          const maxTextareaHeight = 128;
          const actualTextareaHeight = Math.min(
            textarea.scrollHeight,
            maxTextareaHeight
          );
          const totalHeight = actualTextareaHeight + 24;
          const clampedHeight = Math.min(Math.max(totalHeight, 60), 160);
          on_height_change(clampedHeight);
        }
      }
    }, [newMessage, on_height_change]);

    // Initialize paste prevention previous value
    useEffect(() => {
      pastePrevention.updatePrevValue(newMessage);
    }, [newMessage, pastePrevention]);

    // Auto-focus textarea on keypress
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          !current_chat?.completed &&
          !is_voice_mode_enabled &&
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
    }, [current_chat?.completed, is_voice_mode_enabled]);

    // --- Render conditions ---

    // Hide input if not enabled or not the attempt owner or completed
    if (!enabled || disabled || current_chat?.completed || !is_attempt_owner)
      return null;

    // Hide if both text and audio are disabled
    if (!text_enabled && !audio_enabled) return null;

    // Show disabled text area prompting voice when only audio is enabled
    const showDisabledTextForVoice = !text_enabled && audio_enabled;

    const getPlaceholder = () => {
      if (showDisabledTextForVoice) {
        return is_voice_mode_enabled && is_mic_muted
          ? "Unmute to start talking"
          : "Turn on voice mode to start talking";
      }
      if (is_voice_mode_enabled) {
        return "Voice mode active – mute to type and send";
      }
      return "Type your message (LaTeX supported)";
    };

    const getConnectionTooltip = () => {
      if (!is_connected) {
        return "Initializing (0/1)";
      }
      if (is_sending_message) {
        return "Stop sending";
      }
      if (!hasTextMessage) {
        return "Enter a message";
      }
      return "Send message";
    };

    return (
      <TooltipProvider>
        <CardFooter
          ref={inputPanelRef}
          className="h-full px-2 pb-1.5 pt-0 border-t flex flex-col justify-end min-h-0"
        >
          <div className="w-full flex items-end gap-2 shrink-0">
            {/* Voice toggle button - LEFT side, show when audio enabled and voice mode OFF */}
            {audio_enabled && !is_voice_mode_enabled && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    className="min-h-[40px] h-[40px] w-[40px] shrink-0"
                    onClick={handleVoiceStart}
                    disabled={
                      disabled ||
                      !is_connected ||
                      !current_chat?.id ||
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

            {/* Voice exit button - LEFT side, show when voice mode ON */}
            {is_voice_mode_enabled && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="min-h-[40px] h-[40px] w-[40px] shrink-0"
                    onClick={handleVoiceStop}
                    disabled={
                      disabled ||
                      !is_connected ||
                      !current_chat?.id ||
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

            {/* CENTER - Waveform OR Textarea */}
            <div className="flex-1 relative min-h-[40px] max-h-32 flex items-center">
              {is_voice_mode_enabled && !is_mic_muted ? (
                // Voice mode active and not muted - show waveform
                <div className="w-full h-[40px] rounded-md border border-input bg-background px-3 py-2 flex items-center justify-center ring-offset-background overflow-hidden">
                  <VoiceWaveform
                    media_stream={user_media_stream}
                    className="w-full h-full"
                  />
                </div>
              ) : (
                // Text mode OR voice mode muted - show textarea
                <Textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) =>
                    pastePrevention.handleChange(e, (value) =>
                      setNewMessage(sanitizeInputLength(value))
                    )
                  }
                  placeholder={getPlaceholder()}
                  disabled={disabled || showDisabledTextForVoice}
                  className="w-full text-md resize-none overflow-y-auto text-base max-h-32 min-h-[40px]"
                  rows={1}
                  maxLength={MAX_INPUT_CHARS}
                  data-testid="attempt-chat-input"
                  onBeforeInput={pastePrevention.handleBeforeInput}
                  onPaste={pastePrevention.handlePaste}
                  onPasteCapture={pastePrevention.handlePasteCapture}
                  onDrop={pastePrevention.handleDrop}
                  onContextMenu={pastePrevention.handleContextMenu}
                  onMouseDown={pastePrevention.handleMouseDown}
                  onKeyDown={(e) =>
                    pastePrevention.handleKeyDown(e, handleSendMessage)
                  }
                  onCompositionStart={pastePrevention.handleCompositionStart}
                  onCompositionEnd={pastePrevention.handleCompositionEnd}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              )}
            </div>

            {/* RIGHT side buttons */}
            <div className="flex gap-2">
              {/* Stop button - when sending message (not in voice mode) */}
              {is_sending_message && !is_voice_mode_enabled ? (
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
                        disabled={disabled || is_stopping_message}
                        onClick={handleStopMessage}
                        data-testid="attempt-stop-button"
                      >
                        {is_stopping_message ? (
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
              ) : is_voice_mode_enabled && !hasTextMessage && text_enabled ? (
                /* Mute/unmute button in voice mode when no text typed */
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
                        variant={is_mic_muted ? "outline" : "default"}
                        disabled={
                          disabled ||
                          !is_connected ||
                          !current_chat?.id ||
                          isStartingVoice ||
                          isStoppingVoice
                        }
                        onClick={handleMicToggle}
                        data-testid="voice-mute-toggle-button"
                      >
                        {is_mic_muted ? (
                          <MicOff className="h-4 w-4" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {is_mic_muted ? "Unmute microphone" : "Mute microphone"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              ) : is_voice_mode_enabled && !text_enabled ? (
                /* Mute/unmute button in voice-only mode */
                <motion.div
                  layout
                  key="mute-btn-voice-only"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        className="min-h-[40px] h-[40px] px-3"
                        variant={is_mic_muted ? "outline" : "default"}
                        disabled={
                          disabled ||
                          !is_connected ||
                          !current_chat?.id ||
                          isStartingVoice ||
                          isStoppingVoice
                        }
                        onClick={handleMicToggle}
                        data-testid="voice-mute-toggle-button"
                      >
                        {is_mic_muted ? (
                          <MicOff className="h-4 w-4" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {is_mic_muted ? "Unmute microphone" : "Mute microphone"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              ) : text_enabled && !showDisabledTextForVoice ? (
                /* Send button when text is enabled */
                <motion.div
                  layout
                  key="send-btn"
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
                        disabled={disabled || !is_connected || !hasTextMessage}
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
        </CardFooter>
      </TooltipProvider>
    );
  }
);

HybridInput.displayName = "HybridInput";
