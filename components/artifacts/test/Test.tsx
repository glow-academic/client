/**
 * Test.tsx
 * Test artifact component showing runs table with progress
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfile } from "@/contexts/profile-context";
import { useTransport } from "@/lib/transport/context";
import { useTestLifecycle } from "@/hooks/use-test-lifecycle";
import type { OutputOf } from "@/lib/api/types";
import { AlertCircle, CheckCircle2, Clock, Play, Square, Settings } from "lucide-react";
import { HoverPrefetchLink } from "@/components/common/HoverPrefetchLink";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

type TestArtifactOut = OutputOf<"/test/get", "post">;

type RunItem = NonNullable<TestArtifactOut["runs"]>[number];

export interface TestProps {
  attemptId: string;
  attemptData: TestArtifactOut;
}

export default function Test({
  attemptId,
  attemptData,
}: TestProps) {
  const { _profile } = useProfile();
  const transport = useTransport();
  const [runs, setRuns] = useState<RunItem[]>(attemptData.runs || []);
  const [startingRunIds, setStartingRunIds] = useState<Set<string>>(new Set());
  const [stoppingRunIds, setStoppingRunIds] = useState<Set<string>>(new Set());

  const [infiniteMode] = useState(attemptData.infinite_mode || false);

  // Derive invocation ID from first run
  const invocationId = useMemo(() => {
    const firstRun = runs[0];
    return firstRun?.chat_id ?? null;
  }, [runs]);

  const { runInvocation, stopInvocation } = useTestLifecycle({
    transport,
    invocationId,
    testId: attemptId,
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
      setRuns((prevRuns) =>
        prevRuns.map((run) =>
          run.chat_id === dataInvocationId
            ? { ...run, status: "in_progress" }
            : run,
        ),
      );
    },
    onRunReplayCompleted: (data) => {
      const dataInvocationId = data["invocation_id"] as string | undefined;
      setRuns((prevRuns) =>
        prevRuns.map((run) =>
          run.chat_id === dataInvocationId
            ? { ...run, status: "completed" }
            : run,
        ),
      );
    },
    onInvocationCompleted: () => {
      toast.success("All test runs complete!");
    },
    onCompleted: () => {
      toast.success("All test runs complete!");
    },
    onInvocationStopped: (data) => {
      const success = (data["success"] as boolean | undefined) ?? true;
      const message = data["message"] as string | undefined;
      const dataInvocationId = data["invocation_id"] as string | undefined;
      setStoppingRunIds(new Set());
      if (success) {
        setRuns((prevRuns) =>
          prevRuns.map((run) =>
            run.chat_id === dataInvocationId
              ? { ...run, status: "not_started" }
              : run,
          ),
        );
        toast.success(message || "Test stopped.");
      } else {
        toast.error(message || "Failed to stop test.");
      }
    },
    onError: (data) => {
      setStartingRunIds(new Set());
      setStoppingRunIds(new Set());
      const message = data["message"] as string | undefined;
      if (message) toast.error(message);
    },
  });

  const handleStartRun = useCallback(
    (runInvocationId: string) => {
      const targetRun = runs.find((r) => r.chat_id === runInvocationId);
      const runId = targetRun?.run_id;
      if (!runId) {
        toast.error("Cannot start run: missing run_id");
        return;
      }
      setStartingRunIds((prev) => new Set(prev).add(runId));
      runInvocation({ testId: attemptId, invocationId: runInvocationId, runId });
    },
    [runs, attemptId, runInvocation],
  );

  const handleStopRun = useCallback(
    (runInvocationId: string) => {
      setStoppingRunIds((prev) => new Set(prev).add(runInvocationId));
      stopInvocation(runInvocationId);
    },
    [stopInvocation],
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Not Started
          </Badge>
        );
    }
  };

  const statusSummary = attemptData.status_summary ?? null;

  return (
    <div className="space-y-6">
      {/* Eval Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>{attemptData.eval_name ?? "Unknown Eval"}</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {attemptData.eval_description ?? ""}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Rubric: </span>
              <span className="font-medium">{attemptData.rubric_name ?? "N/A"}</span>
            </div>
            {statusSummary && (
              <>
                <div>
                  <span className="text-muted-foreground">Total Runs: </span>
                  <span className="font-medium">{statusSummary.total ?? 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed: </span>
                  <span className="font-medium text-green-600">
                    {statusSummary.completed ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">In Progress: </span>
                  <span className="font-medium text-blue-600">
                    {statusSummary.in_progress ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Not Started: </span>
                  <span className="font-medium text-gray-600">
                    {statusSummary.not_started ?? 0}
                  </span>
                </div>
              </>
            )}
            {infiniteMode && (
              <div>
                <span className="text-muted-foreground">Infinite Mode: </span>
                <Badge variant="secondary">Enabled</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Runs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Evaluation Runs</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No runs found
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={`${run.chat_id ?? ""}::${run.run_id ?? "none"}`}>
                    <TableCell className="font-mono text-xs">
                      {run.run_id ? `${run.run_id.substring(0, 8)}...` : "N/A"}
                    </TableCell>
                    <TableCell>{run.model_name || "N/A"}</TableCell>
                    <TableCell>{run.agent_name || "N/A"}</TableCell>
                    <TableCell>{getStatusBadge(run.status || "")}</TableCell>
                    <TableCell>
                      {run.status === "completed" && run.grade_score !== null && run.grade_score !== undefined
                        ? `${run.grade_score}${run.grade_passed ? " ✓" : ""}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {run.status === "not_started" && run.chat_id && (
                          <Button
                            onClick={() => handleStartRun(run.chat_id!)}
                            variant="outline"
                            size="sm"
                            disabled={startingRunIds.has(run.chat_id)}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            {startingRunIds.has(run.chat_id) ? "Starting..." : "Start"}
                          </Button>
                        )}
                        {run.status === "in_progress" && run.chat_id && (
                          <Button
                            onClick={() => handleStopRun(run.chat_id!)}
                            variant="destructive"
                            size="sm"
                            disabled={stoppingRunIds.has(run.chat_id)}
                          >
                            <Square className="h-3 w-3 mr-1" />
                            {stoppingRunIds.has(run.chat_id) ? "Stopping..." : "Stop"}
                          </Button>
                        )}
                        {(run as RunItem & { benchmark_bundle_entry_id?: string | null }).benchmark_bundle_entry_id && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                          >
                            <HoverPrefetchLink
                              href={`/invocation/${(run as RunItem & { benchmark_bundle_entry_id: string }).benchmark_bundle_entry_id}?testId=${attemptId}`}
                              delay={150}
                            >
                              <Settings className="h-3 w-3 mr-1" />
                              Customize
                            </HoverPrefetchLink>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
