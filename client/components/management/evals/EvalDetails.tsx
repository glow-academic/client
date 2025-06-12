/**
 * components/management/evals/EvalDetails.tsx
 * Eval details component for the evals section. Will show all the eval runs under the eval. Allow the user to run the eval, hitting the /run endpoint.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { Play, Trash2 } from "lucide-react";

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
import { useQuery } from "@tanstack/react-query";
import { getEvalChatsByEvalRuns } from "@/utils/queries/eval_chats/get-eval-chats-by-evalruns";

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
    const { evalId } = use(params);

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
    });

    const handleRun = (runId: string) => {
       // call api to run the eval
    };

    const handleDeleteClick = (id: string, agentId: string, rubricId: string) => {
        setDeleteItem({ id, agentId, rubricId });
        setShowDeleteDialog(true);
    };

    const handleDelete = () => {
        // call mutation function to delete the eval run
    };



    return (
        <div className="space-y-6">
            <div className="grid gap-4">
                {runs?.map((run: EvalRun) => (
                    <Card key={run.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <CardTitle className="text-base">{run.agentId || 'Unnamed Agent'}</CardTitle>
                                    <CardDescription>{run.rubricId || 'No subtitle'}</CardDescription>
                                    <p className="text-sm text-muted-foreground">
                                        {run.createdAt || 'No description available'}
                                    </p>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <Badge variant="outline">
                                        {run.createdAt || 'No description available'}
                                    </Badge>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRun(run.id)}
                                    >
                                        <Play className="h-4 w-4" />
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
                ))}

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