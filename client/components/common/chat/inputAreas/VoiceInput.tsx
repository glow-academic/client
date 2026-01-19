/**
 * VoiceInput.tsx
 * Voice mode input component with AudioWorklet
 * Explicit, self-contained types (like resource components)
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
import { motion } from "framer-motion";
import { Loader2, Mic, MicOff, Volume2, X } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { toast } from "sonner";
import { VoiceWaveform } from "./VoiceWaveform";
import { useAudioWorklet } from "./hooks/useAudioWorklet";

// Explicit, self-contained prop interface (like resource components)
export interface VoiceInputProps {
  enabled: boolean;
  on_voice_start: () => Promise<void>;
  on_voice_stop: () => Promise<void>;
  current_chat?: {
    id: string;
  } | null;
  is_connected: boolean;
  disabled?: boolean;
  is_attempt_owner?: boolean;
  on_mic_mute?: (muted: boolean) => void;
  // AudioWorklet config passed via props
  audio_worklet_config?: {
    sample_rate: number;
    channel_count: number;
  };
  // Callbacks for audio data
  on_pcm16_data?: (data: ArrayBuffer) => void;
}

export interface VoiceInputHandle {
  enqueue_audio_delta: (audio: ArrayBuffer | string) => void;
}

export const VoiceInput = forwardRef<VoiceInputHandle, VoiceInputProps>(
  function VoiceInput(
    {
  enabled,
  on_voice_start,
  on_voice_stop,
  current_chat,
  is_connected,
  disabled = false,
  is_attempt_owner = true,
  on_mic_mute,
  audio_worklet_config = {
    sample_rate: 24000,
    channel_count: 1,
  },
  on_pcm16_data,
}: VoiceInputProps,
    ref
  ) {
  const [isStartingVoice, setIsStartingVoice] = useState(false);
  const [isStoppingVoice, setIsStoppingVoice] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

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

  useImperativeHandle(
    ref,
    () => ({
      enqueue_audio_delta,
    }),
    [enqueue_audio_delta]
  );

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
  }, [
    current_chat?.id,
    is_connected,
    on_voice_start,
    start_voice_mode,
    cleanup,
  ]);

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

  const handleVoiceToggle = useCallback(async () => {
    if (!is_voice_mode_enabled) {
      await handleVoiceStart();
      return;
    }

    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    set_mic_muted(nextMuted);
    on_mic_mute?.(nextMuted);
  }, [
    is_voice_mode_enabled,
    isMicMuted,
    handleVoiceStart,
    set_mic_muted,
    on_mic_mute,
  ]);

  // Cleanup on unmount or chat change
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [current_chat?.id, cleanup]);

  // Hide input if not enabled or not the attempt owner
  if (!enabled || disabled || !is_attempt_owner) return null;

  return (
    <TooltipProvider>
      <CardFooter className="h-full px-2 pb-1.5 pt-0 border-t flex flex-col justify-end min-h-0">
        <div className="w-full flex items-end gap-2 shrink-0">
          {/* Voice toggle button - show when voice mode is disabled */}
          {!is_voice_mode_enabled && (
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

          {/* Waveform or mute button */}
          <div className="flex-1 relative min-h-[40px] max-h-32 flex items-center">
            {is_voice_mode_enabled && !is_mic_muted ? (
              <div className="w-full h-[40px] rounded-md border border-input bg-background px-3 py-2 flex items-center justify-center ring-offset-background overflow-hidden">
                <VoiceWaveform
                  media_stream={user_media_stream}
                  className="w-full h-full"
                />
              </div>
            ) : (
              <div className="w-full h-[40px] rounded-md border border-input bg-background px-3 py-2 flex items-center justify-center">
                <span className="text-sm text-muted-foreground">
                  {is_voice_mode_enabled && is_mic_muted
                    ? "Unmute to start talking"
                    : "Turn on voice mode to start talking"}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {is_voice_mode_enabled && (
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
                      onClick={handleVoiceToggle}
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
            )}
          </div>
        </div>
      </CardFooter>
    </TooltipProvider>
  );
});

VoiceInput.displayName = "VoiceInput";
