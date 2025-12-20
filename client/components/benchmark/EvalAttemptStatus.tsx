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
  UpdateEvalAttemptIn,
  UpdateEvalAttemptOut,
} from "@/app/(main)/benchmark/a/[attemptId]/page";

type EvalAttemptFullOut = OutputOf<"/api/v3/evals/attempt/full", "post">;

export interface EvalAttemptStatusProps {
  attemptId: string;
  attemptData: EvalAttemptFullOut;
  agentsList: AgentsListOut;
  updateEvalAttemptSettings: (input: UpdateEvalAttemptIn) => Promise<UpdateEvalAttemptOut>;
}

export default function EvalAttemptStatus({
  attemptId,
  attemptData,
  agentsList,
  updateEvalAttemptSettings,
}: EvalAttemptStatusProps) {
  const { socket, isConnected, effectiveProfile, activeProfile } = useProfile();
  const [runs, setRuns] = useState(attemptData.runs || []);
  const [startingRunIds, setStartingRunIds] = useState<Set<string>>(new Set());
  const [stoppingRunIds, setStoppingRunIds] = useState<Set<string>>(new Set());
  
  // Conversation settings state
  const attempt = attemptData.attempt;
  const evalInfo = attemptData.eval;
  const [conversationMode] = useState(attempt.conversation_mode || false);
  const [conversationAgentId, setConversationAgentId] = useState<string | null>(
    attempt.conversation_agent_id || null
  );
  const [conversationMaxTurns, setConversationMaxTurns] = useState<number | null>(
    attempt.conversation_max_turns || null
  );
  const [systemPrompt, setSystemPrompt] = useState(evalInfo.system_prompt || "");
  const [applySystemPromptToAll, setApplySystemPromptToAll] = useState(false);
  const [applyConversationSettingsToAll, setApplyConversationSettingsToAll] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
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

    socket.on("evals_status_update", handleStatusUpdate);
    socket.on("evals_run_completed", handleRunCompleted);
    socket.on("evals_completed", handleCompleted);
    socket.on("evals_run_started", handleRunStarted);
    socket.on("evals_run_start_error", handleRunStartError);
    socket.on("evals_run_stopped", handleRunStopped);
    socket.on("evals_run_stop_error", handleRunStopError);
    socket.on("evals_runs_start_all_started", handleRunsStartAllStarted);
    socket.on("evals_runs_start_all_error", handleRunsStartAllError);

    return () => {
      // Leave eval room on unmount
      socket.emit("eval_leave", { attempt_id: attemptId });
      socket.off("evals_status_update", handleStatusUpdate);
      socket.off("evals_run_completed", handleRunCompleted);
      socket.off("evals_completed", handleCompleted);
      socket.off("evals_run_started", handleRunStarted);
      socket.off("evals_run_start_error", handleRunStartError);
      socket.off("evals_run_stopped", handleRunStopped);
      socket.off("evals_run_stop_error", handleRunStopError);
      socket.off("evals_runs_start_all_started", handleRunsStartAllStarted);
      socket.off("evals_runs_start_all_error", handleRunsStartAllError);
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

      socket.emit("eval_run_start", {
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

      socket.emit("eval_run_stop", {
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

    socket.emit("eval_runs_start_all", {
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

  // Handle updating eval attempt settings
  const handleUpdateSettings = useCallback(async () => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      await updateEvalAttemptSettings({
        body: {
          attemptId,
          conversation_mode: conversationMode,
          conversation_agent_id: conversationAgentId ?? null,
          conversation_max_turns: conversationMaxTurns ?? null,
        },
      });
      toast.success("Settings updated successfully");
    } catch {
      toast.error("Failed to update settings");
    } finally {
      setIsUpdating(false);
    }
  }, [
    isUpdating,
    attemptId,
    conversationMode,
    conversationAgentId,
    conversationMaxTurns,
    updateEvalAttemptSettings,
  ]);

  // Update conversation settings when they change (if apply to all is checked)
  useEffect(() => {
    if (applyConversationSettingsToAll && (conversationAgentId || conversationMaxTurns)) {
      handleUpdateSettings();
    }
  }, [applyConversationSettingsToAll, conversationAgentId, conversationMaxTurns, handleUpdateSettings]);

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
            {conversationMode && (
              <div>
                <span className="text-muted-foreground">Conversation Mode: </span>
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
                      disabled={!evalInfo.dynamic || isUpdating}
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

            {/* Conversation Settings Accordion */}
            {conversationMode && (
              <AccordionItem value="conversation-settings">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <span>Conversation Settings</span>
                    {applyConversationSettingsToAll && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="conversation-agent">Conversation Agent</Label>
                      <GenericPicker
                        items={agentMapping}
                        itemIds={validAgentIds}
                        selectedIds={conversationAgentId ? [conversationAgentId] : []}
                        onSelect={(ids: string[]) => setConversationAgentId(ids[0] || null)}
                        getId={(item: { id: string }) => item.id}
                        getLabel={(item: { name: string }) => item.name}
                        getSearchText={(item: { name: string; description?: string }) =>
                          `${item.name} ${item.description || ""}`
                        }
                        placeholder="Select conversation agent..."
                        disabled={isUpdating}
                        multiSelect={false}
                        hideSelectedChips={true}
                        buttonClassName="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-turns">Max Turns</Label>
                      <Input
                        id="max-turns"
                        type="number"
                        min="1"
                        value={conversationMaxTurns || ""}
                        onChange={(e) =>
                          setConversationMaxTurns(
                            e.target.value ? parseInt(e.target.value, 10) : null
                          )
                        }
                        disabled={isUpdating}
                        placeholder="Enter max conversation turns..."
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="apply-conversation-all"
                        checked={applyConversationSettingsToAll}
                        onCheckedChange={(checked) =>
                          setApplyConversationSettingsToAll(checked === true)
                        }
                      />
                      <Label
                        htmlFor="apply-conversation-all"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Apply to all runs
                      </Label>
                    </div>
                    <Button
                      onClick={handleUpdateSettings}
                      disabled={isUpdating}
                      size="sm"
                    >
                      {isUpdating ? "Updating..." : "Save Settings"}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
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

