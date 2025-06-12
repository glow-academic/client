/**
 * components/management/evals/EvalDetails.tsx
 * Eval details component for the evals section. Will show all the eval runs under the eval. Allow the user to run the eval, hitting the /run endpoint.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { Play, Trash2, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { EvalRun } from "@/types";
import { getEvalRunsByEval } from "@/utils/queries/eval_runs/get-eval-runs-by-eval";
import { getEval } from "@/utils/queries/evals/get-eval";
import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getEvalChatsByEvalRuns } from "@/utils/queries/eval_chats/get-eval-chats-by-evalruns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function EvalDetails({
    params,
}: {
    params: Promise<{ evalId: string }>;
}) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteItem, setDeleteItem] = useState<{
        id: string;
        agentId: string;
        rubricId: string;
    } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [runningEvals, setRunningEvals] = useState<Set<string>>(new Set());
    const { evalId } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();

    const { data: evalData, isLoading: isLoadingEval } = useQuery({
        queryKey: ["eval", evalId],
        queryFn: () => getEval(evalId),
    });

    const { data: runs, isLoading: isLoadingRuns } = useQuery({
        queryKey: ["evalRuns", evalId],
        queryFn: () => getEvalRunsByEval(evalId),
    });

    const {data: evalChats, isLoading: isLoadingEvalChats} = useQuery({
        queryKey: ["evalChats", runs?.map((run: EvalRun) => run.id)],
        queryFn: () => getEvalChatsByEvalRuns(runs!.map((run: EvalRun) => run.id)),
        enabled: !!runs && runs.length > 0,
    });

    const handleRun = async (runId: string) => {
        if (runningEvals.has(runId)) {
            toast.error("This eval run is already running");
            return;
        }

        setRunningEvals(prev => new Set(prev).add(runId));
        
        try {
            const formData = new FormData();
            formData.append('eval_run_id', runId);

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/evals/run`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body reader available');
            }

            toast.success("Eval run started successfully");

            // Process the streaming response
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.done) {
                                toast.success("Eval run completed successfully");
                                // Invalidate queries to refresh data
                                queryClient.invalidateQueries({ queryKey: ["evalChats"] });
                                queryClient.invalidateQueries({ queryKey: ["evalRuns"] });
                                break;
                            }
                            
                            if (data.type === 'error') {
                                toast.error(`Error: ${data.error}`);
                                break;
                            }
                            
                            if (data.type === 'chat_start') {
                                toast.info(`Starting chat: ${data.message}`);
                            }
                            
                            if (data.type === 'chat_complete') {
                                toast.success(`Completed: ${data.message}`);
                            }
                            
                            if (data.type === 'evaluation_complete') {
                                toast.success(`Evaluation completed for chat`);
                            }
                            
                        } catch (parseError) {
                            console.error('Error parsing SSE data:', parseError);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error running eval:', error);
            toast.error(`Failed to run eval: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setRunningEvals(prev => {
                const newSet = new Set(prev);
                newSet.delete(runId);
                return newSet;
            });
        }
    };

    const handleView = (runId: string) => {
        router.push(`/management/evals/run/${runId}`);
    };

    const handleDeleteClick = (id: string, agentId: string, rubricId: string) => {
        setDeleteItem({ id, agentId, rubricId });
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
            case "Completed": return "default";
            case "In Progress": return "secondary";
            case "Not Started": return "outline";
            default: return "outline";
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4">
                {runs?.map((run: EvalRun) => {
                    const status = getRunStatus(run);
                    const isRunning = runningEvals.has(run.id);
                    
                    return (
                        <Card key={run.id} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base">{run.agentId || 'Unnamed Agent'}</CardTitle>
                                        <CardDescription>{run.rubricId || 'No rubric'}</CardDescription>
                                        <p className="text-sm text-muted-foreground">
                                            Created: {new Date(run.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <Badge variant={getStatusVariant(status)}>
                                            {status}
                                        </Badge>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleView(run.id)}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleRun(run.id)}
                                            disabled={isRunning || status === "Completed"}
                                        >
                                            {isRunning ? (
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            ) : (
                                                <Play className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDeleteClick(run.id, run.agentId || 'Unnamed Agent', run.rubricId || 'No rubric')}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>
                    );
                })}

                {runs?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        No runs found. Create your first run to get started.
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the run "{deleteItem?.agentId} - {deleteItem?.rubricId} - {deleteItem?.id}". This
                            action cannot be undone.
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