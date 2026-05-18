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
 * Canonical event names (server → client):
 *   artifacts.test.started
 *   artifacts.test.invocation.started
 *   artifacts.test.invocation.completed
 *   artifacts.test.invocation.stopped
 *   artifacts.test.invocation.response.saved
 *   artifacts.test.run.replay_started   (per-run replay inside an invocation)
 *   artifacts.test.run.progress         (grade/run progress deltas)
 *   artifacts.test.run.replay_completed
 *   artifacts.test.completed            (whole test completed)
 *   artifacts.test.start.failed         (canonical lifecycle error fan-in)
 *   artifacts.test.run.failed
 *   artifacts.test.complete.failed
 *   artifacts.test.invocation_complete.failed
 *   artifacts.test.stop.failed
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
      return data["invocation_id"] === filterId;
    };

    const matchTest = (data: Record<string, unknown>) => {
      if (!testId) return true;
      return data["test_id"] === testId;
    };

    const handleStarted = (data: TestStartedEvent) => {
      if (!matchTest(data)) return;
      callbacksRef.current.onStarted?.(data);
    };

    const handleInvocationStarted = (data: TestInvocationStartedEvent) => {
      if (!matchTest(data)) return;
      callbacksRef.current.onInvocationStarted?.(data);
    };

    const handleInvocationCompleted = (data: TestInvocationEndedEvent) => {
      if (!matchInvocation(data)) return;
      callbacksRef.current.onInvocationCompleted?.(data);
    };

    const handleInvocationStopped = (data: TestInvocationStoppedEvent) => {
      if (!matchInvocation(data)) return;
      callbacksRef.current.onInvocationStopped?.(data);
    };

    const handleInvocationResponseSaved = (
      data: TestInvocationResponseSavedEvent,
    ) => {
      if (!matchInvocation(data)) return;
      callbacksRef.current.onInvocationResponseSaved?.(data);
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
      transport.on("artifacts.test.started", handleStarted, scope),
      transport.on("artifacts.test.invocation.started", handleInvocationStarted, scope),
      transport.on("artifacts.test.invocation.completed", handleInvocationCompleted, scope),
      transport.on("artifacts.test.invocation.stopped", handleInvocationStopped, scope),
      transport.on(
        "artifacts.test.invocation.response.saved",
        handleInvocationResponseSaved,
        scope,
      ),
      transport.on("artifacts.test.run.replay_started", handleRunReplayStarted, scope),
      transport.on("artifacts.test.run.progress", handleRunProgress, scope),
      transport.on("artifacts.test.run.replay_completed", handleRunReplayCompleted, scope),
      transport.on("artifacts.test.completed", handleCompleted, scope),
      // Canonical lifecycle error fan-in — every operation's `failed` phase.
      transport.on("artifacts.test.start.failed", handleError, scope),
      transport.on("artifacts.test.run.failed", handleError, scope),
      transport.on("artifacts.test.complete.failed", handleError, scope),
      transport.on("artifacts.test.invocation_complete.failed", handleError, scope),
      transport.on("artifacts.test.stop.failed", handleError, scope),
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
