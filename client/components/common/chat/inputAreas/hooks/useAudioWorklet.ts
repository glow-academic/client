/**
 * useAudioWorklet.ts
 * AudioWorklet hook for voice input
 * Isolated audio processing logic
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioWorkletConfig {
  sample_rate: number;
  channel_count: number;
}

export interface UseAudioWorkletReturn {
  audio_context: AudioContext | null;
  audio_worklet_node: AudioWorkletNode | null;
  user_media_stream: MediaStream | null;
  audio_playback_context: AudioContext | null;
  is_voice_mode_enabled: boolean;
  is_mic_muted: boolean;
  start_voice_mode: () => Promise<void>;
  stop_voice_mode: () => Promise<void>;
  set_mic_muted: (muted: boolean) => void;
  cleanup: () => Promise<void>;
}

export function useAudioWorklet(
  config: AudioWorkletConfig,
  on_pcm16_data?: (data: ArrayBuffer) => void,
  on_audio_delta?: (audio: ArrayBuffer | string) => void
): UseAudioWorkletReturn {
  const [isVoiceModeEnabled, setIsVoiceModeEnabled] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const userMediaStreamRef = useRef<MediaStream | null>(null);
  const audioPlaybackContextRef = useRef<AudioContext | null>(null);
  const audioPlaybackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferQueueRef = useRef<Float32Array[]>([]);
  const runIdRef = useRef<string | null>(null);

  const cleanup = useCallback(async () => {
    try {
      if (audioWorkletNodeRef.current) {
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current = null;
      }

      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (userMediaStreamRef.current) {
        userMediaStreamRef.current.getTracks().forEach((track) => track.stop());
        userMediaStreamRef.current = null;
      }

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
      console.warn("[Voice] Error cleaning up audio:", err);
    }

    setIsVoiceModeEnabled(false);
    setIsMicMuted(false);
  }, []);

  const startVoiceMode = useCallback(async () => {
    try {
      // Get microphone access
      const userMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: config.sample_rate,
          channelCount: config.channel_count,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      userMediaStreamRef.current = userMediaStream;

      // Create AudioContext for capture
      const audioContext = new AudioContext({ sampleRate: config.sample_rate });
      audioContextRef.current = audioContext;

      // Create AudioWorklet processor for PCM16 capture
      const processorCode = `
        class PCM16Processor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (input.length > 0) {
              const inputChannel = input[0];
              const pcm16 = new Int16Array(inputChannel.length);
              for (let i = 0; i < inputChannel.length; i++) {
                const s = Math.max(-1, Math.min(1, inputChannel[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              this.port.postMessage({ pcm16: pcm16.buffer }, [pcm16.buffer]);
            }
            return true;
          }
        }
        registerProcessor('pcm16-processor', PCM16Processor);
      `;

      const processorBlob = new Blob([processorCode], {
        type: "application/javascript",
      });
      const processorUrl = URL.createObjectURL(processorBlob);

      await audioContext.audioWorklet.addModule(processorUrl);
      URL.revokeObjectURL(processorUrl);

      const workletNode = new AudioWorkletNode(audioContext, "pcm16-processor");
      audioWorkletNodeRef.current = workletNode;

      const source = audioContext.createMediaStreamSource(userMediaStream);
      source.connect(workletNode);

      // Handle PCM16 data from worklet
      workletNode.port.onmessage = (event) => {
        if (!isMicMuted && on_pcm16_data) {
          const pcm16Buffer = event.data.pcm16;
          on_pcm16_data(pcm16Buffer);
        }
      };

      // Create AudioContext for playback
      const playbackContext = new AudioContext({
        sampleRate: config.sample_rate,
      });
      audioPlaybackContextRef.current = playbackContext;

      setIsVoiceModeEnabled(true);
      setIsMicMuted(false);
    } catch (error) {
      console.error("[Voice] Error starting voice mode:", error);
      await cleanup();
      throw error;
    }
  }, [config, isMicMuted, on_pcm16_data, cleanup]);

  const stopVoiceMode = useCallback(async () => {
    await cleanup();
  }, [cleanup]);

  const setMicMuted = useCallback((muted: boolean) => {
    setIsMicMuted(muted);
  }, []);

  // Handle audio playback
  useEffect(() => {
    if (!on_audio_delta || !audioPlaybackContextRef.current) return;

    const playQueuedAudio = async () => {
      if (audioBufferQueueRef.current.length === 0) {
        audioPlaybackSourceRef.current = null;
        return;
      }

      const float32 = audioBufferQueueRef.current.shift();
      if (!float32 || !audioPlaybackContextRef.current) return;

      try {
        const audioBuffer = audioPlaybackContextRef.current.createBuffer(
          1,
          float32.length,
          config.sample_rate
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

    // This would be called when audio delta arrives
    // Implementation depends on how audio deltas are received
  }, [on_audio_delta, config.sample_rate]);

  return {
    audio_context: audioContextRef.current,
    audio_worklet_node: audioWorkletNodeRef.current,
    user_media_stream: userMediaStreamRef.current,
    audio_playback_context: audioPlaybackContextRef.current,
    is_voice_mode_enabled: isVoiceModeEnabled,
    is_mic_muted: isMicMuted,
    start_voice_mode: startVoiceMode,
    stop_voice_mode: stopVoiceMode,
    set_mic_muted: setMicMuted,
    cleanup,
  };
}
