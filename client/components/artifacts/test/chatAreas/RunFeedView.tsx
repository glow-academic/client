/**
 * RunFeedView.tsx
 * Stacked feed of run results — plugs into the chat_area slot of GenericChatInterface.
 * Implements a subset of MessagesViewProps for type compatibility.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { OutputOf } from "@/lib/api/types";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type TestArtifactOut = OutputOf<"/api/v4/artifacts/test/get", "post">;
type RunItem = NonNullable<TestArtifactOut["runs"]>[number];

export interface RunFeedViewProps {
  runs: RunItem[];
  starting_run_ids: Set<string>;
  stopping_run_ids: Set<string>;
  on_start_run: (invocationId: string) => void;
  on_stop_run: (invocationId: string) => void;
  is_connected: boolean;
  disabled?: boolean;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "in_progress":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusBadge(status: string) {
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
}

export function RunFeedView({
  runs,
  starting_run_ids,
  stopping_run_ids,
  on_start_run,
  on_stop_run,
  is_connected,
  disabled,
}: RunFeedViewProps) {
  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        <p>No runs configured for this evaluation.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {runs.map((run) => {
        const isStarting = run.chat_id ? starting_run_ids.has(run.chat_id) : false;
        const isStopping = run.chat_id ? stopping_run_ids.has(run.chat_id) : false;

        return (
          <Card key={run.chat_id} className="border">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {getStatusIcon(run.status || "not_started")}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {run.agent_name || "Agent"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {run.model_name || "No model"}
                      </span>
                    </div>
                    {run.run_id && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {run.run_id.substring(0, 8)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Score */}
                  {run.status === "completed" &&
                    run.grade_score !== null &&
                    run.grade_score !== undefined && (
                      <Badge
                        variant={run.grade_passed ? "default" : "destructive"}
                        className={run.grade_passed ? "bg-green-500" : ""}
                      >
                        {run.grade_score}
                        {run.grade_passed ? " Pass" : " Fail"}
                      </Badge>
                    )}

                  {/* Status badge */}
                  {getStatusBadge(run.status || "not_started")}

                  {/* Action buttons */}
                  {run.status === "not_started" && run.chat_id && (
                    <Button
                      onClick={() => on_start_run(run.chat_id!)}
                      variant="outline"
                      size="sm"
                      disabled={disabled || !is_connected || isStarting}
                    >
                      {isStarting ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3 mr-1" />
                      )}
                      {isStarting ? "Starting..." : "Run"}
                    </Button>
                  )}
                  {run.status === "in_progress" && run.chat_id && (
                    <Button
                      onClick={() => on_stop_run(run.chat_id!)}
                      variant="destructive"
                      size="sm"
                      disabled={disabled || !is_connected || isStopping}
                    >
                      {isStopping ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Square className="h-3 w-3 mr-1" />
                      )}
                      {isStopping ? "Stopping..." : "Stop"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            {/* Expandable content area — placeholder for future message display */}
            {run.status === "completed" && (
              <CardContent className="pt-0 pb-3 px-4">
                <div className="text-xs text-muted-foreground border-t pt-2">
                  Run completed.{" "}
                  {run.grade_score !== null && run.grade_score !== undefined
                    ? `Score: ${run.grade_score}`
                    : "Awaiting grading..."}
                </div>
              </CardContent>
            )}
            {run.status === "in_progress" && (
              <CardContent className="pt-0 pb-3 px-4">
                <div className="text-xs text-muted-foreground border-t pt-2 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Running evaluation...
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
