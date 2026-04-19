import { useCallback, useEffect, useRef } from "react";
import type { Transport } from "@/lib/transport/types";

// Event payload types — loosely typed to match Transport's Record<string, unknown>
export type AttemptUserStartEvent = Record<string, unknown>;
export type AttemptUserDeltaEvent = Record<string, unknown>;
export type AttemptAssistantAudioEvent = Record<string, unknown>;
export type AttemptAudioReadyEvent = Record<string, unknown>;
export type AttemptAudioEndedEvent = Record<string, unknown>;

interface UseAttemptVoiceConfig {
  transport: Transport;
  chatIdRef: React.RefObject<string | null>;
  onUserStart?: (data: AttemptUserStartEvent) => void;
  onUserDelta?: (data: AttemptUserDeltaEvent) => void;
  onAudioChunk?: (data: AttemptAssistantAudioEvent) => void;
}

interface UseAttemptVoiceReturn {
  waitForAudioReady: (chatId: string, timeout?: number) => Promise<void>;
  waitForAudioEnded: (chatId: string, timeout?: number) => Promise<void>;
  startAudio: (chatId: string) => Promise<void>;
  stopAudio: (chatId: string) => Promise<void>;
  sendFrame: (audio: ArrayBuffer) => void;
  setMicMute: (muted: boolean) => void;
}

export function useAttemptVoice({
  transport,
  chatIdRef,
  onUserStart,
  onUserDelta,
  onAudioChunk,
}: UseAttemptVoiceConfig): UseAttemptVoiceReturn {
  // Store callbacks in refs to avoid re-registering listeners on every render
  const callbacksRef = useRef({
    onUserStart,
    onUserDelta,
    onAudioChunk,
  });

  callbacksRef.current = {
    onUserStart,
    onUserDelta,
    onAudioChunk,
  };

  // Persistent streaming event listeners
  useEffect(() => {
    const handleUserStart = (data: AttemptUserStartEvent) => {
      if (data.chat_id !== chatIdRef.current) return;
      callbacksRef.current.onUserStart?.(data);
    };

    const handleUserDelta = (data: AttemptUserDeltaEvent) => {
      if (data.chat_id !== chatIdRef.current) return;
      callbacksRef.current.onUserDelta?.(data);
    };

    const handleAudioChunk = (data: AttemptAssistantAudioEvent) => {
      if (data.chat_id !== chatIdRef.current) return;
      callbacksRef.current.onAudioChunk?.(data);
    };

    const unsubs = [
      transport.on("attempt.chat.user_start", handleUserStart),
      transport.on("attempt.chat.user_progress", handleUserDelta),
      transport.on("attempt.chat.assistant_audio", handleAudioChunk),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [transport, chatIdRef]);

  // One-shot promise-based listeners for audio session lifecycle
  const waitForAudioReady = useCallback(
    (chatId: string, timeout = 10000): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        let unsub: (() => void) | null = null;

        const cleanup = () => {
          unsub?.();
        };

        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout waiting for voice session start"));
        }, timeout);

        unsub = transport.on("attempt.chat.voice_ready", (data: AttemptAudioReadyEvent) => {
          if (data.chat_id !== chatId) return;
          clearTimeout(timer);
          cleanup();
          if (data.success) {
            resolve();
          } else {
            reject(new Error((data.message as string) || "Failed to start voice session"));
          }
        });
      });
    },
    [transport],
  );

  const waitForAudioEnded = useCallback(
    (chatId: string, timeout = 10000): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        let unsub: (() => void) | null = null;

        const cleanup = () => {
          unsub?.();
        };

        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout waiting for voice session stop"));
        }, timeout);

        unsub = transport.on("attempt.chat.voice_ended", (data: AttemptAudioEndedEvent) => {
          if (data.chat_id !== chatId) return;
          clearTimeout(timer);
          cleanup();
          if (data.success) {
            resolve();
          } else {
            reject(new Error((data.message as string) || "Failed to stop voice session"));
          }
        });
      });
    },
    [transport],
  );

  // Combined send + wait methods
  const startAudio = useCallback(
    async (chatId: string): Promise<void> => {
      transport.send("/attempt/chat/voice", { chat_id: chatId });
      await waitForAudioReady(chatId);
    },
    [transport, waitForAudioReady],
  );

  const stopAudio = useCallback(
    async (chatId: string): Promise<void> => {
      transport.send("/attempt/chat/silence", { chat_id: chatId });
      await waitForAudioEnded(chatId);
    },
    [transport, waitForAudioEnded],
  );

  const sendFrame = useCallback(
    (audio: ArrayBuffer) => {
      if (!chatIdRef.current) return;
      transport.send("/attempt/chat/speak", { chat_id: chatIdRef.current, audio });
    },
    [transport, chatIdRef],
  );

  const setMicMute = useCallback(
    (muted: boolean) => {
      if (!chatIdRef.current) return;
      transport.send("/attempt/chat/mute", {
        chat_id: chatIdRef.current,
        muted,
      });
    },
    [transport, chatIdRef],
  );

  return {
    waitForAudioReady,
    waitForAudioEnded,
    startAudio,
    stopAudio,
    sendFrame,
    setMicMute,
  };
}
