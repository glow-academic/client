/**
 * useAttemptTranscribe — STT helper for an attempt chat.
 *
 * Takes a recorded audio Blob, uploads it via the BFF multipart route,
 * fires the canonical STT dispatch (``/attempt/generate`` with
 * ``audios_id`` set and ``modalities=["text"]``), waits for the
 * matching ``attempt.generate.text.complete`` event, and returns
 * ``{ text, audios_id }``.
 *
 * Decoupled from the persist + assistant-response steps so callers
 * (TextInput, the voice hook) can plug it into different downstream
 * flows. TextInput just populates its textarea with ``text`` and
 * retains ``audios_id`` to ride along on the eventual
 * ``/attempt/chat_message`` send.
 *
 * Extracted from the STT chunk inside ``use-attempt-voice.ts`` so both
 * the text-mode mic and the realtime voice path stay in sync on how
 * transcription is dispatched + filtered.
 */
"use client";

import { useCallback, useRef } from "react";
import { useTransport } from "@/lib/transport";

interface UseAttemptTranscribeConfig {
  /** Active chat id at call time. */
  chatId: string | null;
  /** Active attempt id at call time. */
  attemptId?: string | null;
  /** Group id for SSE event scoping (also forwarded to the generate
   *  call's ``config.group_id``). When null the route resolves a
   *  time-windowed group server-side. */
  groupId?: string | null;
}

export interface TranscribeResult {
  text: string;
  audios_id: string;
}

function eventBody(data: Record<string, unknown>): Record<string, unknown> {
  const payload = data["payload"];
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : data;
}

/**
 * Returns a stable ``transcribe`` callback. Pass a recorded ``Blob``
 * (from MediaRecorder); resolves to the transcript text plus the
 * canonical ``audios_id`` (audios_resource id) for ride-along on
 * subsequent persistence calls.
 */
export function useAttemptTranscribe({
  chatId,
  attemptId,
  groupId,
}: UseAttemptTranscribeConfig): {
  transcribe: (blob: Blob, opts?: { timeoutMs?: number }) => Promise<TranscribeResult>;
} {
  const transport = useTransport();
  // Mirror primitives into refs so the ``transcribe`` callback stays
  // stable across renders while still reading the latest values at
  // invocation time. Callers can pass freshly updated strings each
  // render without invalidating downstream button handlers.
  const chatIdRef = useRef<string | null>(chatId);
  chatIdRef.current = chatId;
  const attemptIdRef = useRef<string | null>(attemptId ?? null);
  attemptIdRef.current = attemptId ?? null;
  const groupIdRef = useRef<string | null>(groupId ?? null);
  groupIdRef.current = groupId ?? null;

  const transcribe = useCallback(
    async (blob: Blob, opts?: { timeoutMs?: number }): Promise<TranscribeResult> => {
      const currentChatId = chatIdRef.current;
      if (!currentChatId) {
        throw new Error("No active chat for transcription");
      }
      const currentAttemptId = attemptIdRef.current;
      const activeGroupId = groupIdRef.current;
      const timeoutMs = opts?.timeoutMs ?? 30000;

      // (1) Upload the recorded blob. The BFF route proxies to
      // ``POST /attempt/audio_upload`` (multipart) and returns
      // ``{ audio_id, audios_id, upload_id }`` — we only need
      // ``audios_id`` (the resource id) for the STT dispatch and the
      // downstream persistence ride-along.
      const form = new FormData();
      // MediaRecorder defaults to ``audio/webm;codecs=opus`` (Chrome /
      // Firefox) or ``audio/mp4`` (Safari) — both in the upstream
      // ALLOWED_AUDIO_TYPES set. Mirror the blob's type so the server
      // sees the right Content-Type on the part.
      const ext = blob.type.includes("webm")
        ? "webm"
        : blob.type.includes("mp4")
          ? "mp4"
          : blob.type.includes("wav")
            ? "wav"
            : "bin";
      form.append("file", blob, `recording.${ext}`);
      const uploadResp = await fetch("/api/attempt/audio_upload", {
        method: "POST",
        body: form,
      });
      if (!uploadResp.ok) {
        const msg = await uploadResp.text().catch(() => "");
        throw new Error(
          `Audio upload failed (${uploadResp.status}): ${msg.slice(0, 200)}`,
        );
      }
      const uploadJson = (await uploadResp.json()) as {
        audios_id?: string;
        audio_id?: string;
      };
      const audiosId = uploadJson.audios_id;
      if (!audiosId) {
        throw new Error("Audio upload returned no audios_id");
      }

      // (2) Arm the transcript listener BEFORE dispatching, so we
      // don't miss the ``text.complete`` event that fires before
      // ``transport.send`` resolves. Filter on ``run_id`` (not
      // ``group_id``): the realtime adapter also emits
      // ``attempt.generate.text.complete`` for assistant transcripts
      // on the same group, so group_id alone is ambiguous. The STT
      // run also echoes prepared prompt messages with the same run_id,
      // so additionally require the canonical text_complete payload
      // shape (event_type === "text_complete" and no ``role``).
      let runIdLocal: string | null = null;
      const buffer: Array<Record<string, unknown>> = [];
      let resolveFn!: (s: string) => void;
      let rejectFn!: (e: unknown) => void;
      const transcriptPromise = new Promise<string>((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
      });
      const timer = setTimeout(() => {
        unsub();
        rejectFn(new Error("STT timed out"));
      }, timeoutMs);
      const scope = activeGroupId ? { groupId: activeGroupId } : undefined;
      const unsub = transport.on(
        "attempt.generate.text.complete",
        (ev) => {
          const body = eventBody(ev);
          const rid = (body["run_id"] as string) ?? "";
          const text = (body["text"] as string) ?? "";
          const isSttOutput =
            body["event_type"] === "text_complete" &&
            !body["role"] &&
            Boolean(text.trim());
          if (!isSttOutput) return;
          if (runIdLocal === null) {
            buffer.push(body);
            return;
          }
          if (rid !== runIdLocal) return;
          clearTimeout(timer);
          unsub();
          resolveFn(text);
        },
        scope,
      );

      try {
        // (3) Dispatch the STT generate. ``audios_id`` + ``modalities=
        // ["text"]`` routes to the canonical STT executor via
        // ``score_agents`` → existing ``Transcribe`` agent.
        const generateResult = (await transport.send("/attempt/generate", {
          modalities: ["text"],
          audios_id: audiosId,
          config: {
            group_id: activeGroupId ?? undefined,
            params: {
              attempt_id: currentAttemptId ?? undefined,
              chat_id: currentChatId,
            },
          },
        })) as Record<string, unknown>;
        const runId = generateResult["run_id"] as string | undefined;
        if (!runId) {
          clearTimeout(timer);
          unsub();
          throw new Error("STT generate did not return run_id");
        }
        runIdLocal = runId;
        // Flush any events that arrived before we knew runId.
        const match = buffer.find((e) => e["run_id"] === runId);
        if (match) {
          clearTimeout(timer);
          unsub();
          const text = ((match["text"] as string) ?? "").trim();
          return { text, audios_id: audiosId };
        }
        const transcript = (await transcriptPromise).trim();
        return { text: transcript, audios_id: audiosId };
      } catch (err) {
        clearTimeout(timer);
        unsub();
        throw err;
      }
    },
    [transport],
  );

  return { transcribe };
}
