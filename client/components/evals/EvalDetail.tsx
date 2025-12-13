/**
 * EvalDetail.tsx
 * Read-only detail/status view component for evals
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  Square,
  ArrowLeft,
} from "lucide-react";
import { useProfile } from "@/contexts/profile-context";
import { toast } from "sonner";
import type {
  EvalDetailOut,
  RunEvalIn,
  RunEvalOut,
  StopEvalIn,
  StopEvalOut,
} from "@/app/(main)/engine/evals/e/[evalId]/page";

export interface EvalDetailProps {
  evalDetail: EvalDetailOut;
  runEvalAction?: (input: RunEvalIn) => Promise<RunEvalOut>;
  stopEvalAction?: (input: StopEvalIn) => Promise<StopEvalOut>;
}

export function EvalDetail({
  evalDetail: serverEvalDetail,
  runEvalAction,
  stopEvalAction,
}: EvalDetailProps) {
  const router = useRouter();
  const { socket } = useProfile();
  const [evalDetail, setEvalDetail] = useState(serverEvalDetail);
  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Update eval detail when server data changes
  useEffect(() => {
    setEvalDetail(serverEvalDetail);
  }, [serverEvalDetail]);

  // WebSocket integration for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleEvalProgress = (data: {
      eval_id: string;
      model_run_id?: string;
      status: string;
      message: string;
    }) => {
      if (data.eval_id === evalDetail.eval_id) {
        setEvalDetail((prev) => {
          if (data.status === "completed" && data.model_run_id) {
            const newCompletedRuns = prev.completed_runs + 1;
            const newPendingRuns = Math.max(0, prev.pending_runs - 1);
            return {
              ...prev,
              completed_runs: newCompletedRuns,
              pending_runs: newPendingRuns,
              status: newPendingRuns === 0 ? "completed" : prev.status,
              model_runs: prev.model_runs.map((mr) =>
                mr.model_run_id === data.model_run_id
                  ? { ...mr, completed: true }
                  : mr,
              ),
            };
          }
          return prev;
        });
      }
    };

    const handleEvalCompleted = (data: {
      eval_id: string;
      message: string;
    }) => {
      if (data.eval_id === evalDetail.eval_id) {
        setEvalDetail((prev) => ({
          ...prev,
          status: "completed",
          pending_runs: 0,
          completed_runs: prev.total_runs,
        }));
        setIsRunning(false);
      }
    };

    const handleEvalStopped = (data: {
      eval_id: string;
      success: boolean;
      stopped_count: number;
      message?: string;
    }) => {
      if (data.eval_id === evalDetail.eval_id) {
        setEvalDetail((prev) => ({
          ...prev,
          status: "completed",
          pending_runs: Math.max(0, prev.pending_runs - data.stopped_count),
          completed_runs: prev.completed_runs + data.stopped_count,
        }));
        setIsStopping(false);
        toast.success(data.message || `Stopped ${data.stopped_count} model_run evaluations`);
      }
    };

    socket.on("eval_progress", handleEvalProgress);
    socket.on("eval_completed", handleEvalCompleted);
    socket.on("eval_stopped", handleEvalStopped);

    return () => {
      socket.off("eval_progress", handleEvalProgress);
      socket.off("eval_completed", handleEvalCompleted);
      socket.off("eval_stopped", handleEvalStopped);
    };
  }, [socket, evalDetail.eval_id]);

  const handleRun = async () => {
    if (!runEvalAction) return;
    setIsRunning(true);
    try {
      await runEvalAction({
        body: {
          evalId: evalDetail.eval_id,
          profileId: "", // Will be filled by server action
        },
      });
      toast.success("Eval started successfully");
      router.refresh();
    } catch (error) {
      toast.error(`Failed to run eval: ${error}`);
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    if (!stopEvalAction) return;
    setIsStopping(true);
    try {
      await stopEvalAction({
        body: {
          evalId: evalDetail.eval_id,
          profileId: "", // Will be filled by server action
        },
      });
      router.refresh();
    } catch (error) {
      toast.error(`Failed to stop eval: ${error}`);
      setIsStopping(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return (
          <Badge variant="default" className="bg-blue-500">
            <Clock className="h-3 w-3 mr-1" />
            Running
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge variant="secondary">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/engine/evals")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{evalDetail.name}</h1>
            <p className="text-muted-foreground">{evalDetail.description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {evalDetail.status === "pending" && runEvalAction && (
            <Button onClick={handleRun} disabled={isRunning}>
              <Play className="h-4 w-4 mr-2" />
              Run Eval
            </Button>
          )}
          {evalDetail.status === "running" && stopEvalAction && (
            <Button
              onClick={handleStop}
              disabled={isStopping}
              variant="destructive"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="mt-1">{getStatusBadge(evalDetail.status)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Runs</div>
              <div className="mt-1 text-lg font-semibold">
                {evalDetail.total_runs}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Completed</div>
              <div className="mt-1 text-lg font-semibold text-green-600">
                {evalDetail.completed_runs}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Pending</div>
              <div className="mt-1 text-lg font-semibold text-blue-600">
                {evalDetail.pending_runs}
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Rubric</div>
            <div className="mt-1 font-medium">{evalDetail.rubric_name}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {evalDetail.rubric_description}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {evalDetail.model_runs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No model runs assigned
            </div>
          ) : (
            <div className="space-y-2">
              {evalDetail.model_runs.map((mr) => (
                <div
                  key={mr.model_run_id}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {mr.model_name && (
                        <Badge variant="outline">{mr.model_name}</Badge>
                      )}
                      {mr.agent_name && (
                        <Badge variant="outline">{mr.agent_name}</Badge>
                      )}
                      {mr.persona_name && (
                        <Badge variant="outline">{mr.persona_name}</Badge>
                      )}
                      {mr.profile_name && (
                        <span className="text-sm text-muted-foreground">
                          {mr.profile_name}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(mr.model_run_created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {mr.completed ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                    {mr.has_grade && mr.grade_score !== null && (
                      <Badge variant="outline">
                        Score: {mr.grade_score}
                        {mr.grade_passed !== null &&
                          (mr.grade_passed ? " ✓" : " ✗")}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
