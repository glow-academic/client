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
import { useTestRun } from "@/hooks/use-test-run";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
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

  // Invocation id = the benchmark template invocation. Server emits it
  // as `current_invocation_id` on /test/get; using it lets us fire runs
  // even when the history list is empty (fresh tests have no bindings,
  // so we can't piggy-back the id off runs[0] anymore).
  const invocationId = useMemo(
    () =>
      test_data.current_invocation_id ??
      test_data.next_invocation_id ??
      test_data.invocations?.[0]?.invocation_id ??
      null,
    [
      test_data.current_invocation_id,
      test_data.next_invocation_id,
      test_data.invocations,
    ],
  );

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
  // Picker (bottom composer) source = reusable run configs from
  // `test_data.configs`, NOT history binding rows. Each config can be
  // queued any number of times to fire fresh trace+run executions.
  // Selection key = config.run_id (the runs_entry.id of the config row).
  // Cast: server emits `configs/configs_groups/configs_total` but the
  // openapi codegen may not have regenerated yet.
  type ServerConfig = {
    run_id: string;
    group_id?: string | null;
    label: string;
    agent_name?: string | null;
    model_name?: string | null;
    prompt_ids?: string[];
    tool_ids?: string[];
    instruction_ids?: string[];
  };
  type ServerConfigGroup = {
    group_id: string;
    name?: string | null;
    run_count: number;
    last_run_at?: string | null;
  };
  type ServerConfigShape = {
    configs?: ServerConfig[];
    configs_groups?: ServerConfigGroup[];
    configs_total?: number;
    configs_groups_total?: number;
    configs_per_group_total?: Record<string, number>;
  };
  const serverShape = test_data as unknown as ServerConfigShape;
  const configs = useMemo(() => serverShape.configs ?? [], [serverShape]);
  const configsGroups = useMemo(
    () => serverShape.configs_groups ?? [],
    [serverShape],
  );
  const configsTotal = serverShape.configs_total ?? configs.length;
  const configsGroupsTotalBound =
    serverShape.configs_groups_total ?? configsGroups.length;
  const configsPerGroupTotal = useMemo(
    () => serverShape.configs_per_group_total ?? {},
    [serverShape],
  );

  const runOptions = useMemo<TestChatHeaderRunOption[]>(
    () =>
      configs.map((c) => ({
        id: c.run_id,
        label: c.label,
        group_id: c.group_id ?? null,
      })),
    [configs],
  );

  // Composer-style selection — empty by default. The picker is the
  // source of truth for what runs to queue on the next Run, NOT a
  // filter for the history list. History always shows everything.
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);

  // History list (top zone) = every binding row, regardless of status.
  // Each binding is one actual past execution (a trace+run pair). Sort
  // oldest → newest so the newest run sits closest to the composer,
  // chat-message style. Drafts no longer live in the history list —
  // the bottom picker now sources configs from test_data.configs.
  const filteredRuns = useMemo(() => {
    return [...runs].sort((a, b) => {
      const at = (a.run_id ?? "") + (a.chat_id ?? "");
      const bt = (b.run_id ?? "") + (b.chat_id ?? "");
      return at.localeCompare(bt);
    });
  }, [runs]);

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

  // Header is now a read-only history caption ("History · N").
  // Run picker moved to the bottom composer (inputAreaProps).
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
    history_count: filteredRuns.length,
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

  // useTestRun.run drives the canonical 3-step fire:
  //   /test/trace (with run_id = config) → /test/generate → /test/run
  // The server already accepts the config's run_id on /test/trace
  // (TestTracePayload.run_id), so passing historicalRunId here makes the
  // new trace inherit that config's bundle.
  const testRunner = useTestRun();

  const handleRunSelected = useCallback(
    (extra_instructions: string) => {
      // selectedRunIds are config run_ids (runs_entry.id) from the picker.
      // Fan out: one fresh trace+run per selected config.
      void extra_instructions;
      if (!invocationId) {
        toast.error("Cannot run: no active invocation");
        return;
      }
      const configsByRunId = new Map(configs.map((c) => [c.run_id, c]));
      for (const configRunId of selectedRunIds) {
        // Faithful replay: pull the bundle ids the server projected
        // onto this config (sourced from the historical run's agent
        // resource) and pass them as panel state. /test/trace stores
        // them verbatim on the new trace's connection tables; the
        // dispatcher reads them off the trace bundle.
        const cfg = configsByRunId.get(configRunId);
        const panel = cfg
          ? {
              ...(cfg.prompt_ids && cfg.prompt_ids.length > 0 && {
                prompt_ids: cfg.prompt_ids,
              }),
              ...(cfg.tool_ids && cfg.tool_ids.length > 0 && {
                tool_ids: cfg.tool_ids,
              }),
              ...(cfg.instruction_ids && cfg.instruction_ids.length > 0 && {
                instruction_ids: cfg.instruction_ids,
              }),
            }
          : undefined;
        // Fire-and-forget; useTestRun handles its own staging + errors.
        void testRunner.run({
          testId: test_id,
          testInvocationId: invocationId,
          historicalRunId: configRunId,
          ...(panel && Object.keys(panel).length > 0 && { panel }),
        });
      }
      // Reset selection so the composer is clean for the next round —
      // mirrors how a chat input clears after sending a message.
      setSelectedRunIds([]);
    },
    [configs, invocationId, selectedRunIds, test_id, testRunner],
  );

  // is_starting = true while any selected config has fired and is still
  // in its "starting" window. Selection is by config run_id, and
  // startingRunIds tracks newly-fired runs by their run_id. Best-effort
  // signal — clears when the trace transitions out of the starting set.
  const isAnySelectedStarting = useMemo(() => {
    if (startingRunIds.size === 0 || selectedRunIds.length === 0) return false;
    return selectedRunIds.some((id) => startingRunIds.has(id));
  }, [selectedRunIds, startingRunIds]);

  // nuqs URL state for picker pagination — two axes:
  //   • configsGroupsPage paginates group headers (outer).
  //   • configsExpanded is the comma-separated list of group_ids the
  //     user has opened. Server returns rows only for those.
  // Flipping any of these triggers SSR re-fetch via /test/get.
  const [
    {
      configsGroupsPage,
      configsGroupsPageSize,
      configsExpanded,
      configsExpandedPageSize,
    },
    setConfigsParams,
  ] = useQueryStates(
    {
      configsGroupsPage: parseAsInteger,
      configsGroupsPageSize: parseAsInteger,
      configsExpanded: parseAsString,
      configsExpandedPageSize: parseAsInteger,
    },
    // shallow:false triggers a Next.js navigation so the server
    // component re-runs and /test/get is re-fetched with the new
    // pagination params. Without this nuqs only updates the URL and
    // the SSR-fetched test_data prop stays frozen.
    { shallow: false, history: "replace" },
  );
  const currentGroupsPage = configsGroupsPage ?? 1;
  const currentGroupsPageSize = configsGroupsPageSize ?? 10;
  const expandedIds = useMemo(
    () =>
      (configsExpanded ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [configsExpanded],
  );
  const currentExpandedPageSize = configsExpandedPageSize ?? 20;

  // Bottom composer: picker (source of truth for what gets queued) +
  // optional extra instructions + Run button.
  const inputAreaProps: RunSelectorProps = {
    is_starting: isAnySelectedStarting,
    has_selection: selectedRunIds.length > 0,
    on_run: handleRunSelected,
    is_connected: true,
    runs: runOptions,
    groups: configsGroups,
    per_group_total: configsPerGroupTotal,
    total_runs: configsTotal,
    selected_run_ids: selectedRunIds,
    on_select_runs: (ids: string[]) => setSelectedRunIds(ids),
    pagination: {
      groups_page: currentGroupsPage,
      groups_page_size: currentGroupsPageSize,
      groups_total_bound: configsGroupsTotalBound,
      on_groups_page_change: (page: number) => {
        void setConfigsParams({ configsGroupsPage: page });
      },
      expanded: expandedIds,
      on_expanded_change: (next: string[]) => {
        void setConfigsParams({
          configsExpanded: next.length > 0 ? next.join(",") : null,
        });
      },
      expanded_page_size: currentExpandedPageSize,
      on_expanded_page_size_change: (size: number) => {
        void setConfigsParams({ configsExpandedPageSize: size });
      },
    },
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
