/**
 * TestChat.tsx
 * Top-level orchestrator for the test chat interface.
 * Mirrors AttemptChat.tsx — manages state, socket hooks, and renders either
 * TestLobby or GenericChatInterface with pluggable test-specific components.
 */
"use client";

import { useSocket } from "@/contexts/socket-context";
import { useTestLifecycle } from "@/hooks/use-test-lifecycle";
import type { OutputOf } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GenericChatInterface } from "@/components/artifacts/attempt/chat/generic/GenericChatInterface";
import type { ChatHeaderProps } from "@/components/artifacts/attempt/chat/chatHeaders/AttemptChatHeader";

import { TestLobby } from "../TestLobby";
import { TestChatHeader } from "../chatHeaders/TestChatHeader";
import { RunFeedView, type RunFeedViewProps } from "../chatAreas/RunFeedView";
import { RunSelector, type RunSelectorProps } from "../inputAreas/RunSelector";
import {
  ResourcePanel,
  type ResourcePanelProps,
  type BenchmarkBundleFormState,
} from "../documentAreas/ResourcePanel";

type TestArtifactOut = OutputOf<"/api/v4/artifacts/test/get", "post">;
type RunItem = NonNullable<TestArtifactOut["runs"]>[number];

export interface TestChatProps {
  test_id: string;
  test_data: TestArtifactOut;
  draft_id?: string | null;
}

export default function TestChat({
  test_id,
  test_data,
  // draft_id reserved for future autosave wiring
}: TestChatProps) {
  const router = useRouter();
  const { socket, isConnected } = useSocket();

  // ---- State ----
  const [runs, setRuns] = useState<RunItem[]>(test_data.runs || []);
  const [startingRunIds, setStartingRunIds] = useState<Set<string>>(new Set());
  const [stoppingRunIds, setStoppingRunIds] = useState<Set<string>>(new Set());
  const [showResources, setShowResources] = useState(false);
  const [isLobbyStarting, setIsLobbyStarting] = useState(false);

  // Resource panel form state (placeholder — no autosave wiring yet)
  const [formState, setFormState] = useState<BenchmarkBundleFormState>({
    department_ids: [],
    model_ids: [],
    prompt_ids: [],
    instruction_ids: [],
    voice_ids: [],
    temperature_level_ids: [],
    reasoning_level_ids: [],
    tool_ids: [],
    key_ids: [],
  });

  // Derive invocation ID from first run
  const invocationId = useMemo(() => {
    const firstRun = runs[0];
    return firstRun?.chat_id ?? null;
  }, [runs]);

  // Status summary
  const statusSummary = useMemo(
    () =>
      test_data.status_summary ?? {
        total: runs.length,
        completed: runs.filter((r) => r.status === "completed").length,
        in_progress: runs.filter((r) => r.status === "in_progress").length,
        not_started: runs.filter((r) => r.status === "not_started").length,
      },
    [test_data.status_summary, runs],
  );

  // Is this in lobby state? (pending status and no runs in progress/completed)
  const isLobby =
    test_data.status === "pending" &&
    runs.every((r) => r.status === "not_started");

  // ---- Socket lifecycle ----
  const {
    runTest,
    stopTest,
    joinRoom,
    leaveRoom,
  } = useTestLifecycle({
    socket,
    invocationId,
    onStarted: () => {
      setIsLobbyStarting(false);
      router.refresh();
    },
    onRunStart: (data) => {
      setStartingRunIds((prev) => {
        const next = new Set(prev);
        next.delete(data.run_id);
        return next;
      });
      setRuns((prevRuns) =>
        prevRuns.map((run) =>
          run.chat_id === data.invocation_id
            ? { ...run, status: "in_progress" as const }
            : run,
        ) as RunItem[],
      );
    },
    onRunComplete: (data) => {
      setRuns((prevRuns) =>
        prevRuns.map((run) =>
          run.chat_id === data.invocation_id
            ? { ...run, status: "completed" as const }
            : run,
        ) as RunItem[],
      );
    },
    onGraded: (data) => {
      setRuns((prevRuns) =>
        prevRuns.map((run) =>
          run.chat_id === data.invocation_id
            ? {
                ...run,
                grade_score: data.score ?? run.grade_score,
                grade_passed: data.passed ?? run.grade_passed,
              }
            : run,
        ) as RunItem[],
      );
    },
    onAllComplete: () => {
      toast.success("All test runs complete!");
    },
    onStopped: (data) => {
      setStoppingRunIds(new Set());
      if (data.success) {
        setRuns((prevRuns) =>
          prevRuns.map((run) =>
            run.chat_id === data.invocation_id
              ? { ...run, status: "not_started" as const }
              : run,
          ) as RunItem[],
        );
        toast.success(data.message || "Test stopped.");
      } else {
        toast.error(data.message || "Failed to stop test.");
      }
    },
    onError: (data) => {
      setStartingRunIds(new Set());
      setStoppingRunIds(new Set());
      setIsLobbyStarting(false);
      toast.error(data.message);
    },
  });

  // Join/leave room
  useEffect(() => {
    if (!socket || !isConnected || !invocationId) return;
    joinRoom(invocationId);
    return () => {
      leaveRoom(invocationId);
    };
  }, [socket, isConnected, invocationId, joinRoom, leaveRoom]);

  // ---- Handlers ----
  const handleStartRun = useCallback(
    (runInvocationId: string) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected. Please wait for connection.");
        return;
      }
      setStartingRunIds((prev) => new Set(prev).add(runInvocationId));
      runTest(runInvocationId, test_id);
    },
    [socket, isConnected, test_id, runTest],
  );

  const handleStopRun = useCallback(
    (runInvocationId: string) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected. Please wait for connection.");
        return;
      }
      setStoppingRunIds((prev) => new Set(prev).add(runInvocationId));
      stopTest(runInvocationId);
    },
    [socket, isConnected, stopTest],
  );

  const handleStartAll = useCallback(() => {
    const runnableRuns = runs.filter(
      (r) => r.status === "not_started" && r.chat_id,
    );
    for (const run of runnableRuns) {
      handleStartRun(run.chat_id!);
    }
  }, [runs, handleStartRun]);

  const handleLobbyStart = useCallback(() => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please wait for connection.");
      return;
    }
    setIsLobbyStarting(true);
    handleStartAll();
  }, [socket, isConnected, handleStartAll]);

  // ---- Lobby rendering ----
  if (isLobby) {
    return (
      <TestLobby
        test_id={test_id}
        eval_name={test_data.eval_name ?? null}
        eval_description={test_data.eval_description ?? null}
        rubric_name={test_data.rubric_name ?? null}
        infinite_mode={test_data.infinite_mode}
        on_start={handleLobbyStart}
        is_starting={isLobbyStarting}
        is_connected={isConnected}
      />
    );
  }

  // ---- Build props for GenericChatInterface ----

  const chatHeaderProps = {
    show_documents: showResources,
    show_objectives: false,
    show_rubric: false,
    has_documents: true,
    on_toggle_documents: (show: boolean) => setShowResources(show),
    on_toggle_objectives: () => {},
    on_toggle_rubric: () => {},
    eval_name: test_data.eval_name ?? null,
    status_summary: statusSummary,
  };

  const chatAreaProps: RunFeedViewProps = {
    runs,
    starting_run_ids: startingRunIds,
    stopping_run_ids: stoppingRunIds,
    on_start_run: handleStartRun,
    on_stop_run: handleStopRun,
    is_connected: isConnected,
  };

  const inputAreaProps: RunSelectorProps = {
    runs,
    starting_run_ids: startingRunIds,
    on_start_run: handleStartRun,
    on_start_all: handleStartAll,
    is_connected: isConnected,
  };

  const documentAreaProps: ResourcePanelProps = {
    visible: showResources,
    bundle_data: null,
    form_state: formState,
    on_form_change: setFormState,
  };

  return (
    <GenericChatInterface
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chat_header={TestChatHeader as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chat_area={RunFeedView as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input_area={RunSelector as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      document_area={ResourcePanel as any}
      chat_area_view_mode="messages"
      show_documents={showResources}
      on_send_message={() => {}}
      on_stop_message={() => {}}
      chat_header_props={chatHeaderProps as ChatHeaderProps}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chat_area_props={chatAreaProps as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input_area_props={inputAreaProps as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      document_area_props={documentAreaProps as any}
    />
  );
}
