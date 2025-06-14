/**
 * components/management/evals/EvalDetails.tsx
 * Eval details component for the evals section. Will show all the eval runs under the eval. Allow the user to run the eval, hitting the /run endpoint.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";
import { CheckCircle, Clock, Eye, Play, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EvalRun } from "@/types";
import { getAgent } from "@/utils/queries/agents/get-agent";
import { getEvalChatGradesByEvalChats } from "@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-evalchats";
import { getEvalChatsByEvalRuns } from "@/utils/queries/eval_chats/get-eval-chats-by-evalruns";
import { getEvalRunsByEval } from "@/utils/queries/eval_runs/get-eval-runs-by-eval";
import { getRubric } from "@/utils/queries/rubrics/get-rubric";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { logError } from "@/utils/logger";

export default function EvalDetails({ evalId }: { evalId: string }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    agentName: string;
    rubricName: string;
  } | null>(null);
  const [runningEvals, setRunningEvals] = useState<Set<string>>(new Set());
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: runs, isLoading: isLoadingRuns } = useQuery({
    queryKey: ["evalRuns", evalId],
    queryFn: () => getEvalRunsByEval(evalId),
  });

  const { data: evalChats, isLoading: isLoadingEvalChats } = useQuery({
    queryKey: ["evalChats", runs?.map((run: EvalRun) => run.id)],
    queryFn: () => getEvalChatsByEvalRuns(runs!.map((run: EvalRun) => run.id)),
    enabled: !!runs && runs.length > 0,
  });

  const { data: grades, isLoading: isLoadingGrades } = useQuery({
    queryKey: ["evalGrades", evalChats?.map((chat: any) => chat.id)],
    queryFn: () =>
      getEvalChatGradesByEvalChats(evalChats!.map((chat: any) => chat.id)),
    enabled: !!evalChats && evalChats.length > 0,
  });

  // Fetch agent and rubric data for each run
  const { data: agents } = useQuery({
    queryKey: ["agents", runs?.map((run: EvalRun) => run.agentId)],
    queryFn: async () => {
      if (!runs) return [];
      const agentPromises = runs.map((run: EvalRun) => getAgent(run.agentId));
      return Promise.all(agentPromises);
    },
    enabled: !!runs && runs.length > 0,
  });

  const { data: rubrics } = useQuery({
    queryKey: ["rubrics", runs?.map((run: EvalRun) => run.rubricId)],
    queryFn: async () => {
      if (!runs) return [];
      const rubricPromises = runs.map((run: EvalRun) =>
        getRubric(run.rubricId)
      );
      return Promise.all(rubricPromises);
    },
    enabled: !!runs && runs.length > 0,
  });

  const handleRun = async (runId: string) => {
    if (runningEvals.has(runId)) {
      toast.error("This eval run is already running");
      return;
    }

    setRunningEvals((prev) => new Set(prev).add(runId));

    try {
      const formData = new FormData();
      formData.append("eval_run_id", runId);

      const response = await fetch(
        `${process.env["NEXT_PUBLIC_API_URL"]}/evals/run`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body reader available");
      }

      toast.success("Eval run started successfully");

      // Process the streaming response
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.done) {
                toast.success("Eval run completed successfully");
                // Invalidate queries to refresh data
                queryClient.invalidateQueries({ queryKey: ["evalChats"] });
                queryClient.invalidateQueries({ queryKey: ["evalRuns"] });
                queryClient.invalidateQueries({ queryKey: ["evalGrades"] });
                break;
              }

              if (data.type === "error") {
                toast.error(`Error: ${data.error}`);
                break;
              }

              if (data.type === "chat_start") {
                toast.info(`Starting chat: ${data.message}`);
              }

              if (data.type === "chat_complete") {
                toast.success(`Completed: ${data.message}`);
              }

              if (data.type === "evaluation_complete") {
                toast.success(`Evaluation completed for chat`);
              }
            } catch (parseError) {
              logError("Error parsing SSE data:", parseError);
            }
          }
        }
      }
    } catch (error) {
      logError("Error running eval:", error);
      toast.error(
        `Failed to run eval: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setRunningEvals((prev) => {
        const newSet = new Set(prev);
        newSet.delete(runId);
        return newSet;
      });
    }
  };

  const handleView = (runId: string) => {
    router.push(`/management/evals/e/${evalId}/r/${runId}`);
  };

  const handleDeleteClick = (
    id: string,
    agentName: string,
    rubricName: string
  ) => {
    setDeleteItem({ id, agentName, rubricName });
    setShowDeleteDialog(true);
  };

  const handleDelete = () => {
    // call mutation function to delete the eval run
  };

  const getRunStatus = (run: EvalRun) => {
    if (!evalChats) return "Unknown";

    const runChats = evalChats.filter((chat: any) => chat.evalRunId === run.id);
    const completedChats = runChats.filter((chat: any) => chat.completed);

    if (runChats.length === 0) return "No chats";
    if (completedChats.length === runChats.length) return "Completed";
    if (completedChats.length > 0) return "In Progress";
    return "Not Started";
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Completed":
        return "default";
      case "In Progress":
        return "secondary";
      case "Not Started":
        return "outline";
      default:
        return "outline";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getRunData = (run: EvalRun) => {
    const runChats =
      evalChats?.filter((chat: any) => chat.evalRunId === run.id) || [];
    const completedChats = runChats.filter((chat: any) => chat.completed);
    const runGrades =
      grades?.filter((grade: any) =>
        runChats.some((chat: any) => chat.id === grade.evalChatId)
      ) || [];
    const avgScore =
      runGrades.length > 0
        ? Math.round(
            runGrades.reduce(
              (sum: number, grade: any) => sum + grade.score,
              0
            ) / runGrades.length
          )
        : 0;

    const agent = agents?.find((agent: any) => agent?.id === run.agentId);
    const rubric = rubrics?.find((rubric: any) => rubric?.id === run.rubricId);

    return {
      runChats,
      completedChats,
      avgScore,
      agent,
      rubric,
    };
  };

  if (isLoadingRuns || isLoadingEvalChats || isLoadingGrades) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-sm text-muted-foreground">
            Loading evaluation runs...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Runs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
        {runs?.map((run: EvalRun) => {
          const status = getRunStatus(run);
          const isRunning = runningEvals.has(run.id);
          const { runChats, completedChats, avgScore, agent, rubric } =
            getRunData(run);

          return (
            <Card key={run.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-medium">
                      {agent?.name || "Unknown Agent"}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {rubric?.name || "No rubric"} •{" "}
                      {formatDate(run.createdAt)}
                    </CardDescription>
                  </div>
                  <Badge variant={getStatusVariant(status)} className="text-xs">
                    {status === "Completed" && (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    )}
                    {status === "In Progress" && (
                      <Clock className="h-3 w-3 mr-1" />
                    )}
                    {status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-semibold">
                      {runChats.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Chats</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">
                      {completedChats.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Completed
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{avgScore}</div>
                    <div className="text-xs text-muted-foreground">
                      Avg Score
                    </div>
                  </div>
                </div>

                {/* Recent Chats Preview */}
                {runChats.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Recent Chats
                    </div>
                    <div className="space-y-1">
                      {runChats.slice(0, 2).map((chat: any) => {
                        const chatGrade = grades?.find(
                          (g: any) => g.evalChatId === chat.id
                        );
                        return (
                          <div
                            key={chat.id}
                            className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => handleView(run.id)}
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                {chat.completed ? (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Clock className="h-3 w-3 text-yellow-500" />
                                )}
                                <span className="truncate max-w-[80px]">
                                  Chat {runChats.indexOf(chat) + 1}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {chatGrade && (
                                <Badge
                                  variant="outline"
                                  className="text-xs px-1 py-0"
                                >
                                  {chatGrade.score}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {runChats.length > 2 && (
                        <div className="text-xs text-muted-foreground text-center py-1">
                          +{runChats.length - 2} more chats
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleView(run.id)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRun(run.id)}
                    disabled={isRunning || status === "Completed"}
                    className="flex-1"
                  >
                    {isRunning ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    {isRunning ? "Running" : "Run"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleDeleteClick(
                        run.id,
                        agent?.name || "Unknown Agent",
                        rubric?.name || "No rubric"
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {runs?.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground space-y-2">
            <p className="text-lg">No evaluation runs found</p>
            <p className="text-sm">Create your first run to get started.</p>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the run "{deleteItem?.agentName} -{" "}
              {deleteItem?.rubricName}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
