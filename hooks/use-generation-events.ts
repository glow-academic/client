/**
 * useGenerationEvents — pure transport listener for a generation lifecycle.
 *
 * One of three generation primitives:
 *   - useGenerationEvents  (this file): receive events, track state
 *   - useGenerate:                      emit, correlate run_ids
 *   - useGenerationToast:               toast lifecycle bound to a runId
 *
 * Per-artifact wrapper hooks (usePersonaAi, useCohortAi, …) compose these
 * three — this file owns none of the artifact-specific shape.
 *
 * Event names are explicit — no magic prefix rules. The caller passes the
 * set of lifecycle event keys they care about (minimum: `complete`). The
 * hook subscribes via `useTransport`, never `useSocket` directly — so it
 * works identically across ws / http-sse / etc. transport modes.
 *
 * Scope filtering (group_id / entity_id) is server-side where possible but
 * also enforced here as a safety net: events whose scope doesn't match the
 * caller's are dropped before they touch state.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useTransport } from "@/lib/transport";

export interface GenerationEventNames {
  /** Optional — emitted when a run starts. Default: not listened. */
  started?: string;
  /** Optional — emitted for intermediate progress. */
  progress?: string;
  /** Required — emitted when a run finishes successfully. */
  complete: string;
  /** Optional — emitted on failure. */
  error?: string;
}

export interface GenerationScope {
  /** Drop events whose `group_id` doesn't match. Null/undefined = no filter. */
  groupId?: string | null;
  /** Drop events whose `entity_id` doesn't match. */
  entityId?: string | null;
}

export interface UseGenerationEventsConfig<T> {
  events: GenerationEventNames;
  scope?: GenerationScope;
  /** Optional transform from raw event payload to a typed shape. */
  decode?: (raw: Record<string, unknown>) => T;
  /** When true, accumulate complete payloads into `history`. Default false. */
  accumulate?: boolean;
}

export interface UseGenerationEventsReturn<T> {
  isGenerating: boolean;
  started: T | null;
  progress: T | null;
  /** Latest successful complete payload. */
  complete: T | null;
  /** Latest error payload. */
  error: T | null;
  /** Most recent received payload regardless of phase. */
  last: T | null;
  /** Current in-flight partial (progress payload, cleared on complete/error). */
  partial: T | null;
  /** All complete payloads received since mount or last clear, if accumulate. */
  history: T[];
  clear: () => void;
}

type RawPayload = Record<string, unknown>;

function defaultDecode<T>(raw: RawPayload): T {
  return raw as unknown as T;
}

function scopeMatches(raw: RawPayload, scope: GenerationScope | undefined): boolean {
  if (!scope) return true;
  if (scope.groupId != null) {
    const gid = raw["group_id"];
    if (gid != null && gid !== scope.groupId) return false;
  }
  if (scope.entityId != null) {
    const eid = raw["entity_id"];
    if (eid != null && eid !== scope.entityId) return false;
  }
  return true;
}

export function useGenerationEvents<T = Record<string, unknown>>(
  config: UseGenerationEventsConfig<T>,
): UseGenerationEventsReturn<T> {
  const transport = useTransport();
  const {
    events,
    scope,
    decode = defaultDecode<T>,
    accumulate = false,
  } = config;

  const [isGenerating, setIsGenerating] = useState(false);
  const [started, setStarted] = useState<T | null>(null);
  const [progress, setProgress] = useState<T | null>(null);
  const [complete, setComplete] = useState<T | null>(null);
  const [error, setError] = useState<T | null>(null);
  const [last, setLast] = useState<T | null>(null);
  const [partial, setPartial] = useState<T | null>(null);
  const [history, setHistory] = useState<T[]>([]);

  // Keep latest scope + decode in refs so we can register stable listeners
  // that pick up new values without re-subscribing on every render.
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const decodeRef = useRef(decode);
  decodeRef.current = decode;
  const accumulateRef = useRef(accumulate);
  accumulateRef.current = accumulate;

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    // Scope passed to transport.on doubles as: (a) routing hint for SSE
    // (which /{artifact}/stream?group_id=… connection to open), and (b)
    // server-side filter knowledge. Client-side scopeMatches() is a defensive
    // re-check for cases where multiple groups share an EventSource.
    const onScope = scope?.groupId ? { groupId: scope.groupId } : undefined;

    if (events.started) {
      unsubs.push(
        transport.on(events.started, (raw) => {
          if (!scopeMatches(raw, scopeRef.current)) return;
          const payload = decodeRef.current(raw);
          setStarted(payload);
          setLast(payload);
          setPartial(null);
          setIsGenerating(true);
        }, onScope),
      );
    }

    if (events.progress) {
      unsubs.push(
        transport.on(events.progress, (raw) => {
          if (!scopeMatches(raw, scopeRef.current)) return;
          const payload = decodeRef.current(raw);
          setProgress(payload);
          setPartial(payload);
          setLast(payload);
          setIsGenerating(true);
        }, onScope),
      );
    }

    unsubs.push(
      transport.on(events.complete, (raw) => {
        if (!scopeMatches(raw, scopeRef.current)) return;
        // Auto-filter failed events marked success:false.
        if (raw["success"] === false) return;
        const payload = decodeRef.current(raw);
        setComplete(payload);
        setLast(payload);
        setPartial(null);
        setIsGenerating(false);
        if (accumulateRef.current) {
          setHistory((prev) => [...prev, payload]);
        }
      }, onScope),
    );

    if (events.error) {
      unsubs.push(
        transport.on(events.error, (raw) => {
          if (!scopeMatches(raw, scopeRef.current)) return;
          const payload = decodeRef.current(raw);
          setError(payload);
          setLast(payload);
          setPartial(null);
          setIsGenerating(false);
        }, onScope),
      );
    }

    return () => {
      for (const off of unsubs) off();
    };
  }, [
    transport,
    events.started,
    events.progress,
    events.complete,
    events.error,
    scope?.groupId,
  ]);

  const clear = useCallback(() => {
    setStarted(null);
    setProgress(null);
    setComplete(null);
    setError(null);
    setLast(null);
    setPartial(null);
    setHistory([]);
    setIsGenerating(false);
  }, []);

  return {
    isGenerating,
    started,
    progress,
    complete,
    error,
    last,
    partial,
    history,
    clear,
  };
}
