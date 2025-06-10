/**
 * Evals.tsx
 * Used to display the evals page with all created evaluations and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Edit,
  Trash2,
  Play,
  Users,
  Bot,
  MessageSquare,
  Plus,
  FileCheck,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  TrendingUp,
} from "lucide-react";

import { getAllEvals } from "@/utils/queries/evals/get-all-evals";
import { deleteEval } from "@/utils/mutations/evals/delete-eval";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
import { getEvalRunsByEvals } from "@/utils/queries/eval_runs/get-eval-runs-by-evals";
import { Eval } from "@/types";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getEvalChatsByEvalRuns } from "@/utils/queries/eval_chats/get-eval-chats-by-evalruns";
import { getEvalChatGradesByEvalChats } from "@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-evalchats";
import { getEvalChatFeedbacksByEvalChatGrades } from "@/utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-evalchatgrades";

export default function Evals() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [runningEvalId, setRunningEvalId] = useState<string | null>(null);

  // Fetch evaluations data
  const { data: evals, refetch: refetchEvals } = useQuery({
    queryKey: ["evals"],
    queryFn: () => getAllEvals(),
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: evalRuns = [] } = useQuery({
    queryKey: ["evalRuns", evals?.map((evaluation: Eval) => evaluation.id)],
    queryFn: () => getEvalRunsByEvals(evals?.map((evaluation: Eval) => evaluation.id) || []),
    enabled: !!evals && evals.length > 0,
  });

  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups } = useQuery({
    queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
    queryFn: () =>
      getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
    enabled: !!rubrics && rubrics.length > 0,
  });

  const { data: standards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: chats } = useQuery({
    queryKey: ["evalChats", evalRuns?.map((evalRun) => evalRun.id)],
    queryFn: () =>
      getEvalChatsByEvalRuns(evalRuns!.map((evalRun) => evalRun.id)),
    enabled: !!evalRuns && evalRuns.length > 0,
  });

  const { data: grades } = useQuery({
    queryKey: ["evalGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getEvalChatGradesByEvalChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: feedbacks } = useQuery({
    queryKey: ["evalFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getEvalChatFeedbacksByEvalChatGrades(
        grades!.map((grade) => grade.id),
      ),
    enabled: !!grades && grades.length > 0,
  });

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteEval(deleteItem.id);

      toast.success("Evaluation deleted successfully");
      refetchEvals();
    } catch (error) {
      console.error("Error deleting evaluation:", error);
      toast.error("Failed to delete evaluation");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/management/evals/e/${id}`);
  };

  const handleRun = async (id: string) => {
    if (!classes) {
      toast.error("No classes found. Please contact an administrator.");
      return;
    }

    setRunningEvalId(id);
    try {
      toast.loading("Starting evaluation...");

      // Use the first available class for now
      const classId = classes[0].id;

      const formData = new FormData();
      formData.append("eval_id", id);
      formData.append("class_id", classId);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/evals/start`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.ok) {
        const data = await response.json();
        toast.success("Evaluation started successfully");
        
        // Navigate to the evaluation page
        router.push(`/e/${id}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
            response.statusText ||
            "Failed to start evaluation",
        );
      }
    } catch (error) {
      console.error("Error starting evaluation:", error);
      toast.error("Failed to start evaluation. Please try again.");
    } finally {
      setRunningEvalId(null);
    }
  };

  const handleCreateNew = () => {
    router.push("/management/evals/new");
  };

  const handleViewChat = (chatId: string) => {
    // Navigate to evaluation page with specific chat
    const evalRun = evalRuns.find(run => 
      chats?.some(chat => chat.id === chatId && chat.evalRunId === run.id)
    );
    if (evalRun) {
      router.push(`/e/${evalRun.evalId}?chatId=${chatId}`);
    }
  };

  const getEvalTypeBadge = (evalType: "student" | "ta") => {
    return evalType === "student"
      ? { variant: "default" as const, text: "Student", icon: Users }
      : { variant: "secondary" as const, text: "TA", icon: Bot };
  };

  const getComplexityBadge = (evaluation: Eval) => {
    const totalItems =
      evaluation.scenarioIds.filter((id) => id !== "RAY").length +
      evaluation.agentIds.filter((id) => id !== "RAY").length +
      evaluation.rubricIds.filter((id) => id !== "RAY").length;

    if (totalItems >= 10)
      return { variant: "destructive" as const, text: "Complex" };
    if (totalItems >= 5)
      return { variant: "default" as const, text: "Moderate" };
    return { variant: "outline" as const, text: "Simple" };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get eval runs with their chats for the carousel
  const evalRunsWithChats = evalRuns?.map(run => {
    const runChats = chats?.filter(chat => chat.evalRunId === run.id) || [];
    const runGrades = grades?.filter(grade => 
      runChats.some(chat => chat.id === grade.evalChatId)
    ) || [];
    
    return {
      ...run,
      chats: runChats,
      grades: runGrades,
    };
  }) || [];

  return (
    <div className="space-y-8">

      {/* Evaluations Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Evaluations</h2>
        {evals && evals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {evals.map((evaluation: Eval) => {
              const typeBadge = getEvalTypeBadge(evaluation.evalType);
              const complexityBadge = getComplexityBadge(evaluation);
              const TypeIcon = typeBadge.icon;

              return (
                <Card
                  key={evaluation.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-base">
                          {evaluation.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <TypeIcon className="h-3 w-3" />
                          {typeBadge.text} Evaluation
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant={typeBadge.variant}>{typeBadge.text}</Badge>
                        <Badge variant={complexityBadge.variant}>
                          {complexityBadge.text}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {evaluation.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {evaluation.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {
                            evaluation.scenarioIds.filter((id) => id !== "RAY")
                              .length
                          }{" "}
                          scenarios
                        </div>
                        <div className="flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          {
                            evaluation.agentIds.filter((id) => id !== "RAY").length
                          }{" "}
                          agents
                        </div>
                        <div className="flex items-center gap-1">
                          <FileCheck className="h-3 w-3" />
                          {
                            evaluation.rubricIds.filter((id) => id !== "RAY").length
                          }{" "}
                          rubrics
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {evaluation.maxTurns} max turns
                        </div>
                      </div>

                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Parallel runs: {evaluation.numParallelRuns}</span>
                          <span>Created: {formatDate(evaluation.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRun(evaluation.id)}
                      disabled={runningEvalId === evaluation.id}
                      className="text-green-600 hover:text-green-700"
                    >
                      {runningEvalId === evaluation.id ? (
                        <>
                          <div className="animate-spin h-3 w-3 border-2 border-green-600 border-t-transparent rounded-full mr-1" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Run
                        </>
                      )}
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(evaluation.id)}
                        aria-label="Edit evaluation"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDeleteClick(evaluation.id, evaluation.name)
                        }
                        aria-label="Delete evaluation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No evaluations yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first evaluation to start assessing agent performance
              </p>
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Evaluation
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Past Evaluation Runs */}
      {evalRunsWithChats.length > 0 && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Recent Evaluation Runs</h2>
            <p className="text-sm text-muted-foreground">
              View past evaluation runs and their results
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {evalRunsWithChats.map((evalRun) => {
              const evaluation = evals?.find(e => e.id === evalRun.evalId);
              const completedChats = evalRun.chats.filter(chat => chat.completedAt);
              const avgScore = evalRun.grades.length > 0 
                ? Math.round(evalRun.grades.reduce((sum, grade) => sum + grade.score, 0) / evalRun.grades.length)
                : 0;

              return (
                <Card 
                  key={evalRun.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/e/${evalRun.evalId}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-medium">
                          {evaluation?.name || "Unknown Evaluation"}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Run {evalRunsWithChats.indexOf(evalRun) + 1} • {formatDate(evalRun.createdAt)}
                        </CardDescription>
                      </div>
                      {completedChats.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-lg font-semibold">{evalRun.chats.length}</div>
                          <div className="text-xs text-muted-foreground">Chats</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold">{completedChats.length}</div>
                          <div className="text-xs text-muted-foreground">Completed</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold">{avgScore}</div>
                          <div className="text-xs text-muted-foreground">Avg Score</div>
                        </div>
                      </div>

                      {/* Recent Chats */}
                      {evalRun.chats.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Recent Chats</div>
                          <div className="space-y-1">
                            {evalRun.chats.slice(0, 2).map((chat) => {
                              const chatGrade = grades?.find(g => g.evalChatId === chat.id);
                              return (
                                <div 
                                  key={chat.id}
                                  className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs hover:bg-muted/50 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewChat(chat.id);
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      {chat.completedAt ? (
                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                      ) : (
                                        <Clock className="h-3 w-3 text-yellow-500" />
                                      )}
                                      <span className="truncate max-w-[120px]">
                                        {chat.title || "Untitled Chat"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {chatGrade && (
                                      <Badge variant="outline" className="text-xs px-1 py-0">
                                        {chatGrade.score}
                                      </Badge>
                                    )}
                                    <Eye className="h-3 w-3" />
                                  </div>
                                </div>
                              );
                            })}
                            {evalRun.chats.length > 2 && (
                              <div className="text-xs text-muted-foreground text-center py-1">
                                +{evalRun.chats.length - 2} more chats
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the evaluation "{deleteItem?.name}".
              This action cannot be undone and will remove all associated
              evaluation runs and results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
