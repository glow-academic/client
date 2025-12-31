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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { useProfile } from "@/contexts/profile-context";
import type { OutputOf } from "@/lib/api/types";
import { AlertCircle, CheckCircle2, Clock, Play, Square, PlaySquare, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  AgentsListOut,
} from "@/app/(main)/benchmark/a/[attemptId]/page";

type EvalAttemptFullOut = OutputOf<"/api/v3/attempts/eval", "post">;

export interface EvalAttemptStatusProps {
  attemptId: string;
  attemptData: EvalAttemptFullOut;
  agentsList: AgentsListOut;
}

export default function EvalAttemptStatus({
  attemptId,
  attemptData,
  agentsList,
}: EvalAttemptStatusProps) {
  const { socket, isConnected, effectiveProfile, activeProfile } = useProfile();
  const [runs, setRuns] = useState(attemptData.runs || []);
  const [startingRunIds, setStartingRunIds] = useState<Set<string>>(new Set());
  const [stoppingRunIds, setStoppingRunIds] = useState<Set<string>>(new Set());
  
  // Attempt and eval info
  const attempt = attemptData.attempt;
  const evalInfo = attemptData.eval;
  const [infiniteMode] = useState(attempt.infinite_mode || false);
  const [systemPrompt, setSystemPrompt] = useState(evalInfo.system_prompt || "");
  const [applySystemPromptToAll, setApplySystemPromptToAll] = useState(false);
  
  // Build agent mapping for picker
  const agentMapping = useMemo(() => {
    const mapping: Record<string, { id: string; name: string; description?: string }> = {};
    agentsList.agents.forEach((agent) => {
      mapping[agent.agent_id] = {
        id: agent.agent_id,
        name: agent.name,
        ...(agent.description && { description: agent.description }),
      };
    });
    return mapping;
  }, [agentsList.agents]);
  
  const validAgentIds = useMemo(
    () => agentsList.agents.map((a) => a.agent_id).filter(Boolean),
    [agentsList.agents]
  );

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
              test_id: data.test_id ?? run.test_id ?? null,
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

      const profileIdForEmit =
        effectiveProfile?.role === "guest" ? "" : String(activeProfile!.id);

      // TODO: These individual run start/stop events may need to be removed
      // The new benchmark architecture orchestrates runs via benchmark_start/next/end
      // For now, keeping for backward compatibility but updating event names
      socket.emit("benchmark_run_start", {
        attempt_id: attemptId,
        run_id: runId,
        profile_id: profileIdForEmit || null,
      });
    },
    [socket, isConnected, attemptId, effectiveProfile, activeProfile]
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
      effectiveProfile?.role === "guest" ? "" : String(activeProfile!.id);

    socket.emit("benchmark_runs_start_all", {
      attempt_id: attemptId,
      profile_id: profileIdForEmit || null,
    });
  }, [socket, isConnected, attemptId, effectiveProfile, activeProfile]);

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

  const statusSummary = attemptData.status_summary;
  const notStartedRuns = useMemo(
    () => runs.filter((run) => run.status === "not_started"),
    [runs]
  );

  // Note: Update functionality removed - use websocket events instead if needed

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
            {infiniteMode && (
              <div>
                <span className="text-muted-foreground">Infinite Mode: </span>
                <Badge variant="secondary">Enabled</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Settings Accordion */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {/* System Prompt Accordion */}
            <AccordionItem value="system-prompt">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <span>System Prompt</span>
                  {applySystemPromptToAll && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="system-prompt">Agent System Prompt</Label>
                    <Textarea
                      id="system-prompt"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      disabled={!evalInfo.dynamic}
                      className="min-h-[200px] font-mono text-sm"
                      placeholder="System prompt for the agent being evaluated..."
                    />
                    {!evalInfo.dynamic && (
                      <p className="text-sm text-muted-foreground">
                        System prompt editing is only available when eval.dynamic is true.
                      </p>
                    )}
                  </div>
                  {evalInfo.dynamic && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="apply-system-prompt-all"
                        checked={applySystemPromptToAll}
                        onCheckedChange={(checked) =>
                          setApplySystemPromptToAll(checked === true)
                        }
                      />
                      <Label
                        htmlFor="apply-system-prompt-all"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Apply to all runs
                      </Label>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
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
                <TableHead>Agent/Persona</TableHead>
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
                    <TableCell>
                      {run.status === "not_started" && (
                        <Button
                          onClick={() => handleStartRun(run.run_id)}
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
                      {run.status === "in_progress" && (
                        <Button
                          onClick={() => handleStopRun(run.run_id)}
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

