/**
 * Rubrics.tsx
 * Used to display the rubrics page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Edit, FileCheck, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deleteRubric } from "@/utils/mutations/rubrics/delete-rubric";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { duplicateRubric } from "@/utils/rubric/duplicate-rubric";

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
import { useProfile } from "@/contexts/profile-context";
import { useRubricColumns } from "@/hooks/use-rubric-columns";
import { Rubric } from "@/types";
import { RubricsDataTable } from "./RubricsDataTable";

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
  const { effectiveProfile } = useProfile();

  // Fetch rubrics data
  const {
    data: rubrics = [],
    refetch: refetchRubrics,
    isLoading: isRubricsLoading,
  } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  // Check if a rubric is being used by any simulations
  const isRubricInUse = (rubricId: string) => {
    return simulations.some((sim) => sim.rubricId === rubricId);
  };

  // Check if user can edit (admin/superadmin or rubric not in use)
  const canEditRubric = (rubricId: string) => {
    const isSuperAdmin =
      effectiveProfile?.role === "superadmin";
    return isSuperAdmin || !isRubricInUse(rubricId);
  };

  // Get table columns and filter options
  const {
    columns,
    passPointsOptions,
    totalPointsOptions,
    passPercentageOptions,
  } = useRubricColumns();

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
      await duplicateRubric(rubric.id, `${rubric.name} Copy`);
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
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/create/rubrics/r/${id}`);
  };

  const canDuplicate = (rubric: Rubric) => {
    // Can only duplicate default rubrics
    return rubric.defaultRubric;
  };

  const getPassPercentage = (rubric: Rubric) => {
    if (!rubric.points || rubric.points === 0) return 0;
    return Math.round((rubric.passPoints / rubric.points) * 100);
  };

  const renderRubricCard = (rubric: Rubric) => {
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
              {canEditRubric(rubric.id) && (
                <Button variant="outline" onClick={() => handleEdit(rubric.id)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
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
              {!isRubricInUse(rubric.id) && (
                <Button
                  variant="outline"
                  onClick={() => handleDeleteClick(rubric.id, rubric.name)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Rubric Table */}
        <CardContent className="p-6">
          <TableRubric rubricId={rubric.id} />
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {isRubricsLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading rubrics...</p>
        </div>
      ) : (
        <RubricsDataTable
          columns={columns}
          data={rubrics}
          passPointsOptions={passPointsOptions}
          totalPointsOptions={totalPointsOptions}
          passPercentageOptions={passPercentageOptions}
          renderRubricCard={renderRubricCard}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rubric</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the rubric "{deleteItem?.name}"?
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
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
