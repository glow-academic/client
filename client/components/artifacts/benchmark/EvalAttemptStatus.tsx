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
import { AlertCircle, CheckCircle2, Clock, Play, Square, Settings } from "lucide-react";
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

    // Join test room on mount for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join test room using invocation_id
    // For now, join with first run's chat_id as invocation_id
    const firstRun = runs[0];
    const invocationId = firstRun?.chat_id;
    if (invocationId) {
      socket.emit("test_join", { invocation_id: invocationId });
    }

    // Listen for test run start
    const handleRunStart = (data: {
      invocation_id: string;
      run_id: string;
      current_run: number;
      total_runs: number;
    }) => {
      setStartingRunIds((prev) => {
        const next = new Set(prev);
        next.delete(data.run_id);
        return next;
      });
      setRuns((prevRuns) =>
        prevRuns.map((run) => {
          if (run.chat_id === data.invocation_id) {
            return { ...run, status: "in_progress" };
          }
          return run;
        })
      );
    };

    // Listen for test run complete
    const handleRunComplete = (data: {
      invocation_id: string;
      run_id: string;
      current_run: number;
      total_runs: number;
      remaining_runs: number;
    }) => {
      setRuns((prevRuns) =>
        prevRuns.map((run) => {
          if (run.chat_id === data.invocation_id) {
            return { ...run, status: "completed" };
          }
          return run;
        })
      );
    };

    // Listen for test graded
    const handleGraded = (data: {
      invocation_id: string;
      grade_id?: string;
      score?: number;
      passed?: boolean;
    }) => {
      setRuns((prevRuns) =>
        prevRuns.map((run) => {
          if (run.chat_id === data.invocation_id) {
            return {
              ...run,
              grade_score: data.score ?? run.grade_score,
              grade_passed: data.passed ?? run.grade_passed,
            };
          }
          return run;
        })
      );
    };

    // Listen for all complete
    const handleAllComplete = (data: {
      invocation_id: string;
      total_runs: number;
    }) => {
      toast.success("All test runs complete!");
    };

    // Listen for test stopped
    const handleStopped = (data: {
      invocation_id: string;
      success: boolean;
      message?: string;
    }) => {
      setStoppingRunIds((prev) => {
        const next = new Set(prev);
        // Clear all stopping states
        return new Set();
      });
      if (data.success) {
        setRuns((prevRuns) =>
          prevRuns.map((run) => {
            if (run.chat_id === data.invocation_id) {
              return { ...run, status: "not_started" };
            }
            return run;
          })
        );
        toast.success(data.message || "Test stopped.");
      } else {
        toast.error(data.message || "Failed to stop test.");
      }
    };

    // Listen for test errors
    const handleError = (data: {
      invocation_id?: string;
      message: string;
      error_type?: string;
    }) => {
      setStartingRunIds(new Set());
      setStoppingRunIds(new Set());
      toast.error(data.message);
    };

    socket.on("test_run_start", handleRunStart);
    socket.on("test_run_complete", handleRunComplete);
    socket.on("test_graded", handleGraded);
    socket.on("test_all_complete", handleAllComplete);
    socket.on("test_stopped", handleStopped);
    socket.on("test_error", handleError);

    return () => {
      // Leave test room on unmount
      if (invocationId) {
        socket.emit("test_leave", { invocation_id: invocationId });
      }
      socket.off("test_run_start", handleRunStart);
      socket.off("test_run_complete", handleRunComplete);
      socket.off("test_graded", handleGraded);
      socket.off("test_all_complete", handleAllComplete);
      socket.off("test_stopped", handleStopped);
      socket.off("test_error", handleError);
    };
  }, [socket, isConnected, attemptId, runs]);

  const handleStartRun = useCallback(
    (invocationId: string) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected. Please wait for connection.");
        return;
      }

      setStartingRunIds((prev) => new Set(prev).add(invocationId));

      socket.emit("test_run", {
        invocation_id: invocationId,
        test_id: attemptId,
      });
    },
    [socket, isConnected, attemptId]
  );

  const handleStopRun = useCallback(
    (invocationId: string) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected. Please wait for connection.");
        return;
      }

      setStoppingRunIds((prev) => new Set(prev).add(invocationId));

      socket.emit("test_stop", {
        invocation_id: invocationId,
      });
    },
    [socket, isConnected]
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
                        {run.status === "not_started" && run.chat_id && (
                          <Button
                            onClick={() => handleStartRun(run.chat_id!)}
                            variant="outline"
                            size="sm"
                            disabled={
                              !isConnected || startingRunIds.has(run.chat_id)
                            }
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
                            disabled={
                              !isConnected || stoppingRunIds.has(run.chat_id)
                            }
                          >
                            <Square className="h-3 w-3 mr-1" />
                            {stoppingRunIds.has(run.chat_id) ? "Stopping..." : "Stop"}
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
