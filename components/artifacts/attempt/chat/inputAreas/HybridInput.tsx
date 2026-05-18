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
import { useAudioWorklet } from "@/hooks/use-audio-worklet";
import { useAttemptTranscribe } from "@/hooks/use-attempt-transcribe";

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
  /** Send a message; ``audios_id`` rides along when the body matches
   *  an unedited mic transcription so the user-message row persists
   *  the audio attachment for chat-bubble playback. */
  on_send_message: (message: string, audios_id?: string) => void;
  on_stop_message: () => void;
  is_sending_message: boolean;
  is_stopping_message: boolean;
  on_height_change?: (height: number) => void;

  // STT / mic-input props (one-shot transcribe path, distinct from the
  // realtime voice-mode path below). Optional — when omitted, the mic
  // button stays disabled.
  attempt_id?: string | null;
  group_id?: string | null;

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
      attempt_id = null,
      group_id = null,
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

    // -- Mic / STT state machine ----------------------------------------------
    // One-shot transcribe path that coexists with the realtime voice
    // mode above. ``idle`` ⇄ ``recording`` ⇄ ``transcribing`` ⇄ ``idle``
    // (with text + optional ``audioBackingId``). ``audioBackingId`` is
    // dropped the moment the user diverges from the transcribed text.
    type MicState = "idle" | "recording" | "transcribing";
    const [micState, setMicState] = useState<MicState>("idle");
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [transcribedText, setTranscribedText] = useState<string | null>(null);
    const [audioBackingId, setAudioBackingId] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    // Mirror the stream into state so the ``VoiceWaveform`` re-renders
    // when capture starts / stops. The ref is the authoritative handle
    // (cleanup, recorder access); the state is purely for the React
    // tree to react to changes.
    const [sttMediaStream, setSttMediaStream] = useState<MediaStream | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recordingStartedAtRef = useRef<number | null>(null);

    const { transcribe } = useAttemptTranscribe({
      chatId: current_chat?.id ?? null,
      attemptId: attempt_id,
      groupId: group_id,
    });

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
        // eslint-disable-next-line no-console
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
        // eslint-disable-next-line no-console
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

        // Ride-along audios_id when the body matches the transcribed
        // text verbatim — the dirty-tracking effect (below) clears
        // ``audioBackingId`` on any edit, so this is just the final
        // gate.
        const rideAlong =
          audioBackingId && transcribedText === newMessage
            ? audioBackingId
            : undefined;
        on_send_message(messageToSend, rideAlong);
        setNewMessage("");
        setTranscribedText(null);
        setAudioBackingId(null);
      },
      [newMessage, current_chat, is_connected, is_sending_message, on_send_message, audioBackingId, transcribedText]
    );

    const handleStopMessage = useCallback(() => {
      on_stop_message();
    }, [on_stop_message]);

    // --- STT (one-shot mic transcribe) handlers ----------------------------
    // Dirty-tracking: drop ``audioBackingId`` the moment the user
    // diverges from the transcribed text. Strict equality is the
    // simplest reliable signal — typed text = no audio rides along.
    useEffect(() => {
      if (audioBackingId === null) return;
      if (transcribedText !== null && newMessage !== transcribedText) {
        setAudioBackingId(null);
        setTranscribedText(null);
      }
    }, [newMessage, transcribedText, audioBackingId]);

    const stopRecordingTimer = useCallback(() => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }, []);

    const cleanupSttMediaStream = useCallback(() => {
      if (mediaStreamRef.current) {
        for (const track of mediaStreamRef.current.getTracks()) track.stop();
        mediaStreamRef.current = null;
      }
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
      setSttMediaStream(null);
    }, []);

    useEffect(() => {
      return () => {
        stopRecordingTimer();
        cleanupSttMediaStream();
      };
    }, [stopRecordingTimer, cleanupSttMediaStream]);

    const handleStartRecording = useCallback(async () => {
      if (!current_chat?.id) {
        toast.error("No active chat — cannot record");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        setSttMediaStream(stream);
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.start();
        recordingStartedAtRef.current = Date.now();
        setRecordingSeconds(0);
        recordingTimerRef.current = setInterval(() => {
          const startedAt = recordingStartedAtRef.current;
          if (startedAt === null) return;
          setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
        }, 250);
        setMicState("recording");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Microphone access denied";
        toast.error(msg);
        cleanupSttMediaStream();
      }
    }, [current_chat?.id, cleanupSttMediaStream]);

    const handleStopRecording = useCallback(async () => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        setMicState("idle");
        stopRecordingTimer();
        cleanupSttMediaStream();
        return;
      }
      const finalBlob = await new Promise<Blob | null>((resolve) => {
        recorder.onstop = () => {
          if (recordedChunksRef.current.length === 0) {
            resolve(null);
            return;
          }
          resolve(
            new Blob(recordedChunksRef.current, {
              type: recorder.mimeType || "audio/webm",
            }),
          );
        };
        try {
          recorder.stop();
        } catch {
          resolve(null);
        }
      });
      stopRecordingTimer();
      // NOTE: stream cleanup happens in the ``finally`` below — kept
      // alive across the transcribe phase so the live waveform
      // continues to render until we have a result. The recorder is
      // already stopped above, but the underlying ``MediaStream`` is
      // independent and will keep producing analyser frames.

      if (!finalBlob || finalBlob.size === 0) {
        toast.error("Recording produced no audio");
        cleanupSttMediaStream();
        setMicState("idle");
        return;
      }
      // Timer stays visible (frozen at recording duration) through the
      // transcribe phase — per design, "left side stays timer during
      // upload + transcribe". Right-side button switches to spinner.
      setMicState("transcribing");
      try {
        const { text, audios_id } = await transcribe(finalBlob);
        if (!text) {
          toast.error("Transcription returned no text");
          setMicState("idle");
          return;
        }
        setNewMessage(text);
        setTranscribedText(text);
        setAudioBackingId(audios_id);
        setMicState("idle");
        requestAnimationFrame(() => textareaRef.current?.focus());
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transcription failed";
        toast.error(msg);
        setMicState("idle");
      } finally {
        // Release the mic once we have (or have failed to get) the
        // transcript — keeps the waveform live the whole time without
        // leaking the device after we're done.
        cleanupSttMediaStream();
      }
    }, [transcribe, stopRecordingTimer, cleanupSttMediaStream]);

    const formatRecordingTime = (totalSeconds: number): string => {
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

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
          // Mobile: no h-full/justify-end/border-t — the wrapper above
          // provides border-t + pt-2 and lets the footer size to content.
          // Desktop keeps the original behavior so content sits at the
          // bottom of the fixed-height input panel.
          className="px-2 pb-1.5 pt-0 flex flex-col min-h-0 md:h-full md:border-t md:justify-end"
        >
          <div className="w-full flex items-end gap-2 shrink-0">
            {/* Voice toggle button - LEFT side. Hidden during STT
                recording / transcribing — the STT timer (below) takes
                its slot so the left edge stays one button wide. */}
            {audio_enabled &&
              !is_voice_mode_enabled &&
              micState === "idle" && (
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

            {/* LEFT-side STT recording timer. Occupies the same
                40×40 slot the voice-toggle would, so the layout never
                shifts when the user switches between idle and
                recording. Frozen at recording duration once we cross
                into ``transcribing`` — a marker that the input is
                carrying audio. Compact tabular-nums fit MM:SS in the
                square; for >99 minutes we'd grow, but recordings are
                short by design. */}
            {(micState === "recording" || micState === "transcribing") && (
              <motion.div
                layout
                key="stt-rec-timer"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="min-h-[40px] h-[40px] w-[40px] rounded-md border border-destructive/40 bg-destructive/10 text-destructive flex items-center justify-center font-mono text-[10px] leading-none tabular-nums shrink-0"
                data-testid="attempt-stt-timer"
              >
                {formatRecordingTime(recordingSeconds)}
              </motion.div>
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
              ) : micState === "recording" || micState === "transcribing" ? (
                // STT one-shot recording/transcribing — same waveform
                // component the realtime path uses.
                //
                // During ``recording`` we pass the live mic stream so
                // ``VoiceWaveform`` analyses real audio. During
                // ``transcribing`` we deliberately pass ``null`` —
                // the recorder is stopped, the user isn't speaking,
                // and the analyser-backed render would draw flat 2px
                // silence bars that look indistinguishable from "no
                // waveform." Passing ``null`` flips ``VoiceWaveform``
                // into its synthetic-pulse branch (a center-weighted
                // sine animation), which reads as "still processing"
                // rather than "frozen / dead."
                <div className="w-full h-[40px] rounded-md border border-input bg-background px-3 py-2 flex items-center justify-center ring-offset-background overflow-hidden">
                  <VoiceWaveform
                    media_stream={
                      micState === "recording" ? sttMediaStream : null
                    }
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
              ) : micState === "recording" && !is_voice_mode_enabled ? (
                /* STT recording — stop button ends the recording and
                   kicks off upload + transcribe. Coexists with voice
                   mode (which uses ``handleVoiceStop``); never both. */
                <motion.div
                  layout
                  key="stt-stop-btn"
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
                        onClick={handleStopRecording}
                        data-testid="attempt-stt-stop"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Stop recording</p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              ) : micState === "transcribing" && !is_voice_mode_enabled ? (
                <motion.div
                  layout
                  key="stt-transcribe-spinner"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        className="min-h-[40px] h-[40px] px-3"
                        variant="default"
                        disabled
                        data-testid="attempt-stt-transcribing"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Transcribing…</p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              ) : text_enabled &&
                !showDisabledTextForVoice &&
                !hasTextMessage &&
                !is_voice_mode_enabled ? (
                /* Empty text input + not in realtime voice mode →
                   STT mic button. Replaces the previously-disabled
                   send. Pressing kicks off MediaRecorder → upload →
                   transcribe via the canonical generate route. */
                <motion.div
                  layout
                  key="stt-mic-btn"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        className="min-h-[40px] h-[40px] px-3"
                        variant="default"
                        disabled={disabled || !is_connected || !current_chat?.id}
                        onClick={handleStartRecording}
                        data-testid="attempt-stt-mic-button"
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {!is_connected
                          ? "Initializing (0/1)"
                          : !current_chat?.id
                            ? "No active chat"
                            : "Record audio"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              ) : text_enabled && !showDisabledTextForVoice ? (
                // Send button when text is enabled. When the body is
                // still backed by an unedited mic transcription, a
                // small dot in the top-right indicates the audio will
                // ride along on send. Hovering reveals an X-overlay
                // that lets the user detach it (keeps the text,
                // drops ``audioBackingId``). Pattern mirrors the
                // "Suggested" dot in Departments.tsx but with a
                // removable affordance — same scale, subtle, but
                // clear it's interactive.
                <motion.div
                  layout
                  key="send-btn"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="relative group"
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
                  {audioBackingId && transcribedText === newMessage && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Detach audio attachment"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setAudioBackingId(null);
                            setTranscribedText(null);
                          }}
                          className="absolute -top-1 -right-1 z-10 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background flex items-center justify-center transition-all hover:h-4 hover:w-4 hover:bg-destructive cursor-pointer group/audio-dot"
                          data-testid="attempt-audio-attached-dot"
                        >
                          <X className="h-2 w-2 text-background opacity-0 group-hover/audio-dot:opacity-100 transition-opacity" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Audio attached — click to detach</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
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
