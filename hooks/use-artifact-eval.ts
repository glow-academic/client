/**
 * useArtifactEval — paired eval workflow for an artifact generate call.
 *
 * Subscribes to the per-agent + aggregate generate events for a given
 * artifact + run_id, exposes the resulting candidates, and provides
 * three helpers — grade / promote / reject — that wrap the canonical
 * server endpoints. Callers plug in a policy via ``onCandidate``
 * (per-agent, fires as candidates trickle in) and/or
 * ``onCandidatesReady`` (aggregate, fires when the pool is done).
 *
 * Wire shape:
 *   <artifact>.generate.agent_completed   → per-agent (one per agent)
 *   <artifact>.generate.completed         → aggregate (one when all done)
 *
 * Promote/reject ride on the canonical ``idempotency_key + accept``
 * pattern: each candidate's ``call_ids`` (the soft-write call ids
 * minted at dispatch time) are acked individually via
 * ``/<artifact>/create``. The ``grade`` helper hits ``/test/grade``
 * with either an explicit score or ``full=true`` (server fills in
 * the rubric's max marks).
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTransport } from "@/lib/transport";

export interface Candidate {
  agent_id: string;
  invocation_id: string | null;
  rubric_id: string | null;
  run_id: string;
  group_id: string;
  test_id: string | null;
  /** Pending soft-write call_ids — used as ``idempotency_key`` to ack. */
  call_ids: string[];
}

export interface GradeArgs {
  /** Pass ``full: true`` to let the server fill in max marks (the
   *  rubric's ``total_points``). Skips having to know the rubric
   *  ceiling client-side. */
  full?: boolean;
  /** Explicit numeric score. Ignored when ``full=true``. */
  score?: number;
  /** Optional caller-supplied run_id for audit linkage. Falls back to
   *  the candidate's run_id when omitted. */
  run_id?: string;
}

export interface EvalHelpers {
  /** Manually record a grade for a candidate. Calls ``/test/grade``. */
  grade: (c: Candidate, args?: GradeArgs) => Promise<unknown>;
  /** Promote a candidate — fires one ``/<artifact>/create`` with
   *  ``accept: true`` per soft-write call_id. */
  promote: (c: Candidate) => Promise<unknown[]>;
  /** Reject a candidate — same shape as ``promote`` with
   *  ``accept: false``. */
  reject: (c: Candidate) => Promise<unknown[]>;
}

export interface UseArtifactEvalConfig {
  artifact: string;
  /** Optional — only listen for events scoped to this run_id (the
   *  ``client_run_id`` the caller sent on the generate request). When
   *  omitted, every event for the artifact matches. */
  run_id?: string | null;
  /** Optional — caller's max-concurrent helper queue (default 4). */
  concurrency?: number;
  /** Per-agent — fires as each candidate completes. */
  onCandidate?: (c: Candidate, helpers: EvalHelpers) => void | Promise<void>;
  /** Aggregate — fires once when the pool is done. ``candidates`` is
   *  the full list (already includes everything onCandidate saw). */
  onCandidatesReady?: (
    candidates: Candidate[],
    helpers: EvalHelpers,
  ) => void | Promise<void>;
}

export interface UseArtifactEvalReturn {
  candidates: Candidate[];
  allReady: boolean;
  test_id: string | null;
  helpers: EvalHelpers;
}

type AnyEvent = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function candidateFromAgentEvent(ev: AnyEvent): Candidate | null {
  const agent_id = asString(ev["agent_id"]);
  const run_id = asString(ev["run_id"]);
  const group_id = asString(ev["group_id"]);
  if (!agent_id || !run_id || !group_id) return null;

  const invocation = (ev["invocation"] ?? null) as
    | { invocation_id?: string; rubric_id?: string | null }
    | null;

  return {
    agent_id,
    invocation_id: invocation?.invocation_id ?? null,
    rubric_id: invocation?.rubric_id ?? null,
    run_id,
    group_id,
    test_id: asString(ev["test_id"]),
    call_ids: asStringArray(ev["call_ids"]),
  };
}

function candidatesFromCompletedEvent(
  ev: AnyEvent,
  byAgentId: Map<string, Candidate>,
): Candidate[] {
  // The aggregate event carries the canonical invocations list via the
  // generate-response ``eval`` block. We join it against the per-agent
  // events we've already seen to recover the ``call_ids`` (those only
  // ride on the per-agent payload).
  const evalBlock = (ev["eval"] ?? null) as
    | { test_id?: string; invocations?: Array<Record<string, unknown>> }
    | null;
  if (!evalBlock?.invocations?.length) {
    return Array.from(byAgentId.values());
  }

  const run_id = asString(ev["run_id"]) ?? "";
  const group_id = asString(ev["group_id"]) ?? "";
  const test_id = evalBlock.test_id ?? null;

  return evalBlock.invocations.map((slot) => {
    const agent_id = asString(slot["agent_id"]) ?? "";
    const prior = byAgentId.get(agent_id);
    return {
      agent_id,
      invocation_id: asString(slot["invocation_id"]),
      rubric_id: asString(slot["rubric_id"]),
      run_id: prior?.run_id ?? run_id,
      group_id: prior?.group_id ?? group_id,
      test_id,
      call_ids: prior?.call_ids ?? [],
    };
  });
}

export function useArtifactEval(
  config: UseArtifactEvalConfig,
): UseArtifactEvalReturn {
  const {
    artifact,
    run_id: scopedRunId,
    onCandidate,
    onCandidatesReady,
  } = config;
  const transport = useTransport();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [allReady, setAllReady] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);

  // Always-fresh callback refs so the subscriptions don't tear down
  // whenever the caller hands us new closures.
  const onCandidateRef = useRef(onCandidate);
  const onCandidatesReadyRef = useRef(onCandidatesReady);
  onCandidateRef.current = onCandidate;
  onCandidatesReadyRef.current = onCandidatesReady;

  // Mirror of ``candidates`` for read access inside event handlers.
  // Lets us compute the final list without reading from a setState
  // updater (which React Strict Mode double-invokes, causing
  // duplicate side effects — see the offDone handler below).
  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;

  // ── Helpers ────────────────────────────────────────────────────
  const grade = useCallback(
    async (c: Candidate, args: GradeArgs = {}): Promise<unknown> => {
      if (!c.invocation_id) {
        throw new Error(
          "grade: candidate has no invocation_id — agent had no rubric",
        );
      }
      return transport.send("/test/grade", {
        invocation_id: c.invocation_id,
        run_id: args.run_id ?? c.run_id,
        ...(args.full ? { full: true } : { score: args.score ?? 0 }),
      });
    },
    [transport],
  );

  const ack = useCallback(
    async (c: Candidate, accept: boolean): Promise<unknown[]> => {
      if (c.call_ids.length === 0) return [];
      return Promise.all(
        c.call_ids.map((cid) =>
          transport.send(`/${artifact}/create`, {
            idempotency_key: cid,
            accept,
          }),
        ),
      );
    },
    [transport, artifact],
  );

  const promote = useCallback(
    (c: Candidate) => ack(c, true),
    [ack],
  );
  const reject = useCallback(
    (c: Candidate) => ack(c, false),
    [ack],
  );

  const helpers = useMemo<EvalHelpers>(
    () => ({ grade, promote, reject }),
    [grade, promote, reject],
  );

  // ── Subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    const offAgent = transport.on(
      `${artifact}.generate.agent_completed`,
      async (ev: AnyEvent) => {
        const eventRunId = asString(ev["run_id"]);
        if (scopedRunId && eventRunId !== scopedRunId) return;

        const c = candidateFromAgentEvent(ev);
        if (!c) return;

        const evTestId = asString(ev["test_id"]);
        if (evTestId) setTestId(evTestId);

        setCandidates((prev) => {
          // Dedupe by agent_id — if a stray event arrives twice, the
          // newer payload wins (more complete call_ids).
          const idx = prev.findIndex((p) => p.agent_id === c.agent_id);
          if (idx === -1) return [...prev, c];
          const next = [...prev];
          next[idx] = c;
          return next;
        });

        try {
          await onCandidateRef.current?.(c, helpers);
        } catch (err) {
          console.error("useArtifactEval.onCandidate handler threw:", err);
        }
      },
    );

    const offDone = transport.on(
      `${artifact}.generate.completed`,
      async (ev: AnyEvent) => {
        const eventRunId = asString(ev["run_id"]);
        if (scopedRunId && eventRunId !== scopedRunId) return;

        // Compute the canonical candidate list outside the setter so
        // the side effect (onCandidatesReady) doesn't fire from inside
        // a React state-updater. React Strict Mode (dev) double-invokes
        // updater fns for purity testing — when the side effect was
        // inline, ``promote(winner)`` ran twice, each spawning a
        // duplicate ``persona.create`` socket emit. Both racing emits
        // 404'd on the second lookup because the first had already
        // flipped the soft_call ledger to ``accepted``.
        const finalList = (() => {
          const byAgent = new Map(candidatesRef.current.map((c) => [c.agent_id, c]));
          return candidatesFromCompletedEvent(ev, byAgent);
        })();
        setCandidates(finalList);
        setAllReady(true);

        const evalBlock = (ev["eval"] ?? null) as
          | { test_id?: string }
          | null;
        const evalTestId = evalBlock?.test_id ?? null;
        if (evalTestId) setTestId(evalTestId);

        // No eval rubric was attached to this generation — there are
        // no candidates to grade / promote / reject, so don't invoke
        // the policy callback. Avoids spurious ``/<artifact>/create``
        // ack calls for runs the model produced with no soft writes
        // (titles, info lookups, etc.). The check is conservative: we
        // skip when neither the aggregate event nor any candidate
        // carries an eval id.
        const hasEval = !!evalTestId
          || finalList.some((c) => !!c.invocation_id);
        if (!hasEval) return;

        try {
          await onCandidatesReadyRef.current?.(finalList, helpers);
        } catch (err) {
          console.error(
            "useArtifactEval.onCandidatesReady handler threw:",
            err,
          );
        }
      },
    );

    return () => {
      offAgent();
      offDone();
    };
  }, [transport, artifact, scopedRunId, helpers]);

  return { candidates, allReady, test_id: testId, helpers };
}
