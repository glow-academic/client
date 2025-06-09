/**
 * Evals.tsx
 * Used to display the evals page with all created evaluations and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit, Trash2, Play, Users, Bot, MessageSquare, Plus, FileCheck, Clock, Settings } from "lucide-react";

import { getAllEvals } from "@/utils/queries/evals/get-all-evals";
import { deleteEval } from "@/utils/mutations/evals/delete-eval";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
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

// Types
interface Eval {
  id: string;
  name: string;
  description: string;
  classId: string | null;
  baseAgentId: string;
  scenarioIds: string[];
  agentIds: string[];
  evalType: "student" | "ta";
  maxTurns: number;
  numParallelRuns: number;
  rubricIds: string[];
  createdAt: string;
}

export default function Evals() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch evaluations data
  const { data: evals = [], refetch: refetchEvals } = useQuery({
    queryKey: ["evals"],
    queryFn: () => getAllEvals(),
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

  const handleRun = (id: string) => {
    // TODO: Implement evaluation run functionality
    toast.info("Evaluation run functionality coming soon!");
  };

  const handleCreateNew = () => {
    router.push("/management/evals/new");
  };

  const getEvalTypeBadge = (evalType: "student" | "ta") => {
    return evalType === "student" 
      ? { variant: "default" as const, text: "Student", icon: Users }
      : { variant: "secondary" as const, text: "TA", icon: Bot };
  };

  const getComplexityBadge = (evaluation: Eval) => {
    const totalItems = evaluation.scenarioIds.filter(id => id !== "RAY").length + 
                      evaluation.agentIds.filter(id => id !== "RAY").length + 
                      evaluation.rubricIds.filter(id => id !== "RAY").length;
    
    if (totalItems >= 10) return { variant: "destructive" as const, text: "Complex" };
    if (totalItems >= 5) return { variant: "default" as const, text: "Moderate" };
    return { variant: "outline" as const, text: "Simple" };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Evaluations</h2>
          <p className="text-muted-foreground">
            Manage your evaluation configurations and run assessments
          </p>
        </div>
        <Button onClick={handleCreateNew} className="bg-primary text-primary-foreground">
          <Settings className="h-4 w-4 mr-2" />
          Create New Evaluation
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {evals.map((evaluation: Eval) => {
          const typeBadge = getEvalTypeBadge(evaluation.evalType);
          const complexityBadge = getComplexityBadge(evaluation);
          const TypeIcon = typeBadge.icon;
          
          return (
            <Card key={evaluation.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                                  <div className="space-y-1">
                  <CardTitle className="text-base">{evaluation.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <TypeIcon className="h-3 w-3" />
                    {typeBadge.text} Evaluation
                  </CardDescription>
                </div>
                  <div className="flex gap-1">
                    <Badge variant={typeBadge.variant}>
                      {typeBadge.text}
                    </Badge>
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
                      {evaluation.scenarioIds.filter(id => id !== "RAY").length} scenarios
                    </div>
                    <div className="flex items-center gap-1">
                      <Bot className="h-3 w-3" />
                      {evaluation.agentIds.filter(id => id !== "RAY").length} agents
                    </div>
                    <div className="flex items-center gap-1">
                      <FileCheck className="h-3 w-3" />
                      {evaluation.rubricIds.filter(id => id !== "RAY").length} rubrics
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
                  className="text-green-600 hover:text-green-700"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Run
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(evaluation.id)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteClick(evaluation.id, evaluation.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })}
        
        {evals.length === 0 && (
          <div className="col-span-full">
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
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the evaluation "{deleteItem?.name}". 
              This action cannot be undone and will remove all associated evaluation runs and results.
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