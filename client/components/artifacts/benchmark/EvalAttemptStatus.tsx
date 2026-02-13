/**
 * EvalAttemptStatus.tsx
 * Eval attempt status component showing runs table with progress
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
import { useSocket } from "@/contexts/socket-context";
import type { OutputOf } from "@/lib/api/types";
import { AlertCircle, CheckCircle2, Clock, Play, Square, PlaySquare, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type TestArtifactOut = OutputOf<"/api/v4/artifacts/test/get", "post">;

type RunItem = NonNullable<TestArtifactOut["runs"]>[number];

export interface EvalAttemptStatusProps {
  attemptId: string;
  attemptData: TestArtifactOut;
}

export default function EvalAttemptStatus({
  attemptId,
  attemptData,
}: EvalAttemptStatusProps) {
  const router = useRouter();
  const { profile } = useProfile();
  const { socket, isConnected } = useSocket();
  const [runs, setRuns] = useState<RunItem[]>(attemptData.runs || []);
  const [startingRunIds, setStartingRunIds] = useState<Set<string>>(new Set());
  const [stoppingRunIds, setStoppingRunIds] = useState<Set<string>>(new Set());

  const [infiniteMode] = useState(attemptData.infinite_mode || false);

    // Join benchmark room on mount for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join benchmark room
    socket.emit("benchmark_join", { attempt_id: attemptId });

    // Listen for status updates
    const handleStatusUpdate = (data: {
      eval_id: string;
      run_id: string;
      status?: string;
      test_id?: string;
      message?: string;
      grade_id?: string;
    }) => {
      setRuns((prevRuns) =>
        prevRuns.map((run) => {
          if (run.run_id === data.run_id) {
            return {
              ...run,
              status: data.status || run.status,
            };
          }
          return run;
        }),
      );
    };

    const handleRunCompleted = (data: {
      eval_id: string;
      run_id: string;
      test_id: string;
      status: string;
      message: string;
      grade_id?: string;
    }) => {
      setRuns((prevRuns) =>
        prevRuns.map((run) => {
          if (run.run_id === data.run_id) {
            return {
              ...run,
              status: "completed",
            };
          }
          return run;
        }),
      );
    };

    const handleCompleted = (data: {
      eval_id: string;
      attempt_id: string;
      message: string;
    }) => {
      toast.success(data.message);
    };

    const handleRunStarted = (data: {
      success: boolean;
      message: string;
      attempt_id: string;
      run_id: string;
    }) => {
      if (data.attempt_id !== attemptId) return;
      setStartingRunIds((prev) => {
        const next = new Set(prev);
        next.delete(data.run_id);
        return next;
      });
      if (data.success) {
        setRuns((prevRuns) =>
          prevRuns.map((run) => {
            if (run.run_id === data.run_id) {
              return { ...run, status: "in_progress" };
            }
            return run;
          })
        );
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    };

    const handleRunStartError = (data: {
      success: boolean;
      message: string;
      run_id: string;
    }) => {
      setStartingRunIds((prev) => {
        const next = new Set(prev);
        next.delete(data.run_id);
        return next;
      });
      toast.error(data.message);
    };

    const handleRunStopped = (data: {
      success: boolean;
      message: string;
      attempt_id: string;
      run_id: string;
    }) => {
      if (data.attempt_id !== attemptId) return;
      setStoppingRunIds((prev) => {
        const next = new Set(prev);
        next.delete(data.run_id);
        return next;
      });
      if (data.success) {
        setRuns((prevRuns) =>
          prevRuns.map((run) => {
            if (run.run_id === data.run_id) {
              return { ...run, status: "not_started" };
            }
            return run;
          })
        );
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    };

    const handleRunStopError = (data: {
      success: boolean;
      message: string;
      run_id: string;
    }) => {
      setStoppingRunIds((prev) => {
        const next = new Set(prev);
        next.delete(data.run_id);
        return next;
      });
      toast.error(data.message);
    };

    const handleRunsStartAllStarted = (data: {
      success: boolean;
      message: string;
      attempt_id: string;
      started_count: number;
    }) => {
      if (data.attempt_id !== attemptId) return;
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    };

    const handleRunsStartAllError = (data: {
      success: boolean;
      message: string;
      attempt_id: string;
    }) => {
      if (data.attempt_id !== attemptId) return;
      toast.error(data.message);
    };

    socket.on("benchmarks_status_update", handleStatusUpdate);
    socket.on("benchmarks_run_completed", handleRunCompleted);
    socket.on("benchmarks_completed", handleCompleted);
    socket.on("benchmarks_run_started", handleRunStarted);
    socket.on("benchmarks_run_start_error", handleRunStartError);
    socket.on("benchmarks_run_stopped", handleRunStopped);
    socket.on("benchmarks_run_stop_error", handleRunStopError);
    socket.on("benchmarks_runs_start_all_started", handleRunsStartAllStarted);
    socket.on("benchmarks_runs_start_all_error", handleRunsStartAllError);

    return () => {
      // Leave benchmark room on unmount
      socket.emit("benchmark_leave", { attempt_id: attemptId });
      socket.off("benchmarks_status_update", handleStatusUpdate);
      socket.off("benchmarks_run_completed", handleRunCompleted);
      socket.off("benchmarks_completed", handleCompleted);
      socket.off("benchmarks_run_started", handleRunStarted);
      socket.off("benchmarks_run_start_error", handleRunStartError);
      socket.off("benchmarks_run_stopped", handleRunStopped);
      socket.off("benchmarks_run_stop_error", handleRunStopError);
      socket.off("benchmarks_runs_start_all_started", handleRunsStartAllStarted);
      socket.off("benchmarks_runs_start_all_error", handleRunsStartAllError);
    };
  }, [socket, isConnected, attemptId]);

  const handleStartRun = useCallback(
    (runId: string) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected. Please wait for connection.");
        return;
      }

      setStartingRunIds((prev) => new Set(prev).add(runId));

      const profileIdForEmit = String(profile?.id || "");

      socket.emit("benchmark_run_start", {
        attempt_id: attemptId,
        run_id: runId,
        profile_id: profileIdForEmit || null,
      });
    },
    [socket, isConnected, attemptId, profile]
  );

  const handleStopRun = useCallback(
    (runId: string) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected. Please wait for connection.");
        return;
      }

      setStoppingRunIds((prev) => new Set(prev).add(runId));

      socket.emit("benchmark_run_stop", {
        attempt_id: attemptId,
        run_id: runId,
      });
    },
    [socket, isConnected, attemptId]
  );

  const handleRunAll = useCallback(() => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please wait for connection.");
      return;
    }

    const profileIdForEmit =
      profile?.role === "guest" ? "" : String(profile!.id);

    socket.emit("benchmark_runs_start_all", {
      attempt_id: attemptId,
      profile_id: profileIdForEmit || null,
    });
  }, [socket, isConnected, attemptId, profile]);

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
  const notStartedRuns = useMemo(
    () => runs.filter((run) => run.status === "not_started"),
    [runs]
  );

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
            {notStartedRuns.length > 0 && (
              <Button
                onClick={handleRunAll}
                variant="default"
                size="sm"
                disabled={!isConnected}
              >
                <PlaySquare className="h-4 w-4 mr-2" />
                Run All ({notStartedRuns.length})
              </Button>
            )}
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
                  <TableRow key={run.chat_id}>
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
                        {run.status === "not_started" && run.run_id && (
                          <Button
                            onClick={() => handleStartRun(run.run_id!)}
                            variant="outline"
                            size="sm"
                            disabled={
                              !isConnected || startingRunIds.has(run.run_id)
                            }
                          >
                            <Play className="h-3 w-3 mr-1" />
                            {startingRunIds.has(run.run_id) ? "Starting..." : "Start"}
                          </Button>
                        )}
                        {run.status === "in_progress" && run.run_id && (
                          <Button
                            onClick={() => handleStopRun(run.run_id!)}
                            variant="destructive"
                            size="sm"
                            disabled={
                              !isConnected || stoppingRunIds.has(run.run_id)
                            }
                          >
                            <Square className="h-3 w-3 mr-1" />
                            {stoppingRunIds.has(run.run_id) ? "Stopping..." : "Stop"}
                          </Button>
                        )}
                        {(run as RunItem & { benchmark_bundle_entry_id?: string | null }).benchmark_bundle_entry_id && (
                          <Button
                            onClick={() =>
                              router.push(
                                `/benchmark/${attemptId}/${(run as RunItem & { benchmark_bundle_entry_id: string }).benchmark_bundle_entry_id}`
                              )
                            }
                            variant="ghost"
                            size="sm"
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            Customize
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
