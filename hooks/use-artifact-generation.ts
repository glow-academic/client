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
  type: "text" | "tool" | "media" | "reasoning";
  /** Reasoning timing — first delta timestamp + completion timestamp.
   *  Drives the "Thought for Xs" label. Only set when ``type === "reasoning"``. */
  reasoningStartedAt?: number;
  reasoningCompletedAt?: number;
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
  /** Per-resource_type generating set. Populated when a generate event
   *  carries ``resource_types`` (or ``resource_type``) in its payload —
   *  artifacts that fan out per-resource (Scenario StepCards) gate
   *  buttons on ``generatingResources.has(rt)``; artifacts that don't
   *  fan out (Persona) just read ``isGenerating``. Both kept in sync. */
  generatingResources: Set<string>;
  /** 0-100 percentage from the latest ``${artifact}.generate.text.progress``
   *  payload. Reset to 0 on completed/failed. */
  generationProgress: number;
  stage: GenerationStage;
  error: string | null;
  clearMessages: () => void;
  setGenerating: (value: boolean) => void;
  setError: (msg: string | null) => void;
  /** Fire a multi-resource generate against ``/{artifactType}/generate``.
   *  Seeds ``generatingResources`` optimistically, arms a per-resource
   *  120s safety timeout, and posts the canonical envelope
   *  (``instructions``, ``config: {operations, dangerous, group_id, params}``,
   *  ``client_run_id``). Returns true if the request was dispatched, false
   *  when called with an empty resource list. */
  generateResources: (
    resourceTypes: string[],
    options?: Record<string, unknown>,
  ) => boolean;
  /** Clear a single resource_type from ``generatingResources`` without
   *  cancelling other in-flight generates. Used by StepCard callbacks
   *  that want to manually settle a resource once the resulting draft
   *  patch lands. */
  clearGeneratingResource: (resourceType: string) => void;
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

/** Lift the resource_types list off an event payload. The server emits
 *  either ``resource_types: string[]`` (fan-out) or ``resource_type: string``
 *  (single) depending on the operation — accept both shapes. */
function pickResourceTypes(raw: Record<string, unknown> | null | undefined): string[] {
  if (!raw) return [];
  const list = raw["resource_types"];
  if (Array.isArray(list)) return list.filter((v): v is string => typeof v === "string");
  const single = raw["resource_type"];
  return typeof single === "string" ? [single] : [];
}

export function useArtifactGeneration(
  artifactType: string | null,
  groupId: string | null,
): GenerationListener {
  const transport = useTransport();
  const [messages, setMessages] = useState<GenerationMessage[]>([]);
  const [isGenerating, setIsGeneratingState] = useState(false);
  const [generatingResources, setGeneratingResources] = useState<Set<string>>(
    () => new Set(),
  );
  const [generationProgress, setGenerationProgress] = useState(0);
  const [stage, setStage] = useState<GenerationStage>("idle");
  const [error, setErrorState] = useState<string | null>(null);
  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Per-resource_type safety timers. Each resource gets its own 120s
   *  watchdog so a single hung resource doesn't trap the whole panel. */
  const resourceTimeoutsRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  // Identity of the single reasoning bubble for the current generate
  // turn. The agentic loop streams reasoning_delta across multiple LLM
  // iterations (one round per tool-call batch); each iteration ends
  // with finish_reason=tool_calls, not stop, so reasoning.complete only
  // fires at the very last iteration. Without an explicit per-turn
  // anchor, deltas arriving after a tool call would open a *new* bubble
  // (the previous "last" message is a tool). Result: N iterations = N
  // bubbles, none of which auto-collapse. The ref lets every delta in a
  // turn land in one bubble; we reset it on generate.started so the
  // next turn starts fresh.
  const currentReasoningIdRef = useRef<string | null>(null);

  // Helper: stamp completion on the active reasoning bubble (if any)
  // and clear the ref. Called when ANY signal indicates "thinking is
  // done for this turn" — text starts arriving, the run completes, or
  // reasoning.complete fires explicitly. Idempotent.
  const closeActiveReasoning = useCallback((finalText?: string) => {
    const id = currentReasoningIdRef.current;
    if (!id) return;
    currentReasoningIdRef.current = null;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id && m.type === "reasoning"
          ? {
              ...m,
              text: finalText && finalText.length > 0 ? finalText : m.text,
              reasoningCompletedAt: Date.now(),
            }
          : m,
      ),
    );
  }, []);

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
    currentReasoningIdRef.current = null;
    setIsGeneratingState(false);
    setStage("idle");
    setErrorState(null);
  }, [clearTimer]);

  useEffect(() => {
    if (!artifactType) return;

    const prefix = `${artifactType}.generate`;

    // ── generate-loop lifecycle ────────────────────────────────────
    // Reserved op name — these mark the LLM run, not a tool call.
    const handleGenerateStarted = (data: Record<string, unknown>) => {
      setIsGeneratingState(true);
      setStage("generating");
      setErrorState(null);
      clearTimer();
      // Fresh turn — reset the reasoning bubble anchor so the next
      // reasoning_delta opens a new bubble instead of appending to
      // last turn's.
      currentReasoningIdRef.current = null;
      timeoutRef.current = setTimeout(() => {
        setIsGeneratingState(false);
        setStage("error");
        setErrorState("Generation timed out");
        timeoutRef.current = null;
      }, GENERATION_TIMEOUT_MS);
      // Per-resource fan-out: the server reports which resource_types are
      // in flight on the started event. Add them to the set so artifacts
      // that gate per-resource UI (Scenario StepCards) light up the right
      // buttons. Artifacts that fan out at the artifact level (Persona)
      // emit no resource_types and just rely on ``isGenerating``.
      const rts = pickResourceTypes(data);
      if (rts.length > 0) {
        setGeneratingResources((prev) => {
          const next = new Set(prev);
          for (const rt of rts) next.add(rt);
          return next;
        });
      }
    };

    const handleGenerateCompleted = (data: Record<string, unknown>) => {
      clearTimer();
      setIsGeneratingState(false);
      setStage("idle");
      // Belt-and-suspenders: if reasoning.complete didn't fire (e.g.
      // the model produced no separate reasoning channel and went
      // straight to text), the bubble is already closed by
      // closeActiveReasoning in handleTextProgress. If it did fire but
      // somehow the ref still points at a bubble, close it now.
      closeActiveReasoning();
      const rts = pickResourceTypes(data);
      const rtsToCancel =
        rts.length > 0 ? rts : Array.from(resourceTimeoutsRef.current.keys());
      for (const rt of rtsToCancel) {
        const t = resourceTimeoutsRef.current.get(rt);
        if (t) {
          clearTimeout(t);
          resourceTimeoutsRef.current.delete(rt);
        }
      }
      setGeneratingResources((prev) => {
        if (rts.length === 0) return new Set();
        const next = new Set(prev);
        for (const rt of rts) next.delete(rt);
        return next;
      });
      setGenerationProgress(0);
    };

    const handleGenerateFailed = (data: Record<string, unknown>) => {
      clearTimer();
      setIsGeneratingState(false);
      closeActiveReasoning();
      const message = (data.message as string) || "Generation failed";
      setStage("error");
      setErrorState(message);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: message, type: "text", tool: null },
      ]);
      const rts = pickResourceTypes(data);
      const rtsToCancel =
        rts.length > 0 ? rts : Array.from(resourceTimeoutsRef.current.keys());
      for (const rt of rtsToCancel) {
        const t = resourceTimeoutsRef.current.get(rt);
        if (t) {
          clearTimeout(t);
          resourceTimeoutsRef.current.delete(rt);
        }
      }
      setGeneratingResources((prev) => {
        if (rts.length === 0) return new Set();
        const next = new Set(prev);
        for (const rt of rts) next.delete(rt);
        return next;
      });
      setGenerationProgress(0);
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
        if (phase === "started") handleGenerateStarted(data);
        else if (phase === "completed") handleGenerateCompleted(data);
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
      // Server reports streaming progress as a percentage when the
      // run knows its denominator (e.g. multi-resource fan-outs).
      // Optional — text-only progress events carry only ``delta``.
      const pct = data["percentage"];
      if (typeof pct === "number") setGenerationProgress(pct);
      const delta = data.delta as string;
      if (!delta) return;
      // Reasoning channel often doesn't emit its own ``.complete`` on
      // models that interleave reasoning + text within one iteration
      // (or when reasoning ends because text simply started). The first
      // text delta is an unambiguous "thinking phase ended" signal —
      // close the active reasoning bubble here so it stamps a real
      // ``reasoningCompletedAt`` and auto-collapses in the UI.
      closeActiveReasoning();
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

    // Reasoning channel — model's chain-of-thought trace streamed
    // separately from the final answer. Renders as a borderless
    // accordion above the answer bubble. We coalesce deltas onto the
    // trailing reasoning bubble *only* if no text bubble has been
    // opened since (a fresh answer ⇒ fresh reasoning row for the next
    // turn). On ``.complete`` we stamp the end time so the panel can
    // show "Thought for Xs".
    const handleReasoningProgress = (data: Record<string, unknown>) => {
      const delta = data["delta"] as string;
      if (!delta) return;
      const existingId = currentReasoningIdRef.current;
      if (existingId) {
        // Append to the bubble we opened earlier this turn — even if a
        // tool-call bubble (or a stray text-complete echo) has landed
        // between deltas. Keeps the visual model in sync with the DB,
        // which persists exactly one accumulated reasoning row per run.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === existingId && m.type === "reasoning"
              ? { ...m, text: m.text + delta }
              : m,
          ),
        );
        return;
      }
      // First reasoning delta of this turn — open a new bubble and
      // anchor the ref on its id so all subsequent deltas land here.
      const id = crypto.randomUUID();
      currentReasoningIdRef.current = id;
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: "assistant",
          text: delta,
          type: "reasoning",
          tool: null,
          reasoningStartedAt: Date.now(),
        },
      ]);
    };

    const handleReasoningComplete = (data: Record<string, unknown>) => {
      // Server-signalled end of the reasoning channel — stamp the
      // bubble closed and clear the ref. Helper handles the
      // "no bubble currently active" case (no-op).
      const finalText = (data["text"] as string) || "";
      closeActiveReasoning(finalText);
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
      transport.on(`${prefix}.reasoning.progress`, handleReasoningProgress, scope),
      transport.on(`${prefix}.reasoning.complete`, handleReasoningComplete, scope),
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
    const timers = resourceTimeoutsRef.current;
    return () => {
      clearTimer();
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, [clearTimer]);

  const clearGeneratingResource = useCallback((resourceType: string) => {
    setGeneratingResources((prev) => {
      if (!prev.has(resourceType)) return prev;
      const next = new Set(prev);
      next.delete(resourceType);
      return next;
    });
    const t = resourceTimeoutsRef.current.get(resourceType);
    if (t) {
      clearTimeout(t);
      resourceTimeoutsRef.current.delete(resourceType);
    }
  }, []);

  const generateResources = useCallback(
    (
      resourceTypes: string[],
      options: Record<string, unknown> = {},
    ): boolean => {
      if (!artifactType || resourceTypes.length === 0) return false;

      // Seed the set optimistically so the UI reflects the click before
      // the server's started event arrives.
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        for (const rt of resourceTypes) next.add(rt);
        return next;
      });

      // Per-resource safety timeout — if neither completed nor failed
      // fires for a resource in 120s, clear it so the spinner doesn't
      // hang forever. The artifact-level timeout (timeoutRef) still
      // guards the overall generate run.
      for (const rt of resourceTypes) {
        const existing = resourceTimeoutsRef.current.get(rt);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          setGeneratingResources((prev) => {
            if (!prev.has(rt)) return prev;
            const next = new Set(prev);
            next.delete(rt);
            return next;
          });
          resourceTimeoutsRef.current.delete(rt);
        }, GENERATION_TIMEOUT_MS);
        resourceTimeoutsRef.current.set(rt, t);
      }

      const runId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

      // Canonical wire shape — matches persona/scenario/attempt: HTTP-route
      // path + nested `config:` envelope. Server reads `config.params` for
      // artifact_id resolution and `config.operations` for the resource types.
      void transport
        .send(`/${artifactType}/generate`, {
          instructions: [],
          config: {
            operations: resourceTypes,
            dangerous: true,
            group_id: groupIdRef.current,
            params: { ...options },
          },
          client_run_id: runId,
        })
        .catch(() => {
          // Send-side rejection: clear optimistic state + cancel timeouts.
          for (const rt of resourceTypes) {
            const t = resourceTimeoutsRef.current.get(rt);
            if (t) {
              clearTimeout(t);
              resourceTimeoutsRef.current.delete(rt);
            }
          }
          setGeneratingResources((prev) => {
            const next = new Set(prev);
            for (const rt of resourceTypes) next.delete(rt);
            return next;
          });
        });

      return true;
    },
    [artifactType, transport],
  );

  return {
    messages,
    isGenerating,
    generatingResources,
    generationProgress,
    stage,
    error,
    clearMessages,
    setGenerating,
    setError,
    generateResources,
    clearGeneratingResource,
    // The bare hook has no URL access — these are no-op stubs
    // overridden by `GenerationListenerProvider`.
    selectedGroupId: null,
    latchGroupId: () => {},
    forceNewChat: false,
    setForceNewChat: () => {},
  };
}
