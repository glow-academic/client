/**
 * TextInput.tsx
 * Text entry component with paste prevention
 * Explicit, self-contained types (like resource components)
 */
"use client";

import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNoPasteTextarea } from "@/hooks/use-no-paste-textarea";
import { useAttemptTranscribe } from "@/hooks/use-attempt-transcribe";
import { motion } from "framer-motion";
import { Loader2, Mic, Send, Square } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Explicit, self-contained prop interface (like resource components)
export interface TextInputProps {
  enabled: boolean;
  copy_paste_allowed: boolean;
  /** Send a message; ``audios_id`` rides along when the message body
   *  matches an unedited STT transcription, so the user-message row
   *  persists the audio attachment for chat-bubble playback. */
  on_send_message: (message: string, audios_id?: string) => void;
  on_stop_message: () => void;
  is_sending_message: boolean;
  is_stopping_message: boolean;
  is_connected: boolean;
  current_chat?: {
    id: string;
    completed?: boolean | null;
  } | null;
  disabled?: boolean;
  is_attempt_owner?: boolean;
  on_height_change?: (height: number) => void;
  /** Attempt id — forwarded to ``/attempt/generate`` on the
   *  transcribe step so the STT run is scoped to the right attempt
   *  group. Required for mic-input mode. */
  attempt_id?: string | null;
  /** Group id for SSE event scoping on the transcribe call.
   *  Optional — server resolves a time-windowed group when omitted. */
  group_id?: string | null;
}

const MAX_INPUT_CHARS = 5000;

export function TextInput({
  enabled,
  copy_paste_allowed,
  on_send_message,
  on_stop_message,
  is_sending_message,
  is_stopping_message,
  is_connected,
  current_chat,
  disabled = false,
  is_attempt_owner = true,
  on_height_change,
  attempt_id = null,
  group_id = null,
}: TextInputProps) {
  const [newMessage, setNewMessage] = useState("");
  const inputPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // -- Mic / STT state machine ------------------------------------------------
  // ``idle`` ⇄ ``recording`` ⇄ ``transcribing`` ⇄ ``idle`` (with text +
  // optional ``audioBackingId``). ``audioBackingId`` is dropped the
  // moment the user diverges from the transcribed text — strict
  // equality check, simplest reliable signal.
  type MicState = "idle" | "recording" | "transcribing";
  const [micState, setMicState] = useState<MicState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [audioBackingId, setAudioBackingId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  const { transcribe } = useAttemptTranscribe({
    chatId: current_chat?.id ?? null,
    attemptId: attempt_id,
    groupId: group_id,
  });

  // Drop the audio backing the moment the user edits the transcribed
  // text. Keeps ``audioBackingId`` and ``newMessage`` in sync as a
  // single source of truth — if you typed it, no audio rides along.
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

  const cleanupMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) track.stop();
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
  }, []);

  // Stop the timer + release the mic on unmount so we don't leak.
  useEffect(() => {
    return () => {
      stopRecordingTimer();
      cleanupMediaStream();
    };
  }, [stopRecordingTimer, cleanupMediaStream]);

  const handleStartRecording = useCallback(async () => {
    if (!current_chat?.id) {
      toast.error("No active chat — cannot record");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
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
      cleanupMediaStream();
    }
  }, [current_chat?.id, cleanupMediaStream]);

  const handleStopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      setMicState("idle");
      stopRecordingTimer();
      cleanupMediaStream();
      return;
    }
    // Wait for the final ``dataavailable`` event before stitching the
    // blob — ``recorder.stop()`` flushes one last chunk asynchronously.
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
    cleanupMediaStream();

    if (!finalBlob || finalBlob.size === 0) {
      toast.error("Recording produced no audio");
      setMicState("idle");
      return;
    }

    // Keep the timer visible through the transcribe phase per design
    // ("left side stays timer during upload + transcribe"). Switch to
    // ``transcribing`` so the right side renders a spinner instead of
    // the stop icon.
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
      // Refocus the textarea so the user can edit immediately.
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transcription failed";
      toast.error(msg);
      setMicState("idle");
    }
  }, [transcribe, stopRecordingTimer, cleanupMediaStream]);

  const formatRecordingTime = (totalSeconds: number): string => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const sanitizeInputLength = (value: string) =>
    value.length > MAX_INPUT_CHARS ? value.slice(0, MAX_INPUT_CHARS) : value;

  // Initialize paste prevention hook
  const pastePrevention = useNoPasteTextarea(textareaRef, {
    enabled: !copy_paste_allowed,
    onPasteAttempt: () => {},
    enableBurstDetection: true,
    maxBurstSize: 1,
  });

  // Connection state for send button
  const hasTextMessage = newMessage.trim().length > 0;

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

  const handleSendMessage = async (
    e:
      | React.FormEvent<HTMLFormElement>
      | React.KeyboardEvent<HTMLTextAreaElement>
      | React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    const messageToSend = newMessage.trim();

    if (!messageToSend || !current_chat || !is_connected) return;
    if (is_sending_message) return;

    // Ride-along audios_id when the message body matches the
    // transcribed text verbatim — ``audioBackingId`` was already
    // cleared in the dirty-tracking effect if the user edited.
    const rideAlongAudioId =
      audioBackingId && transcribedText === newMessage
        ? audioBackingId
        : undefined;
    on_send_message(messageToSend, rideAlongAudioId);
    setNewMessage("");
    setTranscribedText(null);
    setAudioBackingId(null);
  };

  const handleStopMessage = () => {
    on_stop_message();
  };

  // Auto-resize the textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;

      // Notify parent of height change
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !current_chat?.completed &&
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
  }, [current_chat?.completed]);

  // Hide input if not enabled or not the attempt owner or if read-only/completed
  if (!enabled || disabled || current_chat?.completed || !is_attempt_owner)
    return null;

  return (
    <TooltipProvider>
      <CardFooter
        ref={inputPanelRef}
        className="h-full px-2 pb-1.5 pt-0 border-t flex flex-col justify-end min-h-0"
      >
        <div className="w-full flex items-end gap-2 shrink-0">
          {/* Left-side recording timer. Visible during ``recording``
              AND ``transcribing`` per the design ("left side stays
              timer during upload + transcribe"). The timer freezes at
              the recording duration when we move into ``transcribing``
              — it's a marker that the input now carries audio, not a
              live clock. */}
          {(micState === "recording" || micState === "transcribing") && (
            <motion.div
              layout
              key="rec-timer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="min-h-[40px] h-[40px] px-3 rounded-md border border-destructive/40 bg-destructive/10 text-destructive flex items-center font-mono text-sm tabular-nums"
              data-testid="attempt-record-timer"
            >
              {formatRecordingTime(recordingSeconds)}
            </motion.div>
          )}
          <div className="flex-1 relative min-h-[40px] max-h-32 flex items-center">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) =>
                pastePrevention.handleChange(e, (value) =>
                  setNewMessage(sanitizeInputLength(value))
                )
              }
              placeholder={
                micState === "recording"
                  ? "Recording…"
                  : micState === "transcribing"
                    ? "Transcribing…"
                    : "Type your message (LaTeX supported)"
              }
              disabled={
                disabled || micState === "recording" || micState === "transcribing"
              }
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
          </div>

          <div className="flex gap-2">
            {/* Right-side button cycles through five states:
                  • send-in-flight  → red stop (cancel send)
                  • recording       → red stop (end recording)
                  • transcribing    → spinner (disabled)
                  • idle, empty     → mic (start recording)
                  • idle, has text  → send
                The first three are short-circuited above the send/mic
                branch so the user can't trigger conflicting actions. */}
            {is_sending_message ? (
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
            ) : micState === "recording" ? (
              <motion.div
                layout
                key="rec-stop-btn"
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
                      data-testid="attempt-record-stop"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stop recording</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            ) : micState === "transcribing" ? (
              <motion.div
                layout
                key="transcribe-spinner"
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
                      data-testid="attempt-transcribing"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Transcribing…</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            ) : !hasTextMessage ? (
              <motion.div
                layout
                key="mic-btn"
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
                      data-testid="attempt-mic-button"
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
            ) : (
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
            )}
          </div>
        </div>
      </CardFooter>
    </TooltipProvider>
  );
}
