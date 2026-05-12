/**
 * useArtifactGeneration — general-purpose generation event listener.
 *
 * Subscribes via the Transport abstraction (WebSocket or SSE depending on mode).
 * Returns a GenerationListener interface for the GenerationPanel.
 *
 * Events (parameterized by artifactType):
 *   {type}.generate.started       → generation started
 *   {type}.generate.completed     → generation done
 *   {type}.generate.failed        → generation error
 *   {type}.generate.text.progress → streaming text delta
 *   {type}.generate.text.complete → text done
 *   {type}.generate.call.start    → tool call started (spinner)
 *   {type}.generate.call.complete → tool call done (check/X)
 *
 * Safety primitives:
 *   - 120s timeout: if `setGenerating(true)` is called and `completed`/`failed`
 *     does not fire within 120s, transitions to `stage = "error"`.
 *   - `stage` enum: idle | generating | error
 *   - `error` string: surface failure reason (from `failed` event or caller)
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTransport } from "@/lib/transport";

// ---------------------------------------------------------------------------
// Primitive interface — any artifact generation hook implements this
// ---------------------------------------------------------------------------

export type GenerationStage = "idle" | "generating" | "error";

export interface GenerationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  type: "text" | "tool" | "media";
  /** For ``type: "media"`` — the modality being produced. Drives which
   *  download helper the renderer reaches for (imageDownloadUrl /
   *  videoDownloadUrl / etc.) and which icon to show in the skeleton. */
  modality?: "image" | "video" | "audio";
  /** Resource-level id (``images_id`` / ``videos_id`` / ``audios_id``)
   *  carried on ``<art>.generate.{image|video|audio}.complete``.
   *  ``undefined`` while skeleton is in flight (only ``message_id`` is
   *  known from the matching ``.start`` event).  */
  resourceId?: string;
  /** ``true`` while the skeleton is in flight (after ``.start``, before
   *  ``.complete``). Renderer reads this to swap ``<img>`` for a
   *  spinner/gray block. Flips to ``false`` on ``.complete``. */
  pending?: boolean;
  toolName?: string;
  toolStatus?: "pending" | "success" | "error";
  /** Tool resource (id/name/description/...) when this audited
   *  operation has a registered tool. ``null`` means the audit fired
   *  but no tool is registered — render as a lightweight event pill
   *  rather than a full tool-call bubble. Always set explicitly to
   *  avoid ``exactOptionalPropertyTypes`` undefined-vs-absent ambiguity. */
  tool: Record<string, unknown> | null;
  /** Latest ``soft_calls_mv`` row for this call, stamped server-side
   *  in ``run_artifact_operation_with_audit`` and surfaced via the
   *  ``.completed`` event payload. ``null`` for non-soft calls.
   *  See ``project_soft_calls_entry_pattern`` (api memory). */
  ledgerStatus?: "pending" | "accepted" | "rejected" | null;
  ledgerOperation?: string | null;
  ledgerArtifact?: string | null;
  ledgerArtifactId?: string | null;
}

export interface GenerationListener {
  messages: GenerationMessage[];
  isGenerating: boolean;
  stage: GenerationStage;
  error: string | null;
  clearMessages: () => void;
  setGenerating: (value: boolean) => void;
  setError: (msg: string | null) => void;
  /** URL-backed currently-selected group id. Mirrors the URL's
   *  ``?groupId=`` (via nuqs) for the active panel scope. ``null`` when
   *  the user is on the SSR-resolved default group (clean URL).
   *  Populated by the provider, not the bare hook — the bare hook has
   *  no URL access and returns ``null`` here. */
  selectedGroupId: string | null;
  /** URL-write helper for the active group. Call this BEFORE firing a
   *  generate so the URL pins to the group the request is targeting —
   *  same pattern as ``draftId``. Refresh-during-generate then lands
   *  back on this same group (SSR resolves it from ``?groupId=``).
   *  Pass ``null`` to clear the URL ("new chat"). Provider-supplied;
   *  the bare hook returns a no-op. */
  latchGroupId: (id: string | null) => void;
  /** Transient "user explicitly wants a fresh chat" flag. Empty URL
   *  + ``forceNewChat=false`` ⇒ panel shows the windowed-default
   *  group (auto-resume, the "magic" of the app). Empty URL +
   *  ``forceNewChat=true`` ⇒ panel renders empty regardless of
   *  ``initialGroupHistory``. Resets to false on first generate
   *  (since the server then allocates a real group and the URL gets
   *  pinned). Lives in memory only — refresh during a fresh-chat
   *  intent reverts to windowed default. Provider-supplied. */
  forceNewChat: boolean;
  setForceNewChat: (value: boolean) => void;
}

const GENERATION_TIMEOUT_MS = 120_000;

export function useArtifactGeneration(
  artifactType: string | null,
  groupId: string | null,
): GenerationListener {
  const transport = useTransport();
  const [messages, setMessages] = useState<GenerationMessage[]>([]);
  const [isGenerating, setIsGeneratingState] = useState(false);
  const [stage, setStage] = useState<GenerationStage>("idle");
  const [error, setErrorState] = useState<string | null>(null);
  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const setGenerating = useCallback(
    (value: boolean) => {
      setIsGeneratingState(value);
      if (value) {
        setStage("generating");
        setErrorState(null);
        clearTimer();
        timeoutRef.current = setTimeout(() => {
          setIsGeneratingState(false);
          setStage("error");
          setErrorState("Generation timed out");
          timeoutRef.current = null;
        }, GENERATION_TIMEOUT_MS);
      } else {
        // Caller flipped off without explicit error; if we're not in error,
        // settle into idle. (Errors are set via setError or `failed` event.)
        clearTimer();
        setStage((prev) => (prev === "error" ? prev : "idle"));
      }
    },
    [clearTimer],
  );

  const setError = useCallback(
    (msg: string | null) => {
      if (msg) {
        clearTimer();
        setErrorState(msg);
        setStage("error");
        setIsGeneratingState(false);
      } else {
        setErrorState(null);
        setStage((prev) => (prev === "error" ? "idle" : prev));
      }
    },
    [clearTimer],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    clearTimer();
    setIsGeneratingState(false);
    setStage("idle");
    setErrorState(null);
  }, [clearTimer]);

  useEffect(() => {
    if (!artifactType) return;

    const prefix = `${artifactType}.generate`;

    // ── generate-loop lifecycle ────────────────────────────────────
    // Reserved op name — these mark the LLM run, not a tool call.
    const handleGenerateStarted = () => {
      setIsGeneratingState(true);
      setStage("generating");
      setErrorState(null);
      clearTimer();
      timeoutRef.current = setTimeout(() => {
        setIsGeneratingState(false);
        setStage("error");
        setErrorState("Generation timed out");
        timeoutRef.current = null;
      }, GENERATION_TIMEOUT_MS);
    };

    const handleGenerateCompleted = () => {
      clearTimer();
      setIsGeneratingState(false);
      setStage("idle");
    };

    const handleGenerateFailed = (data: Record<string, unknown>) => {
      clearTimer();
      setIsGeneratingState(false);
      const message = (data.message as string) || "Generation failed";
      setStage("error");
      setErrorState(message);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: message, type: "text", tool: null },
      ]);
    };

    // ── audited-op lifecycle (HTTP/socket-driven) ─────────────────
    // Each ${artifact}.${op}.{started|completed|failed} pair where op
    // is not "generate" renders as a tool-call bubble. Role is on the
    // payload (we threaded it through the audit layer). The operation
    // name is parsed out of `event_type` so a single wildcard covers
    // all current and future ops without per-op wiring.
    const titleCase = (s: string) =>
      s
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((w) => w[0]?.toUpperCase() + w.slice(1))
        .join(" ");

    const parseEventType = (
      data: Record<string, unknown>,
    ): { artifact: string; operation: string; phase: string } | null => {
      const eventType = data.event_type;
      if (typeof eventType !== "string") return null;
      const parts = eventType.split(".");
      // started/completed/failed live at depth 3; deeper events
      // (e.g. ${a}.generate.text.progress) are routed below by their
      // own exact subscriptions, so we early-return on those.
      if (parts.length !== 3) return null;
      const [a, operation, phase] = parts as [string, string, string];
      return { artifact: a, operation, phase };
    };

    const handleLifecycle = (
      phase: "started" | "completed" | "failed",
    ) => (data: Record<string, unknown>) => {
      const parsed = parseEventType(data);
      if (!parsed) return;
      const { operation } = parsed;

      // ``generate`` is the wrapper run that contains every tool call
      // and text-streaming event. Run the panel-state side-effects
      // (isGenerating flag, timeout timer) AND fall through to the
      // bubble-creation logic so the rail shows a long-running
      // "Persona Generate" pending bubble for the whole run — appears
      // before the user-message text bubble, stays pending while tool
      // calls and text deltas fire alongside, and flips to success on
      // ``persona.generate.completed``.
      if (operation === "generate") {
        if (phase === "started") handleGenerateStarted();
        else if (phase === "completed") handleGenerateCompleted();
        else handleGenerateFailed(data);
        // No early return — let the standard lifecycle code below also
        // create/update the bubble keyed by ``call_id``.
      }

      const callId = (data.call_id as string) || "";
      if (!callId) return;
      // SSE delivers role inside `payload`; WS delivers it at the
      // top level. Read both — consumers don't need to care which
      // transport delivered the event.
      const payload = (data.payload as Record<string, unknown> | undefined) ?? {};
      const rawRole = data.role ?? payload.role;
      const role = rawRole === "user" ? "user" : "assistant";
      const toolName = titleCase(`${parsed.artifact} ${operation}`);
      // ``tool`` is the canonical wire envelope from the audit framework
      // (full ``GetToolResponse`` shape, or ``null`` when no tool is
      // registered). The renderer uses presence/absence of this field
      // as the discriminator between "tool call" and "event pill".
      // Explicit ``| null`` typing avoids ``exactOptionalPropertyTypes``
      // friction at the setMessages site below.
      const tool: Record<string, unknown> | null =
        ((data.tool as Record<string, unknown> | null | undefined) ??
          (payload.tool as Record<string, unknown> | null | undefined) ??
          null);

      if (phase === "started") {
        setMessages((prev) => {
          // If the pipeline's ``generate.call.start`` already created
          // a bubble for this ``call_id`` (raw snake_case ``tool_name``),
          // promote its label to the title-cased operation name AND
          // the tool envelope (pipeline event has no ``tool`` field;
          // the audit's started arrives later and refines).
          if (prev.some((m) => m.id === callId)) {
            return prev.map((m) =>
              m.id === callId
                ? { ...m, toolName, tool: (tool ?? m.tool) ?? null }
                : m,
            );
          }
          return [
            ...prev,
            { id: callId, role, text: "", type: "tool", toolName, toolStatus: "pending", tool },
          ];
        });
        return;
      }

      const nextStatus = phase === "completed" ? "success" : "error";
      // ``.completed`` carries the soft_calls ledger snapshot stamped
      // by the audit emit — pick it up so live bubbles render the
      // inline Accept/Reject without waiting for a group refetch.
      const ledgerStatus =
        (data.ledger_status as "pending" | "accepted" | "rejected" | null | undefined) ??
        (payload.ledger_status as "pending" | "accepted" | "rejected" | null | undefined) ??
        null;
      const ledgerOperation =
        (data.ledger_operation as string | null | undefined) ??
        (payload.ledger_operation as string | null | undefined) ??
        null;
      const ledgerArtifact =
        (data.ledger_artifact as string | null | undefined) ??
        (payload.ledger_artifact as string | null | undefined) ??
        null;
      const ledgerArtifactId =
        (data.ledger_artifact_id as string | null | undefined) ??
        (payload.ledger_artifact_id as string | null | undefined) ??
        null;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === callId
            ? {
                ...m,
                toolStatus: nextStatus,
                ledgerStatus,
                ledgerOperation,
                ledgerArtifact,
                ledgerArtifactId,
              }
            : m,
        ),
      );
    };

    // ── generate-internal sub-events ───────────────────────────────
    const handleTextProgress = (data: Record<string, unknown>) => {
      const delta = data.delta as string;
      if (!delta) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.type === "text" && last.role === "assistant") {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, text: last.text + delta };
          return updated;
        }
        return [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", text: delta, type: "text", tool: null },
        ];
      });
    };

    const handleTextComplete = (data: Record<string, unknown>) => {
      const role = (data.role as string) || "assistant";
      const text = data.text as string;
      if (!text) return;
      if (role === "system" || role === "developer") return;
      if (role === "user") {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", text, type: "text", tool: null },
        ]);
        return;
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.type === "text" && last.role === "assistant") {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, text };
          return updated;
        }
        return [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", text, type: "text", tool: null },
        ];
      });
    };

    // Pipeline-driven tool-call lifecycle. Server emits ``call_id`` (the
    // pre-minted DB row id) on these events so they share an id space
    // with the audit lifecycle (``handleLifecycle`` above). Same id ⇒
    // the dedup-on-id branch in ``handleLifecycle`` collapses both
    // events into a single bubble. Whichever fires first creates the
    // bubble; the other arrives, finds the id, and is a no-op for
    // creation but still drives status updates.
    const handleCallStart = (data: Record<string, unknown>) => {
      const callId = data.call_id as string;
      const toolName = data.tool_name as string;
      if (!callId) return;
      const role = data.role === "user" ? "user" : "assistant";
      setMessages((prev) => {
        if (prev.some((m) => m.id === callId)) return prev;
        return [
          ...prev,
          {
            id: callId,
            role,
            text: "",
            type: "tool",
            // ``tool`` envelope is set by the audit's ``.started`` event
            // that follows this pipeline event. Until then, render as a
            // generic tool call (no envelope yet).
            tool: null,
            toolName: toolName || "tool_call",
            toolStatus: "pending",
          },
        ];
      });
    };

    const handleCallComplete = (data: Record<string, unknown>) => {
      const callId = data.call_id as string;
      const success = data.success as boolean;
      if (!callId) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === callId
            ? { ...msg, toolStatus: success ? "success" : "error" }
            : msg,
        ),
      );
    };

    // Media lifecycle. Server pre-mints ``message_id`` in
    // ``execute_media_dispatch`` and includes it on every ``.start`` /
    // ``.progress`` / ``.complete`` / ``.error`` emit so the FE can
    // create an optimistic skeleton bubble on ``.start`` and replace
    // its content in-place on ``.complete`` (no flicker, no reordering).
    // The resource id (``images_id`` / ``videos_id`` / ``audios_id``)
    // arrives on ``.complete`` — that's the id the matching download
    // helper consumes (e.g. ``imageDownloadUrl(art, id)``).
    const handleMediaStart =
      (modality: "image" | "video" | "audio") =>
      (data: Record<string, unknown>) => {
        const messageId = data.message_id as string | undefined;
        if (!messageId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === messageId)) return prev;
          return [
            ...prev,
            {
              id: messageId,
              role: "assistant",
              text: "",
              type: "media",
              modality,
              pending: true,
              tool: null,
            },
          ];
        });
      };

    const handleMediaComplete =
      (modality: "image" | "video" | "audio") =>
      (data: Record<string, unknown>) => {
        const messageId = data.message_id as string | undefined;
        if (!messageId) return;
        // Resource id keys differ by modality on the wire — pick the
        // one this complete event carries.
        const resourceKey =
          modality === "image"
            ? "images_id"
            : modality === "video"
              ? "videos_id"
              : "audios_id";
        const resourceId = data[resourceKey] as string | undefined;
        setMessages((prev) => {
          const existing = prev.findIndex((m) => m.id === messageId);
          const next: GenerationMessage = {
            id: messageId,
            role: "assistant",
            text: "",
            type: "media",
            modality,
            resourceId,
            pending: false,
            tool: null,
          };
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { ...prev[existing]!, ...next };
            return updated;
          }
          // No skeleton existed (we missed ``.start``) — append fresh.
          return [...prev, next];
        });
      };

    const handleMediaError =
      (modality: "image" | "video" | "audio") =>
      (data: Record<string, unknown>) => {
        const messageId = data.message_id as string | undefined;
        if (!messageId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, type: "media", modality, pending: false, toolStatus: "error" }
              : m,
          ),
        );
      };

    // Pass groupId via scope so SSE opens /{artifact}/watch?group_id=<id>.
    const scope = groupId ? { groupId } : undefined;

    const unsubs = [
      // One wildcard per phase — covers `generate` AND every audited op
      // (persona.group, persona.context, etc.) without per-op wiring.
      transport.on(`${artifactType}.*.started`, handleLifecycle("started"), scope),
      transport.on(`${artifactType}.*.completed`, handleLifecycle("completed"), scope),
      transport.on(`${artifactType}.*.failed`, handleLifecycle("failed"), scope),
      // Generate-internal sub-events stay exact.
      transport.on(`${prefix}.text.progress`, handleTextProgress, scope),
      transport.on(`${prefix}.text.complete`, handleTextComplete, scope),
      transport.on(`${prefix}.call.start`, handleCallStart, scope),
      transport.on(`${prefix}.call.complete`, handleCallComplete, scope),
      // Media lifecycle — skeleton on ``.start``, content swap on
      // ``.complete``, error state on ``.error``. Symmetric for the
      // three streamable modalities so chat panels render media live
      // without waiting for a refresh.
      transport.on(`${prefix}.image.start`, handleMediaStart("image"), scope),
      transport.on(`${prefix}.image.complete`, handleMediaComplete("image"), scope),
      transport.on(`${prefix}.image.error`, handleMediaError("image"), scope),
      transport.on(`${prefix}.video.start`, handleMediaStart("video"), scope),
      transport.on(`${prefix}.video.complete`, handleMediaComplete("video"), scope),
      transport.on(`${prefix}.video.error`, handleMediaError("video"), scope),
      transport.on(`${prefix}.audio.start`, handleMediaStart("audio"), scope),
      transport.on(`${prefix}.audio.complete`, handleMediaComplete("audio"), scope),
      transport.on(`${prefix}.audio.error`, handleMediaError("audio"), scope),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
      clearTimer();
    };
  }, [artifactType, transport, groupId, clearTimer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    messages,
    isGenerating,
    stage,
    error,
    clearMessages,
    setGenerating,
    setError,
    // The bare hook has no URL access — these are no-op stubs
    // overridden by `GenerationListenerProvider`.
    selectedGroupId: null,
    latchGroupId: () => {},
    forceNewChat: false,
    setForceNewChat: () => {},
  };
}
