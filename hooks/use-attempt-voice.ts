import { useCallback, useEffect, useRef, useState } from "react";
import type { Transport } from "@/lib/transport/types";

// Event payload types — loosely typed to match Transport's Record<string, unknown>
export type AttemptUserStartEvent = Record<string, unknown>;
export type AttemptUserAudioEvent = Record<string, unknown>;
export type AttemptAssistantAudioEvent = Record<string, unknown>;
export type AttemptAssistantAudioCompleteEvent = Record<string, unknown>;
export type AttemptAudioReadyEvent = Record<string, unknown>;
export type AttemptAudioEndedEvent = Record<string, unknown>;

function eventBody(data: Record<string, unknown>): Record<string, unknown> {
  const payload = data["payload"];
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : data;
}

interface UseAttemptVoiceConfig {
  transport: Transport;
  chatIdRef: React.RefObject<string | null>;
  groupId?: string | null;
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
    message_id: string;
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
  groupId,
  attemptIdRef,
  userPersonaIdRef,
  onUserStart,
  onAudioChunk,
  onAssistantAudioComplete,
  onUserMessagePersisted,
  hintsEnabled,
}: UseAttemptVoiceConfig): UseAttemptVoiceReturn {
  // Store callbacks in refs to avoid re-registering listeners on every render
  const conversationIdRef = useRef<string | null>(null);
  const activeGroupIdRef = useRef<string | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
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
    const scopedGroupId = activeGroupId ?? groupId ?? null;
    const eventScope = scopedGroupId ? { groupId: scopedGroupId } : undefined;

    const handleUserStart = (data: AttemptUserStartEvent) => {
      const body = eventBody(data);
      if (body["chat_id"] !== chatIdRef.current) return;
      callbacksRef.current.onUserStart?.(body);
    };

    const handleAudioChunk = (data: AttemptAssistantAudioEvent) => {
      const body = eventBody(data);
      if (body["chat_id"] !== chatIdRef.current) return;
      callbacksRef.current.onAudioChunk?.(body);
    };

    const handleAssistantAudioComplete = (
      data: AttemptAssistantAudioCompleteEvent,
    ) => {
      const body = eventBody(data);
      if (body["chat_id"] !== chatIdRef.current) return;
      const chatId = body["chat_id"] as string | undefined;
      const groupId = body["group_id"] as string | undefined;
      const audiosId = body["audios_id"] as string | undefined;
      const durationMs = (body["duration_ms"] as number | undefined) ?? 0;
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
      const body = eventBody(data);
      const chatId = body["chat_id"] as string | undefined;
      const audiosId = body["audios_id"] as string | undefined;
      const audioGroupId = body["group_id"] as string | undefined;
      const attemptId = attemptIdRef?.current ?? null;
      // eslint-disable-next-line no-console
      console.log("[VOICE_CLIENT_TRACE A] handleUserAudio fired", {
        evt_chat_id: chatId,
        ref_chat_id: chatIdRef.current,
        group_id: audioGroupId,
        audios_id: audiosId,
        attempt_id: attemptId,
        match: chatId === chatIdRef.current,
      });
      if (!chatId || !audiosId || chatId !== chatIdRef.current) {
        // eslint-disable-next-line no-console
        console.warn("[VOICE_CLIENT_TRACE A.bail] gating early-return", {
          missing_chat_id: !chatId,
          missing_audios_id: !audiosId,
          chat_mismatch: chatId !== chatIdRef.current,
        });
        return;
      }

      // Subscribe BEFORE dispatching /attempt/generate. The route blocks
      // until the STT executor has run and emitted ``text.complete``, so
      // by the time ``transport.send`` resolves the event has already
      // been broadcast — registering after would miss it. Filter on
      // ``run_id`` (not ``group_id``): the realtime adapter ALSO emits
      // ``attempt.generate.text.complete`` for the assistant's own
      // audio transcript on the same group, so group_id alone is
      // ambiguous. The STT run also echoes prepared prompt messages with
      // the same run_id, so we additionally require the canonical
      // text_complete payload with no role.
      const armTranscript = (
        timeoutMs = 15000,
      ): {
        promise: Promise<string>;
        setRunId: (rid: string) => void;
      } => {
        let runIdLocal: string | null = null;
        const buffer: Array<Record<string, unknown>> = [];
        let resolveFn!: (s: string) => void;
        let rejectFn!: (e: unknown) => void;
        const promise = new Promise<string>((resolve, reject) => {
          resolveFn = resolve;
          rejectFn = reject;
        });
        const timer = setTimeout(() => {
          unsub();
          rejectFn(new Error("STT timed out"));
        }, timeoutMs);
        const transcriptScope = audioGroupId
          ? { groupId: audioGroupId }
          : eventScope;
        const unsub = transport.on("attempt.generate.text.complete", (ev) => {
          const body = eventBody(ev);
          const rid = (body["run_id"] as string) ?? "";
          const text = (body["text"] as string) ?? "";
          const isSttOutput =
            body["event_type"] === "text_complete" &&
            !body["role"] &&
            Boolean(text.trim());
          // eslint-disable-next-line no-console
          console.log("[VOICE_CLIENT_TRACE C] text.complete received", {
            ev_run_id: rid,
            ev_group_id: body["group_id"],
            ev_role: body["role"],
            ev_event_type: body["event_type"],
            await_run_id: runIdLocal,
            text_preview: text.slice(0, 60),
            buffered: runIdLocal === null,
            stt_output_candidate: isSttOutput,
          });
          if (!isSttOutput) return;
          if (runIdLocal === null) {
            buffer.push(body);
            return;
          }
          if (rid !== runIdLocal) return;
          clearTimeout(timer);
          unsub();
          resolveFn(text);
        }, transcriptScope);
        return {
          promise,
          setRunId: (rid: string) => {
            runIdLocal = rid;
            const match = buffer.find((e) => e["run_id"] === rid);
            if (match) {
              clearTimeout(timer);
              unsub();
              resolveFn(((match["text"] as string) ?? "").trim());
            }
          },
        };
      };

      try {
        // Arm the transcript listener *before* dispatching, so we don't
        // miss the ``text.complete`` event that fires before transport
        // .send resolves.
        const { promise: transcriptPromise, setRunId } = armTranscript();

        // eslint-disable-next-line no-console
        console.log("[VOICE_CLIENT_TRACE B] sending /attempt/generate", {
          audios_id: audiosId,
          chat_id: chatId,
          attempt_id: attemptId,
        });
        // (1) Transcribe via the canonical STT dispatch.
        const generateResult = await transport.send("/attempt/generate", {
          modalities: ["text"],
          audios_id: audiosId,
          config: {
            group_id: audioGroupId ?? activeGroupIdRef.current ?? groupId ?? undefined,
            params: {
              attempt_id: attemptId ?? undefined,
              chat_id: chatId,
            },
          },
        });
        // eslint-disable-next-line no-console
        console.log(
          "[VOICE_CLIENT_TRACE B.resp] /attempt/generate response",
          generateResult,
        );
        const runId = generateResult["run_id"] as string | undefined;
        if (!runId) {
          throw new Error("STT generate did not return run_id");
        }
        setRunId(runId);
        const transcript = (await transcriptPromise).trim();
        // eslint-disable-next-line no-console
        console.log("[VOICE_CLIENT_TRACE D] transcript resolved", {
          run_id: runId,
          transcript_preview: transcript.slice(0, 80),
          empty: !transcript,
        });
        if (!transcript) return;

        // (2) Persist as a chat message (text only). Pass persona_id so
        // the impl can satisfy attempt_content_entry.persona_id FK —
        // mirrors how text-mode useAttemptMessages.sendMessage threads
        // persona_id through. Without this the server falls back to the
        // zero UUID and the FK violates.
        const userPersonaId = userPersonaIdRef?.current ?? null;
        // eslint-disable-next-line no-console
        console.log("[VOICE_CLIENT_TRACE E] sending /attempt/chat/message", {
          chat_id: chatId,
          text_preview: transcript.slice(0, 60),
          persona_id: userPersonaId,
        });
        const msgResult = await transport.send("/attempt/chat/message", {
          chat_id: chatId,
          text: transcript,
          ...(userPersonaId ? { persona_id: userPersonaId } : {}),
        });
        // eslint-disable-next-line no-console
        console.log(
          "[VOICE_CLIENT_TRACE E.resp] /attempt/chat/message response",
          msgResult,
        );
        const messageId = msgResult["message_id"] as string | undefined;
        if (!messageId) {
          throw new Error("chat/message did not return message_id");
        }

        // (3) Attach the audio to the message.
        const audioResult = await transport.send("/attempt/chat/audio", {
          chat_id: chatId,
          message_id: messageId,
          audios_id: audiosId,
        });
        const audioError = audioResult["error"] as string | undefined;
        if (audioError) {
          throw new Error(audioError);
        }

        callbacksRef.current.onUserMessagePersisted?.({
          chat_id: chatId,
          message_id: messageId,
          audios_id: audiosId,
          text: transcript,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[VOICE_CLIENT_TRACE X] persist chain threw", {
          name: (err as Error)?.name,
          message: (err as Error)?.message,
          stack: (err as Error)?.stack,
        });
      }
    };

    const unsubs = [
      transport.on("attempt.chat.user_start", handleUserStart, eventScope),
      transport.on("attempt.chat.user_audio", handleUserAudio, eventScope),
      transport.on("attempt.chat.assistant_audio", handleAudioChunk, eventScope),
      transport.on(
        "attempt.chat.assistant_audio.complete",
        handleAssistantAudioComplete,
        eventScope,
      ),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [transport, chatIdRef, attemptIdRef, groupId, activeGroupId]);

  // One-shot promise-based listeners for audio session lifecycle
  const waitForAudioReady = useCallback(
    (
      chatId: string,
      timeout = 10000,
      scopeGroupId = activeGroupIdRef.current ?? groupId ?? null,
    ): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        let unsub: (() => void) | null = null;

        const cleanup = () => {
          unsub?.();
        };

        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout waiting for voice session start"));
        }, timeout);

        const eventScope = scopeGroupId ? { groupId: scopeGroupId } : undefined;
        unsub = transport.on("attempt.chat.voice_ready", (data: AttemptAudioReadyEvent) => {
          const body = eventBody(data);
          if (body["chat_id"] !== chatId) return;
          clearTimeout(timer);
          cleanup();
          if (body["success"]) {
            resolve();
          } else {
            reject(new Error((body["message"] as string) || "Failed to start voice session"));
          }
        }, eventScope);
      });
    },
    [transport, groupId],
  );

  const waitForAudioEnded = useCallback(
    (
      chatId: string,
      timeout = 10000,
      scopeGroupId = activeGroupIdRef.current ?? groupId ?? null,
    ): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        let unsub: (() => void) | null = null;

        const cleanup = () => {
          unsub?.();
        };

        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout waiting for voice session stop"));
        }, timeout);

        const eventScope = scopeGroupId ? { groupId: scopeGroupId } : undefined;
        unsub = transport.on("attempt.chat.voice_ended", (data: AttemptAudioEndedEvent) => {
          const body = eventBody(data);
          if (body["chat_id"] !== chatId) return;
          clearTimeout(timer);
          cleanup();
          if (body["success"]) {
            resolve();
          } else {
            reject(new Error((body["message"] as string) || "Failed to stop voice session"));
          }
        }, eventScope);
      });
    },
    [transport, groupId],
  );

  // Combined send + wait methods
  const startAudio = useCallback(
    async (chatId: string, attemptId: string): Promise<void> => {
      if (conversationIdRef.current) return;
      if (startPromiseRef.current) {
        await startPromiseRef.current;
        return;
      }

      const startPromise = (async () => {
        try {
          // Step 1: open the realtime conversation (no AI yet).
          const voiceResult = await transport.send("/attempt/chat/voice", {
            chat_id: chatId,
          });
          const conversationId = voiceResult["conversation_id"] as
            | string
            | undefined;
          const voiceGroupId = voiceResult["group_id"] as string | undefined;
          if (!conversationId) {
            throw new Error("Voice start did not return conversation_id");
          }
          if (!voiceGroupId) {
            throw new Error("Voice start did not return group_id");
          }
          conversationIdRef.current = conversationId;
          activeGroupIdRef.current = voiceGroupId;
          setActiveGroupId(voiceGroupId);

          // Arm the voice_ready listener BEFORE triggering generate — the server
          // can emit voice_ready synchronously as soon as the provider WS opens,
          // and we'd miss it if we only subscribed afterwards.
          const voiceReadyPromise = waitForAudioReady(chatId, 10000, voiceGroupId);

          // Step 2: canonical generate — modalities + conversation_id + operations.
          // `chat_hints` is added when hints are enabled for this chat.
          const operations = ["get", "chat_message"];
          if (hintsEnabled !== false) operations.push("chat_hints");
          await transport.send("/attempt/generate", {
            instructions: ["Start a realtime voice conversation in character."],
            modalities: ["audio", "call", "text"],
            conversation_id: conversationId,
            config: {
              group_id: voiceGroupId,
              operations,
              params: {
                attempt_id: attemptId,
                chat_id: chatId,
              },
            },
          });

          await voiceReadyPromise;
        } catch (err) {
          conversationIdRef.current = null;
          activeGroupIdRef.current = null;
          setActiveGroupId(null);
          throw err;
        }
      })();

      startPromiseRef.current = startPromise;
      try {
        await startPromise;
      } finally {
        startPromiseRef.current = null;
      }
    },
    [transport, waitForAudioReady, hintsEnabled],
  );

  const stopAudio = useCallback(
    async (chatId: string): Promise<void> => {
      if (startPromiseRef.current) {
        await startPromiseRef.current.catch(() => undefined);
      }
      if (!conversationIdRef.current) return;
      transport.send("/attempt/chat/silence", { chat_id: chatId });
      await waitForAudioEnded(
        chatId,
        10000,
        activeGroupIdRef.current ?? groupId ?? null,
      );
      conversationIdRef.current = null;
      activeGroupIdRef.current = null;
      setActiveGroupId(null);
    },
    [transport, waitForAudioEnded, groupId],
  );

  const sendFrame = useCallback(
    (audio: ArrayBuffer) => {
      if (!chatIdRef.current) return;
      transport.send("/attempt/chat/speak", {
        chat_id: chatIdRef.current,
        ...(conversationIdRef.current
          ? { conversation_id: conversationIdRef.current }
          : {}),
        audio,
      });
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
