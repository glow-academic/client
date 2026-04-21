import { useCallback, useEffect, useRef } from "react";
import type { AppSocket } from "@/contexts/socket-context";
import type { ServerToClientEvents } from "@/lib/ws/types";

// Re-export event types for consumer convenience
export type TestStartedEvent =
  Parameters<ServerToClientEvents["test.start.completed"]>[0];
export type TestRunStartEvent =
  Parameters<ServerToClientEvents["test_run_start"]>[0];
export type TestRunCompleteEvent =
  Parameters<ServerToClientEvents["test.run.completed"]>[0];
export type TestGradedEvent =
  Parameters<ServerToClientEvents["test_graded"]>[0];
export type TestAllCompleteEvent =
  Parameters<ServerToClientEvents["test_all_complete"]>[0];
export type TestStoppedEvent =
  Parameters<ServerToClientEvents["test.stop.completed"]>[0];
export type TestErrorEvent =
  Parameters<ServerToClientEvents["test.run.error"]>[0];

interface UseTestLifecycleConfig {
  socket: AppSocket | null;
  invocationId?: string | null;
  onStarted?: (data: TestStartedEvent) => void;
  onRunStart?: (data: TestRunStartEvent) => void;
  onRunComplete?: (data: TestRunCompleteEvent) => void;
  onGraded?: (data: TestGradedEvent) => void;
  onAllComplete?: (data: TestAllCompleteEvent) => void;
  onStopped?: (data: TestStoppedEvent) => void;
  onError?: (data: TestErrorEvent) => void;
}

export interface UseTestLifecycleReturn {
  startTest: (evalId: string, opts?: { infiniteMode?: boolean }) => void;
  nextTest: (testId: string) => void;
  runTest: (invocationId: string, testId: string) => void;
  endTest: (invocationId: string, testId: string, runId: string) => void;
  stopTest: (invocationId: string) => void;
  joinRoom: (invocationId: string) => void;
  leaveRoom: (invocationId: string) => void;
}

export function useTestLifecycle({
  socket,
  invocationId,
  onStarted,
  onRunStart,
  onRunComplete,
  onGraded,
  onAllComplete,
  onStopped,
  onError,
}: UseTestLifecycleConfig): UseTestLifecycleReturn {
  // Store callbacks in refs to avoid re-registering socket listeners on every render
  const callbacksRef = useRef({
    onStarted,
    onRunStart,
    onRunComplete,
    onGraded,
    onAllComplete,
    onStopped,
    onError,
  });

  // Update refs on every render
  callbacksRef.current = {
    onStarted,
    onRunStart,
    onRunComplete,
    onGraded,
    onAllComplete,
    onStopped,
    onError,
  };

  useEffect(() => {
    if (!socket) return;

    const handleStarted = (data: TestStartedEvent) => {
      callbacksRef.current.onStarted?.(data);
    };

    const handleRunStart = (data: TestRunStartEvent) => {
      if (invocationId && data.invocation_id !== invocationId) return;
      callbacksRef.current.onRunStart?.(data);
    };

    const handleRunComplete = (data: TestRunCompleteEvent) => {
      if (invocationId && data.invocation_id !== invocationId) return;
      callbacksRef.current.onRunComplete?.(data);
    };

    const handleGraded = (data: TestGradedEvent) => {
      if (invocationId && data.invocation_id !== invocationId) return;
      callbacksRef.current.onGraded?.(data);
    };

    const handleAllComplete = (data: TestAllCompleteEvent) => {
      if (invocationId && data.invocation_id !== invocationId) return;
      callbacksRef.current.onAllComplete?.(data);
    };

    const handleStopped = (data: TestStoppedEvent) => {
      if (invocationId && data.invocation_id !== invocationId) return;
      callbacksRef.current.onStopped?.(data);
    };

    const handleError = (data: TestErrorEvent) => {
      callbacksRef.current.onError?.(data);
    };

    socket.on("test.start.completed", handleStarted);
    socket.on("test_run_start", handleRunStart);
    socket.on("test.run.completed", handleRunComplete);
    socket.on("test_graded", handleGraded);
    socket.on("test_all_complete", handleAllComplete);
    socket.on("test.stop.completed", handleStopped);
    // Subscribe to every per-operation error — server-side errors are now scoped.
    socket.on("test.start.error", handleError);
    socket.on("test.stop.error", handleError);
    socket.on("test.end.error", handleError);
    socket.on("test.end_all.error", handleError);
    socket.on("test.join.error", handleError);
    socket.on("test.next.error", handleError);
    socket.on("test.run.error", handleError);
    socket.on("test.group.error", handleError);
    socket.on("test.proceed.error", handleError);

    return () => {
      socket.off("test.start.completed", handleStarted);
      socket.off("test_run_start", handleRunStart);
      socket.off("test.run.completed", handleRunComplete);
      socket.off("test_graded", handleGraded);
      socket.off("test_all_complete", handleAllComplete);
      socket.off("test.stop.completed", handleStopped);
      socket.off("test.start.error", handleError);
      socket.off("test.stop.error", handleError);
      socket.off("test.end.error", handleError);
      socket.off("test.end_all.error", handleError);
      socket.off("test.join.error", handleError);
      socket.off("test.next.error", handleError);
      socket.off("test.run.error", handleError);
      socket.off("test.group.error", handleError);
      socket.off("test.proceed.error", handleError);
    };
  }, [socket, invocationId]);

  // --- Emission methods ---

  const startTest = useCallback(
    (evalId: string, opts?: { infiniteMode?: boolean }) => {
      if (!socket) return;
      socket.emit("test.start", {
        eval_id: evalId,
        infinite_mode: opts?.infiniteMode ?? false,
      });
    },
    [socket],
  );

  const nextTest = useCallback(
    (testId: string) => {
      if (!socket) return;
      socket.emit("test.next", {
        test_id: testId,
      });
    },
    [socket],
  );

  const runTest = useCallback(
    (invocationIdArg: string, testId: string) => {
      if (!socket) return;
      socket.emit("test.run", {
        invocation_id: invocationIdArg,
        test_id: testId,
      });
    },
    [socket],
  );

  const endTest = useCallback(
    (invocationIdArg: string, testId: string, runId: string) => {
      if (!socket) return;
      socket.emit("test.end", {
        invocation_id: invocationIdArg,
        test_id: testId,
        run_id: runId,
      });
    },
    [socket],
  );

  const stopTest = useCallback(
    (invocationIdArg: string) => {
      if (!socket) return;
      socket.emit("test.stop", {
        invocation_id: invocationIdArg,
      });
    },
    [socket],
  );

  const joinRoom = useCallback(
    (invocationIdArg: string) => {
      if (!socket) return;
      socket.emit("test.join", {
        invocation_id: invocationIdArg,
      });
    },
    [socket],
  );

  const leaveRoom = useCallback(
    (invocationIdArg: string) => {
      if (!socket) return;
      socket.emit("test.leave", {
        invocation_id: invocationIdArg,
      });
    },
    [socket],
  );

  return {
    startTest,
    nextTest,
    runTest,
    endTest,
    stopTest,
    joinRoom,
    leaveRoom,
  };
}
