/**
 * EvalAttemptStatus.tsx
 * Eval attempt status component showing runs table with progress
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
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
import type { OutputOf } from "@/lib/api/types";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type EvalAttemptFullOut = OutputOf<"/api/v3/evals/attempt/full", "post">;

export interface EvalAttemptStatusProps {
  attemptId: string;
  attemptData: EvalAttemptFullOut;
}

export default function EvalAttemptStatus({
  attemptId,
  attemptData,
}: EvalAttemptStatusProps) {
  const { socket, isConnected } = useProfile();
  const [runs, setRuns] = useState(attemptData.runs || []);

  // Join eval room on mount for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join eval room
    socket.emit("eval_join", { attempt_id: attemptId });

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
              test_id: data.test_id || run.test_id,
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
              test_id: data.test_id,
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

    socket.on("evals_status_update", handleStatusUpdate);
    socket.on("evals_run_completed", handleRunCompleted);
    socket.on("evals_completed", handleCompleted);

    return () => {
      // Leave eval room on unmount
      socket.emit("eval_leave", { attempt_id: attemptId });
      socket.off("evals_status_update", handleStatusUpdate);
      socket.off("evals_run_completed", handleRunCompleted);
      socket.off("evals_completed", handleCompleted);
    };
  }, [socket, isConnected, attemptId]);

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

  const evalInfo = attemptData.eval;
  const statusSummary = attemptData.status_summary;

  return (
    <div className="space-y-6">
      {/* Eval Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>{evalInfo.name}</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {evalInfo.description}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Rubric: </span>
              <span className="font-medium">{evalInfo.rubric_name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Runs: </span>
              <span className="font-medium">{statusSummary.total}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Completed: </span>
              <span className="font-medium text-green-600">
                {statusSummary.completed}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">In Progress: </span>
              <span className="font-medium text-blue-600">
                {statusSummary.in_progress}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Not Started: </span>
              <span className="font-medium text-gray-600">
                {statusSummary.not_started}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Runs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Agent/Persona</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No runs found
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={run.run_id}>
                    <TableCell className="font-mono text-xs">
                      {run.run_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>{run.model_name || "N/A"}</TableCell>
                    <TableCell>
                      {run.agent_name || run.persona_name || "N/A"}
                    </TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell>
                      {run.status === "completed" && run.grade_score !== null
                        ? `${run.grade_score}${run.grade_passed ? " ✓" : ""}`
                        : "-"}
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

