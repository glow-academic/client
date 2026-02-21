import { useCallback, useEffect, useRef } from "react";
import type { AppSocket } from "@/contexts/socket-context";
import type { ServerToClientEvents } from "@/lib/ws/types";

// Re-export event types for consumer convenience
export type TestStartedEvent =
  Parameters<ServerToClientEvents["test_started"]>[0];
export type TestRunStartEvent =
  Parameters<ServerToClientEvents["test_run_start"]>[0];
export type TestRunCompleteEvent =
  Parameters<ServerToClientEvents["test_run_complete"]>[0];
export type TestGradedEvent =
  Parameters<ServerToClientEvents["test_graded"]>[0];
export type TestAllCompleteEvent =
  Parameters<ServerToClientEvents["test_all_complete"]>[0];
export type TestStoppedEvent =
  Parameters<ServerToClientEvents["test_stopped"]>[0];
export type TestErrorEvent =
  Parameters<ServerToClientEvents["test_error"]>[0];

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

    socket.on("test_started", handleStarted);
    socket.on("test_run_start", handleRunStart);
    socket.on("test_run_complete", handleRunComplete);
    socket.on("test_graded", handleGraded);
    socket.on("test_all_complete", handleAllComplete);
    socket.on("test_stopped", handleStopped);
    socket.on("test_error", handleError);

    return () => {
      socket.off("test_started", handleStarted);
      socket.off("test_run_start", handleRunStart);
      socket.off("test_run_complete", handleRunComplete);
      socket.off("test_graded", handleGraded);
      socket.off("test_all_complete", handleAllComplete);
      socket.off("test_stopped", handleStopped);
      socket.off("test_error", handleError);
    };
  }, [socket, invocationId]);

  // --- Emission methods ---

  const startTest = useCallback(
    (evalId: string, opts?: { infiniteMode?: boolean }) => {
      if (!socket) return;
      socket.emit("test_start", {
        eval_id: evalId,
        infinite_mode: opts?.infiniteMode ?? false,
      });
    },
    [socket],
  );

  const nextTest = useCallback(
    (testId: string) => {
      if (!socket) return;
      socket.emit("test_next", {
        test_id: testId,
      });
    },
    [socket],
  );

  const runTest = useCallback(
    (invocationIdArg: string, testId: string) => {
      if (!socket) return;
      socket.emit("test_run", {
        invocation_id: invocationIdArg,
        test_id: testId,
      });
    },
    [socket],
  );

  const endTest = useCallback(
    (invocationIdArg: string, testId: string, runId: string) => {
      if (!socket) return;
      socket.emit("test_end", {
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
      socket.emit("test_stop", {
        invocation_id: invocationIdArg,
      });
    },
    [socket],
  );

  const joinRoom = useCallback(
    (invocationIdArg: string) => {
      if (!socket) return;
      socket.emit("test_join", {
        invocation_id: invocationIdArg,
      });
    },
    [socket],
  );

  const leaveRoom = useCallback(
    (invocationIdArg: string) => {
      if (!socket) return;
      socket.emit("test_leave", {
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
