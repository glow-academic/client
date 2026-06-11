/**
 * useTestLifecycle — transport-based subscription to canonical test events.
 *
 * Mirrors useAttemptLifecycle. Subscribes to the per-(artifact, group_id)
 * SSE stream via the canonical Transport abstraction — never raw socket.
 *
 * Domain mapping (test ↔ attempt):
 *   test_id           ↔ attempt_id
 *   test_invocation   ↔ attempt_chat   (chat-equivalent container)
 *   test_run          ↔ chat replay turn
 *
 * Canonical event names (server → client), verified against the API's
 * ACTUAL emits — `core/app/infra/test/workflows.py` (the live grade/run
 * workflow) plus the audit lifecycle wrapper in
 * `core/app/infra/events/audit.py`. There is NO `artifacts.` prefix on the
 * wire; names are bare `{artifact}.{operation}.{phase}` (matching the
 * working attempt subscriptions) plus a couple of legacy domain names:
 *   test.start.completed                 (test + first invocation created)
 *   test.grade.started                   (a run began grading → in-progress)
 *   test.grade.progress                  (grade score/feedback delta)
 *   test.run.completed                   (a run finished)
 *   test.invocation_complete.completed   (an invocation finished)
 *   test.stop.completed                  (invocation stopped)
 *   test.complete.completed / test_all_complete  (whole test completed)
 *   test.{start,end,next,group}.error  +  test.{run,start,complete,
 *     invocation_complete,stop}.failed   (error fan-in)
 *
 * NOTE: the old `artifacts.test.*` / `test.run.replay_*` / `test.invocation.*`
 * domain names this hook used to subscribe to are NEVER emitted by the API
 * (the run/start/complete ops set `project_domain_from_audit=False`, so their
 * declared domain_events are not projected, and nothing emits them live) —
 * which is why run chips never flipped, stop spinners never cleared and the
 * "test complete" toast never fired.
 */
import { useCallback, useEffect, useRef } from "react";
import type { Transport } from "@/lib/transport/types";
import { useGroupIdOptional } from "@/contexts/group-context";

// Loose payload types — the transport delivers Record<string, unknown>.
export type TestStartedEvent = Record<string, unknown>;
export type TestInvocationStartedEvent = Record<string, unknown>;
export type TestInvocationEndedEvent = Record<string, unknown>;
export type TestInvocationStoppedEvent = Record<string, unknown>;
export type TestInvocationResponseSavedEvent = Record<string, unknown>;
export type TestRunReplayStartedEvent = Record<string, unknown>;
export type TestRunProgressEvent = Record<string, unknown>;
export type TestRunReplayCompletedEvent = Record<string, unknown>;
export type TestEndedEvent = Record<string, unknown>;
export type TestErrorEvent = Record<string, unknown>;

interface UseTestLifecycleConfig {
  transport: Transport;
  /** Filter invocation-scoped events to a specific invocation. */
  invocationId?: string | null;
  invocationIdRef?: React.RefObject<string | null>;
  /** Filter test-scoped events to a specific test. */
  testId?: string | null;
  /**
   * Group id this test is scoped to. Used for SSE subscription routing —
   * `/test/watch?group_id=…`. Falls back to GroupProviderClient context.
   */
  groupId?: string | null;
  onStarted?: (data: TestStartedEvent) => void;
  onInvocationStarted?: (data: TestInvocationStartedEvent) => void;
  onInvocationCompleted?: (data: TestInvocationEndedEvent) => void;
  onInvocationStopped?: (data: TestInvocationStoppedEvent) => void;
  onInvocationResponseSaved?: (data: TestInvocationResponseSavedEvent) => void;
  onRunReplayStarted?: (data: TestRunReplayStartedEvent) => void;
  onRunProgress?: (data: TestRunProgressEvent) => void;
  onRunReplayCompleted?: (data: TestRunReplayCompletedEvent) => void;
  onCompleted?: (data: TestEndedEvent) => void;
  onError?: (data: TestErrorEvent) => void;
}

export interface UseTestLifecycleReturn {
  startTest: (opts: { evalId: string; infiniteMode?: boolean }) => void;
  stopInvocation: (invocationId: string) => void;
  completeInvocation: (params: {
    testId: string;
    invocationId: string;
    message?: string;
  }) => void;
  completeTest: (testId: string) => void;
  nextInvocation: (testId: string) => void;
  runInvocation: (params: {
    testId: string;
    invocationId: string;
    runId: string;
  }) => void;
}

export function useTestLifecycle({
  transport,
  invocationId,
  invocationIdRef,
  testId,
  groupId: groupIdProp,
  onStarted,
  onInvocationStarted,
  onInvocationCompleted,
  onInvocationStopped,
  onInvocationResponseSaved,
  onRunReplayStarted,
  onRunProgress,
  onRunReplayCompleted,
  onCompleted,
  onError,
}: UseTestLifecycleConfig): UseTestLifecycleReturn {
  const groupCtx = useGroupIdOptional();
  const groupId = groupIdProp ?? groupCtx?.groupId ?? null;

  const callbacksRef = useRef({
    onStarted,
    onInvocationStarted,
    onInvocationCompleted,
    onInvocationStopped,
    onInvocationResponseSaved,
    onRunReplayStarted,
    onRunProgress,
    onRunReplayCompleted,
    onCompleted,
    onError,
  });

  callbacksRef.current = {
    onStarted,
    onInvocationStarted,
    onInvocationCompleted,
    onInvocationStopped,
    onInvocationResponseSaved,
    onRunReplayStarted,
    onRunProgress,
    onRunReplayCompleted,
    onCompleted,
    onError,
  };

  useEffect(() => {
    const matchInvocation = (data: Record<string, unknown>) => {
      const filterId = invocationIdRef?.current ?? invocationId;
      if (!filterId) return true;
      // Terminal events such as `test_all_complete` omit `invocation_id`;
      // don't filter those out (the SSE/WS stream is already group-scoped).
      const inv = data["invocation_id"];
      if (inv === undefined || inv === null) return true;
      return inv === filterId;
    };

    const matchTest = (data: Record<string, unknown>) => {
      if (!testId) return true;
      // Most lifecycle/domain events don't echo `test_id`; only filter when
      // the payload actually carries it.
      const t = data["test_id"];
      if (t === undefined || t === null) return true;
      return t === testId;
    };

    const handleStarted = (data: TestStartedEvent) => {
      if (!matchTest(data)) return;
      callbacksRef.current.onStarted?.(data);
    };

    const handleInvocationCompleted = (data: TestInvocationEndedEvent) => {
      if (!matchInvocation(data)) return;
      callbacksRef.current.onInvocationCompleted?.(data);
    };

    const handleInvocationStopped = (data: TestInvocationStoppedEvent) => {
      if (!matchInvocation(data)) return;
      callbacksRef.current.onInvocationStopped?.(data);
    };

    const handleRunReplayStarted = (data: TestRunReplayStartedEvent) => {
      if (!matchInvocation(data)) return;
      callbacksRef.current.onRunReplayStarted?.(data);
    };

    const handleRunProgress = (data: TestRunProgressEvent) => {
      if (!matchInvocation(data)) return;
      callbacksRef.current.onRunProgress?.(data);
    };

    const handleRunReplayCompleted = (data: TestRunReplayCompletedEvent) => {
      if (!matchInvocation(data)) return;
      callbacksRef.current.onRunReplayCompleted?.(data);
    };

    const handleCompleted = (data: TestEndedEvent) => {
      if (!matchTest(data)) return;
      callbacksRef.current.onCompleted?.(data);
    };

    const handleError = (data: TestErrorEvent) => {
      callbacksRef.current.onError?.(data);
    };

    const scope = groupId ? { groupId } : undefined;
    const unsubs = [
      // Test + first invocation materialized (audit lifecycle of `start`).
      transport.on("test.start.completed", handleStarted, scope),
      // A run began grading → flip the chip to in-progress + clear its
      // "starting" spinner. `test.grade.started` carries invocation_id + run_id.
      transport.on("test.grade.started", handleRunReplayStarted, scope),
      // Per-run grade score/feedback delta.
      transport.on("test.grade.progress", handleRunProgress, scope),
      // A run finished → flip the chip to completed.
      transport.on("test.run.completed", handleRunReplayCompleted, scope),
      // An invocation finished (audit lifecycle of `invocation_complete`).
      transport.on("test.invocation_complete.completed", handleInvocationCompleted, scope),
      // Invocation stopped (audit lifecycle of `stop`; carries success/message).
      transport.on("test.stop.completed", handleInvocationStopped, scope),
      // Whole test complete — two paths: user-triggered `/test/complete`
      // (namespaced, SSE-safe) and the workflow's auto-finish `test_all_complete`.
      transport.on("test.complete.completed", handleCompleted, scope),
      transport.on("test_all_complete", handleCompleted, scope),
      // Error fan-in — both the workflow's domain errors and the audit
      // lifecycle `failed` phases. All carry a `message`.
      transport.on("test.start.error", handleError, scope),
      transport.on("test.end.error", handleError, scope),
      transport.on("test.next.error", handleError, scope),
      transport.on("test.group.error", handleError, scope),
      transport.on("test.run.failed", handleError, scope),
      transport.on("test.start.failed", handleError, scope),
      transport.on("test.complete.failed", handleError, scope),
      transport.on("test.invocation_complete.failed", handleError, scope),
      transport.on("test.stop.failed", handleError, scope),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [transport, invocationId, invocationIdRef, testId, groupId]);

  // --- Emission methods ---

  const startTest = useCallback(
    (opts: { evalId: string; infiniteMode?: boolean }) => {
      transport.send("/test/start", {
        eval_id: opts.evalId,
        infinite_mode: opts.infiniteMode ?? false,
      });
    },
    [transport],
  );

  const stopInvocation = useCallback(
    (invocationIdArg: string) => {
      transport.send("/test/stop", { invocation_id: invocationIdArg });
    },
    [transport],
  );

  const completeInvocation = useCallback(
    (params: {
      testId: string;
      invocationId: string;
      message?: string;
    }) => {
      transport.send("/test/invocation_complete", {
        test_id: params.testId,
        test_invocation_id: params.invocationId,
        ...(params.message !== undefined && { message: params.message }),
      });
    },
    [transport],
  );

  const completeTest = useCallback(
    (testIdArg: string) => {
      transport.send("/test/complete", { test_id: testIdArg });
    },
    [transport],
  );

  const nextInvocation = useCallback(
    (testIdArg: string) => {
      transport.send("/test/next", { test_id: testIdArg });
    },
    [transport],
  );

  const runInvocation = useCallback(
    (params: { testId: string; invocationId: string; runId: string }) => {
      transport.send("/test/invocation_run", {
        test_id: params.testId,
        test_invocation_id: params.invocationId,
        run_id: params.runId,
      });
    },
    [transport],
  );

  return {
    startTest,
    stopInvocation,
    completeInvocation,
    completeTest,
    nextInvocation,
    runInvocation,
  };
}
