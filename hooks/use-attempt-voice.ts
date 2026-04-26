import { useCallback, useEffect, useRef } from "react";
import type { Transport } from "@/lib/transport/types";

// Event payload types — loosely typed to match Transport's Record<string, unknown>
export type AttemptUserStartEvent = Record<string, unknown>;
export type AttemptUserAudioEvent = Record<string, unknown>;
export type AttemptAssistantAudioEvent = Record<string, unknown>;
export type AttemptAssistantAudioCompleteEvent = Record<string, unknown>;
export type AttemptAudioReadyEvent = Record<string, unknown>;
export type AttemptAudioEndedEvent = Record<string, unknown>;

interface UseAttemptVoiceConfig {
  transport: Transport;
  chatIdRef: React.RefObject<string | null>;
  attemptIdRef?: React.RefObject<string | null>;
  /** User's persona entry id (attempt.user_persona_id). Sent on the
   *  post-STT /attempt/chat/message persistence so the server can
   *  satisfy the attempt_content_entry.persona_id FK. Without this the
   *  impl falls back to the zero UUID and the FK violates. Mirrors how
   *  text-mode useAttemptMessages already passes persona_id. */
  userPersonaIdRef?: React.RefObject<string | null>;
  onUserStart?: (data: AttemptUserStartEvent) => void;
  /** Per-frame assistant PCM16 — push to AudioContext for realtime playback. */
  onAudioChunk?: (data: AttemptAssistantAudioEvent) => void;
  /** Assistant turn finished — ``audios_id`` is the persisted full-clip handle. */
  onAssistantAudioComplete?: (data: {
    chat_id: string;
    group_id: string;
    audios_id: string;
    duration_ms: number;
  }) => void;
  /** Called once the user's transcript has been persisted as a chat message. */
  onUserMessagePersisted?: (data: {
    chat_id: string;
    audios_id: string;
    text: string;
  }) => void;
  /** Per-attempt hints capability — when false, `chat_hints` is not
   *  added to the voice generate op list. Undefined falls back to
   *  enabled to match ChatData's nullable contract. */
  hintsEnabled?: boolean | null;
}

interface UseAttemptVoiceReturn {
  waitForAudioReady: (chatId: string, timeout?: number) => Promise<void>;
  waitForAudioEnded: (chatId: string, timeout?: number) => Promise<void>;
  startAudio: (chatId: string, attemptId: string) => Promise<void>;
  stopAudio: (chatId: string) => Promise<void>;
  sendFrame: (audio: ArrayBuffer) => void;
  setMicMute: (muted: boolean) => void;
}

export function useAttemptVoice({
  transport,
  chatIdRef,
  attemptIdRef,
  userPersonaIdRef,
  onUserStart,
  onAudioChunk,
  onAssistantAudioComplete,
  onUserMessagePersisted,
  hintsEnabled,
}: UseAttemptVoiceConfig): UseAttemptVoiceReturn {
  // Store callbacks in refs to avoid re-registering listeners on every render
  const callbacksRef = useRef({
    onUserStart,
    onAudioChunk,
    onAssistantAudioComplete,
    onUserMessagePersisted,
  });

  callbacksRef.current = {
    onUserStart,
    onAudioChunk,
    onAssistantAudioComplete,
    onUserMessagePersisted,
  };

  // Persistent streaming event listeners
  useEffect(() => {
    const handleUserStart = (data: AttemptUserStartEvent) => {
      if (data.chat_id !== chatIdRef.current) return;
      callbacksRef.current.onUserStart?.(data);
    };

    const handleAudioChunk = (data: AttemptAssistantAudioEvent) => {
      if (data.chat_id !== chatIdRef.current) return;
      callbacksRef.current.onAudioChunk?.(data);
    };

    const handleAssistantAudioComplete = (
      data: AttemptAssistantAudioCompleteEvent,
    ) => {
      if (data.chat_id !== chatIdRef.current) return;
      const chatId = data.chat_id as string | undefined;
      const groupId = data.group_id as string | undefined;
      const audiosId = data.audios_id as string | undefined;
      const durationMs = (data.duration_ms as number | undefined) ?? 0;
      if (!chatId || !groupId || !audiosId) return;
      callbacksRef.current.onAssistantAudioComplete?.({
        chat_id: chatId,
        group_id: groupId,
        audios_id: audiosId,
        duration_ms: durationMs,
      });
    };

    // Server auto-creates the full audio chain on speech_stopped and
    // emits a resource-level audios_id. Client does three calls:
    //   (1) POST /attempt/generate {audios_id}  → STT transcript
    //   (2) POST /attempt/chat/message {text}   → persist message
    //   (3) POST /attempt/chat/audio {message_id, audios_id}
    //                                            → attach audio to message
    // Post-hoc attach mirrors how hints attach to messages.
    const handleUserAudio = async (data: AttemptUserAudioEvent) => {
      const chatId = data.chat_id as string | undefined;
      const audiosId = data.audios_id as string | undefined;
      const attemptId = attemptIdRef?.current ?? null;
      if (!chatId || !audiosId || chatId !== chatIdRef.current) return;

      const waitForTranscript = (groupId: string, timeoutMs = 15000) =>
        new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => {
            unsub();
            reject(new Error("STT timed out"));
          }, timeoutMs);
          const unsub = transport.on("attempt.generate.text.complete", (ev) => {
            if (ev.group_id !== groupId) return;
            clearTimeout(timer);
            unsub();
            resolve((ev.text as string) ?? "");
          });
        });

      try {
        // (1) Transcribe via the canonical STT dispatch.
        const generateResult = await transport.send("/attempt/generate", {
          modalities: ["text"],
          audios_id: audiosId,
          config: {
            params: {
              attempt_id: attemptId ?? undefined,
              chat_id: chatId,
            },
          },
        });
        const groupId = generateResult.group_id as string | undefined;
        if (!groupId) {
          throw new Error("STT generate did not return group_id");
        }
        const transcript = (await waitForTranscript(groupId)).trim();
        if (!transcript) return;

        // (2) Persist as a chat message (text only). Pass persona_id so
        // the impl can satisfy attempt_content_entry.persona_id FK —
        // mirrors how text-mode useAttemptMessages.sendMessage threads
        // persona_id through. Without this the server falls back to the
        // zero UUID and the FK violates.
        const userPersonaId = userPersonaIdRef?.current ?? null;
        const msgResult = await transport.send("/attempt/chat/message", {
          chat_id: chatId,
          text: transcript,
          ...(userPersonaId ? { persona_id: userPersonaId } : {}),
        });
        const messageId = msgResult.message_id as string | undefined;
        if (!messageId) {
          throw new Error("chat/message did not return message_id");
        }

        // (3) Attach the audio to the message.
        await transport.send("/attempt/chat/audio", {
          chat_id: chatId,
          message_id: messageId,
          audios_id: audiosId,
        });

        callbacksRef.current.onUserMessagePersisted?.({
          chat_id: chatId,
          audios_id: audiosId,
          text: transcript,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[Voice] Failed to persist + attach user speech:", err);
      }
    };

    const unsubs = [
      transport.on("attempt.chat.user_start", handleUserStart),
      transport.on("attempt.chat.user_audio", handleUserAudio),
      transport.on("attempt.chat.assistant_audio", handleAudioChunk),
      transport.on(
        "attempt.chat.assistant_audio.complete",
        handleAssistantAudioComplete,
      ),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [transport, chatIdRef, attemptIdRef]);

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
    async (chatId: string, attemptId: string): Promise<void> => {
      // Step 1: open the realtime conversation (no AI yet).
      const voiceResult = await transport.send("/attempt/chat/voice", {
        chat_id: chatId,
      });
      const conversationId = voiceResult.conversation_id as string | undefined;
      if (!conversationId) {
        throw new Error("Voice start did not return conversation_id");
      }

      // Arm the voice_ready listener BEFORE triggering generate — the server
      // can emit voice_ready synchronously as soon as the provider WS opens,
      // and we'd miss it if we only subscribed afterwards.
      const voiceReadyPromise = waitForAudioReady(chatId);

      // Step 2: canonical generate — modalities + conversation_id + operations.
      // `chat_hints` is added when hints are enabled for this chat.
      const operations = ["get", "chat_message"];
      if (hintsEnabled !== false) operations.push("chat_hints");
      await transport.send("/attempt/generate", {
        instructions: ["Start a realtime voice conversation in character."],
        modalities: ["audio", "call", "text"],
        conversation_id: conversationId,
        config: {
          operations,
          params: {
            attempt_id: attemptId,
            chat_id: chatId,
          },
        },
      });

      await voiceReadyPromise;
    },
    [transport, waitForAudioReady, hintsEnabled],
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
