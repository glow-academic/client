import { useCallback, useEffect, useRef } from "react";
import type { AppSocket } from "@/contexts/socket-context";
import type { ServerToClientEvents } from "@/lib/ws/types";

// Re-export event types for consumer convenience
export type AttemptUserStartEvent =
  Parameters<ServerToClientEvents["attempt_user_start"]>[0];
export type AttemptUserDeltaEvent =
  Parameters<ServerToClientEvents["attempt_user_delta"]>[0];
export type AttemptAssistantAudioEvent =
  Parameters<ServerToClientEvents["attempt_assistant_audio"]>[0];
export type AttemptAudioReadyEvent =
  Parameters<ServerToClientEvents["attempt_audio_ready"]>[0];
export type AttemptAudioEndedEvent =
  Parameters<ServerToClientEvents["attempt_audio_ended"]>[0];

interface UseAttemptVoiceConfig {
  socket: AppSocket | null;
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
  socket,
  chatIdRef,
  onUserStart,
  onUserDelta,
  onAudioChunk,
}: UseAttemptVoiceConfig): UseAttemptVoiceReturn {
  // Store callbacks in refs to avoid re-registering socket listeners on every render
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
    if (!socket) return;

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

    socket.on("attempt_user_start", handleUserStart);
    socket.on("attempt_user_delta", handleUserDelta);
    socket.on("attempt_assistant_audio", handleAudioChunk);

    return () => {
      socket.off("attempt_user_start", handleUserStart);
      socket.off("attempt_user_delta", handleUserDelta);
      socket.off("attempt_assistant_audio", handleAudioChunk);
    };
  }, [socket, chatIdRef]);

  // One-shot promise-based listeners for audio session lifecycle
  const waitForAudioReady = useCallback(
    (chatId: string, timeout = 10000): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        if (!socket) {
          reject(new Error("Socket not available"));
          return;
        }

        const cleanup = () => {
          socket.off("attempt_audio_ready", handler);
        };

        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout waiting for voice session start"));
        }, timeout);

        const handler = (data: AttemptAudioReadyEvent) => {
          if (data.chat_id !== chatId) return;
          clearTimeout(timer);
          cleanup();
          if (data.success) {
            resolve();
          } else {
            reject(new Error(data.message || "Failed to start voice session"));
          }
        };

        socket.on("attempt_audio_ready", handler);
      });
    },
    [socket],
  );

  const waitForAudioEnded = useCallback(
    (chatId: string, timeout = 10000): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        if (!socket) {
          reject(new Error("Socket not available"));
          return;
        }

        const cleanup = () => {
          socket.off("attempt_audio_ended", handler);
        };

        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout waiting for voice session stop"));
        }, timeout);

        const handler = (data: AttemptAudioEndedEvent) => {
          if (data.chat_id !== chatId) return;
          clearTimeout(timer);
          cleanup();
          if (data.success) {
            resolve();
          } else {
            reject(new Error(data.message || "Failed to stop voice session"));
          }
        };

        socket.on("attempt_audio_ended", handler);
      });
    },
    [socket],
  );

  // Combined emit + wait methods
  const startAudio = useCallback(
    async (chatId: string): Promise<void> => {
      if (!socket) throw new Error("Socket not available");
      socket.emit("attempt_audio_start", { chat_id: chatId });
      await waitForAudioReady(chatId);
    },
    [socket, waitForAudioReady],
  );

  const stopAudio = useCallback(
    async (chatId: string): Promise<void> => {
      if (!socket) throw new Error("Socket not available");
      socket.emit("attempt_audio_stop", { chat_id: chatId });
      await waitForAudioEnded(chatId);
    },
    [socket, waitForAudioEnded],
  );

  const sendFrame = useCallback(
    (audio: ArrayBuffer) => {
      if (!socket || !chatIdRef.current) return;
      socket.emit("attempt_audio_frame", { chat_id: chatIdRef.current, audio });
    },
    [socket, chatIdRef],
  );

  const setMicMute = useCallback(
    (muted: boolean) => {
      if (!socket || !chatIdRef.current) return;
      socket.emit("attempt_audio_mute", {
        chat_id: chatIdRef.current,
        muted,
      });
    },
    [socket, chatIdRef],
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
