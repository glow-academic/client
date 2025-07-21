/**
 * Rubrics.tsx
 * Used to display the rubrics page with all created rubrics and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Copy,
  Edit,
  FileCheck,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createRubric } from "@/utils/mutations/rubrics/create-rubric";
import { deleteRubric } from "@/utils/mutations/rubrics/delete-rubric";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

import TableRubric from "@/components/common/rubric/TableRubric";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Rubric, Simulation } from "@/types";

export default function Rubrics() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [affectedSimulations, setAffectedSimulations] = useState<Simulation[]>(
    []
  );
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);

  // Fetch rubrics data
  const { data: rubrics = [], refetch: refetchRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteRubric(deleteItem.id);
      logInfo("Rubric deleted successfully:", {
        id: deleteItem.id,
        name: deleteItem.name,
      });
      toast.success("Rubric deleted successfully");
      // Invalidate queries to ensure all components refresh
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
      refetchRubrics();
    } catch (error) {
      logError("Error deleting rubric:", error);
      toast.error("Failed to delete rubric");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (rubric: Rubric) => {
    // Only allow duplicating default rubrics
    if (!rubric.defaultRubric) {
      toast.error("This rubric cannot be duplicated");
      return;
    }

    setIsDuplicating(rubric.id);
    try {
      await createRubric({
        ...rubric,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        defaultRubric: false,
        name: `${rubric.name} Copy`,
      });
      logInfo("Rubric duplicated successfully:", {
        originalId: rubric.id,
        originalName: rubric.name,
      });
      toast.success(`Rubric "${rubric.name}" duplicated successfully`);
      // Invalidate queries to ensure all components refresh
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
      refetchRubrics();
    } catch (error) {
      logError("Error duplicating rubric:", error);
      toast.error("Failed to duplicate rubric");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    const rubricToDelete = rubrics.find((r) => r.id === id);
    if (rubricToDelete) {
      setDeleteItem({ id, name });
      setIsLoadingImpact(true);

      // Calculate impact - find simulations that use this rubric
      const affectedSims = simulations.filter(
        (sim) => sim.rubricId === rubricToDelete.id
      );

      setAffectedSimulations(affectedSims);
      setIsLoadingImpact(false);
      setShowDeleteDialog(true);
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/create/rubrics/r/${id}`);
  };

  const handleCreateNew = () => {
    router.push("/create/rubrics/new");
  };

  const canDuplicate = (rubric: Rubric) => {
    // Can only duplicate default rubrics
    return rubric.defaultRubric;
  };

  const getPassPercentage = (rubric: Rubric) => {
    if (!rubric.points || rubric.points === 0) return 0;
    return Math.round((rubric.passPoints / rubric.points) * 100);
  };

  return (
    <div className="space-y-8">
      {rubrics.map((rubric: Rubric) => {
        const passPercentage = getPassPercentage(rubric);

        return (
          <Card key={rubric.id} className="w-full">
            {/* Header */}
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl font-bold">
                    {rubric.name}
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      {rubric.points} total points
                    </div>
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4" />
                      Pass: {rubric.passPoints} pts ({passPercentage}%)
                    </div>
                    <Badge variant={rubric.active ? "default" : "secondary"}>
                      {rubric.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {rubric.description && (
                    <p className="text-sm text-muted-foreground max-w-2xl">
                      {rubric.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleEdit(rubric.id)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  {canDuplicate(rubric) && (
                    <Button
                      variant="outline"
                      onClick={() => handleDuplicate(rubric)}
                      disabled={isDuplicating === rubric.id}
                    >
                      {isDuplicating === rubric.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      Duplicate
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => handleDeleteClick(rubric.id, rubric.name)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Rubric Table */}
            <CardContent className="p-6">
              <TableRubric rubricId={rubric.id} />
            </CardContent>
          </Card>
        );
      })}

      {rubrics.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No rubrics yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first evaluation rubric to define assessment criteria
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Rubric
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rubric</AlertDialogTitle>
            <AlertDialogDescription>
              {isLoadingImpact ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Loading impact analysis...
                </div>
              ) : (
                <div className="space-y-3">
                  <p>
                    Are you sure you want to delete the rubric "
                    {deleteItem?.name}"? This action cannot be undone.
                  </p>

                  {affectedSimulations.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="font-medium text-red-800 mb-2">
                        ⚠️ Impact of deletion:
                      </div>

                      <div>
                        <span className="font-medium text-red-700">
                          {affectedSimulations.length} simulation
                          {affectedSimulations.length !== 1 ? "s" : ""} will be
                          affected:
                        </span>
                        <ul className="mt-1 list-disc list-inside text-sm text-red-600">
                          {affectedSimulations.slice(0, 3).map((sim) => (
                            <li key={sim.id}>{sim.title}</li>
                          ))}
                          {affectedSimulations.length > 3 && (
                            <li>
                              ...and {affectedSimulations.length - 3} more
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-sm font-medium text-red-700">
                    This action will permanently remove the rubric and cannot be
                    undone.
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || isLoadingImpact}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
