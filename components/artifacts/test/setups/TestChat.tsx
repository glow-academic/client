/**
 * TestChat.tsx
 * Top-level orchestrator for the test chat interface.
 * Mirrors AttemptChat.tsx — manages state, socket hooks, and renders either
 * TestLobby or GenericChatInterface with pluggable test-specific components.
 */
"use client";

import { useTransport } from "@/lib/transport/context";
import { useTestLifecycle } from "@/hooks/use-test-lifecycle";
import type { OutputOf } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { GenericChatInterface } from "@/components/artifacts/attempt/chat/generic/GenericChatInterface";
import type { ChatHeaderProps } from "@/components/artifacts/attempt/chat/chatHeaders/AttemptChatHeader";

import { TestLobby } from "../TestLobby";
import { TestChatHeader } from "../chatHeaders/TestChatHeader";
import type { TestChatHeaderRunOption } from "../chatHeaders/TestChatHeader";
import {
  ModelHistoryView,
  type ModelHistoryViewProps,
} from "../chatAreas/ModelHistoryView";
import {
  ModelRubricView,
  type ModelRubricViewProps,
} from "../chatAreas/ModelRubricView";
import { RunSelector, type RunSelectorProps } from "../inputAreas/RunSelector";
import {
  ResourcePanel,
  type ResourcePanelProps,
  type AgentConfigFormState,
  EMPTY_AGENT_CONFIG,
} from "../documentAreas/ResourcePanel";

type TestArtifactOut = OutputOf<"/test/get", "post">;
type RunItem = NonNullable<TestArtifactOut["runs"]>[number];

type ChatAreaViewMode = "messages" | "rubric";

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
  const transport = useTransport();

  // ---- State ----
  const [runs, setRuns] = useState<RunItem[]>(test_data.runs || []);
  const [startingRunIds, setStartingRunIds] = useState<Set<string>>(new Set());
  const [stoppingRunIds, setStoppingRunIds] = useState<Set<string>>(new Set());
  const [showResources, setShowResources] = useState(false);
  const [isLobbyStarting, setIsLobbyStarting] = useState(false);

  // Agent-config form state for the right rail. Local-only for now —
  // server-side wiring (accepting these on /test/run) is a follow-up.
  const [formState, setFormState] = useState<AgentConfigFormState>(
    EMPTY_AGENT_CONFIG,
  );

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

  // ---- Multi-select run picker ----
  // Build the picker list from the test's runs. Each entry exposes a
  // human-readable label and the current status for the dot indicator.
  const runOptions = useMemo<TestChatHeaderRunOption[]>(
    () =>
      runs
        .filter((r): r is RunItem & { chat_id: string } => Boolean(r.chat_id))
        .map((r) => ({
          id: r.chat_id,
          label: `${r.agent_name || "Agent"}${r.run_id ? ` · ${r.run_id.substring(0, 8)}` : ""}`,
          status: r.status ?? "not_started",
        })),
    [runs],
  );

  // Selection defaults to all runs so the page renders something on first
  // load. Future-run inclusion: when new runs arrive, auto-include them.
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>(() =>
    runOptions.map((o) => o.id),
  );

  // Auto-include any newly-added run ids into the selection so freshly
  // spawned runs ("future" runs in the user's framing) appear in the
  // history view automatically.
  const seenRunIdsRef = useState(() => new Set(runOptions.map((o) => o.id)))[0];
  for (const o of runOptions) {
    if (!seenRunIdsRef.has(o.id)) {
      seenRunIdsRef.add(o.id);
      // Defer to next tick to avoid setState-during-render.
      queueMicrotask(() =>
        setSelectedRunIds((prev) =>
          prev.includes(o.id) ? prev : [...prev, o.id],
        ),
      );
    }
  }

  const filteredRuns = useMemo(() => {
    const set = new Set(selectedRunIds);
    return runs.filter((r) => r.chat_id && set.has(r.chat_id));
  }, [runs, selectedRunIds]);

  // Messages list — passed into ModelHistoryView for per-run transcript rendering.
  // Source: /test/get's entries.messages (already filtered server-side to runs in this test).
  const messages = useMemo(
    () => test_data.entries?.messages ?? [],
    [test_data.entries?.messages],
  );

  // Default view mode — flips to "rubric" once the test completes (Stop Test
  // → /test/complete → artifacts.test.completed). If the test loaded already
  // in a completed state, surface rubric view immediately.
  const [viewMode, setViewMode] = useState<ChatAreaViewMode>(() =>
    test_data.status === "completed" ? "rubric" : "messages",
  );

  // Grade entries + feedback for the rubric view (filtered to runs of the
  // selected model on render, but indexed once here).
  const grades = useMemo(
    () => test_data.entries?.grades ?? [],
    [test_data.entries?.grades],
  );
  const feedback = useMemo(
    () => test_data.entries?.feedback ?? [],
    [test_data.entries?.feedback],
  );

  // ---- Transport lifecycle ----
  const { runInvocation, stopInvocation } = useTestLifecycle({
    transport,
    invocationId,
    testId: test_id,
    onStarted: () => {
      setIsLobbyStarting(false);
      router.refresh();
    },
    onRunReplayStarted: (data) => {
      const runId = data["run_id"] as string | undefined;
      const dataInvocationId = data["invocation_id"] as string | undefined;
      if (runId) {
        setStartingRunIds((prev) => {
          const next = new Set(prev);
          next.delete(runId);
          return next;
        });
      }
      setRuns(
        (prevRuns) =>
          prevRuns.map((run) =>
            run.chat_id === dataInvocationId
              ? { ...run, status: "in_progress" as const }
              : run,
          ) as RunItem[],
      );
    },
    onRunReplayCompleted: (data) => {
      const dataInvocationId = data["invocation_id"] as string | undefined;
      setRuns(
        (prevRuns) =>
          prevRuns.map((run) =>
            run.chat_id === dataInvocationId
              ? { ...run, status: "completed" as const }
              : run,
          ) as RunItem[],
      );
    },
    onInvocationCompleted: () => {
      toast.success("All test runs complete!");
    },
    onCompleted: () => {
      toast.success("Test complete — switching to graded view.");
      setViewMode("rubric");
      router.refresh();
    },
    onInvocationStopped: (data) => {
      const success = (data["success"] as boolean | undefined) ?? true;
      const message = data["message"] as string | undefined;
      const dataInvocationId = data["invocation_id"] as string | undefined;
      setStoppingRunIds(new Set());
      if (success) {
        setRuns(
          (prevRuns) =>
            prevRuns.map((run) =>
              run.chat_id === dataInvocationId
                ? { ...run, status: "not_started" as const }
                : run,
            ) as RunItem[],
        );
        toast.success(message || "Test stopped.");
      } else {
        toast.error(message || "Failed to stop test.");
      }
    },
    onError: (data) => {
      setStartingRunIds(new Set());
      setStoppingRunIds(new Set());
      setIsLobbyStarting(false);
      const message = data["message"] as string | undefined;
      if (message) toast.error(message);
    },
  });

  // ---- Handlers ----
  const handleStartRun = useCallback(
    (runInvocationId: string) => {
      const targetRun = runs.find((r) => r.chat_id === runInvocationId);
      const runId = targetRun?.run_id;
      if (!runId) {
        toast.error("Cannot start run: missing run_id");
        return;
      }
      setStartingRunIds((prev) => new Set(prev).add(runId));
      runInvocation({ testId: test_id, invocationId: runInvocationId, runId });
    },
    [runs, test_id, runInvocation],
  );

  const handleStopRun = useCallback(
    (runInvocationId: string) => {
      setStoppingRunIds((prev) => new Set(prev).add(runInvocationId));
      stopInvocation(runInvocationId);
    },
    [stopInvocation],
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
    setIsLobbyStarting(true);
    handleStartAll();
  }, [handleStartAll]);

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
        is_connected={true}
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
    runs: runOptions,
    selected_run_ids: selectedRunIds,
    on_select_runs: (ids: string[]) => setSelectedRunIds(ids),
  };

  const historyAreaProps: ModelHistoryViewProps = {
    runs: filteredRuns,
    messages,
    starting_run_ids: startingRunIds,
    stopping_run_ids: stoppingRunIds,
    on_stop_run: handleStopRun,
    is_connected: true,
  };

  const rubricAreaProps: ModelRubricViewProps = {
    runs: filteredRuns,
    grades,
    feedback,
  };

  const handleRunSelected = useCallback(
    (extra_instructions: string) => {
      // Fan out: start every selected run that's currently stoppable. The
      // textarea contents are tracked alongside the agent-config form state
      // for now — server-side run override wiring lands in a follow-up.
      void extra_instructions;
      const targets = filteredRuns.filter(
        (r) => r.status === "not_started" && r.chat_id,
      );
      for (const r of targets) handleStartRun(r.chat_id!);
    },
    [filteredRuns, handleStartRun],
  );

  const isAnySelectedStarting = useMemo(() => {
    if (startingRunIds.size === 0) return false;
    for (const r of filteredRuns) {
      if (r.run_id && startingRunIds.has(r.run_id)) return true;
    }
    return false;
  }, [filteredRuns, startingRunIds]);

  const inputAreaProps: RunSelectorProps = {
    is_starting: isAnySelectedStarting,
    has_selection: filteredRuns.some(
      (r) => r.status === "not_started" && r.chat_id,
    ),
    on_run: handleRunSelected,
    is_connected: true,
  };

  const documentAreaProps: ResourcePanelProps = {
    visible: showResources,
    form_state: formState,
    on_form_change: setFormState,
    tools: test_data.resources?.tools ?? null,
    qualities: test_data.resources?.qualities ?? null,
    modalities: test_data.resources?.modalities ?? null,
    reasoning_levels: test_data.resources?.reasoning_levels ?? null,
  };

  return (
    <GenericChatInterface
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chat_header={TestChatHeader as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chat_area={
        viewMode === "rubric"
          ? (ModelRubricView as any)
          : (ModelHistoryView as any)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input_area={RunSelector as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      document_area={ResourcePanel as any}
      chat_area_view_mode={viewMode === "rubric" ? "rubric" : "messages"}
      show_documents={showResources}
      on_send_message={() => {}}
      on_stop_message={() => {}}
      chat_header_props={chatHeaderProps as ChatHeaderProps}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chat_area_props={
        viewMode === "rubric"
          ? (rubricAreaProps as any)
          : (historyAreaProps as any)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input_area_props={inputAreaProps as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      document_area_props={documentAreaProps as any}
    />
  );
}
