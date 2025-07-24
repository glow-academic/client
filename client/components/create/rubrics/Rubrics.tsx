/**
 * Rubrics.tsx
 * Used to display the rubrics page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
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
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";

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
  const { data: rubrics = [], refetch: refetchRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  // Fetch standard groups for all rubrics
  const { data: standardGroups = [] } = useQuery({
    queryKey: ["standardGroups", rubrics.map((r) => r.id)],
    queryFn: () => getStandardGroupsByRubrics(rubrics.map((r) => r.id)),
    enabled: rubrics.length > 0,
  });

  // Check if a rubric is being used by any simulations
  const isRubricInUse = (rubricId: string) => {
    return simulations.some((sim) => sim.rubricId === rubricId);
  };

  // Check if user can edit (admin/superadmin or rubric not in use)
  const canEditRubric = (rubricId: string) => {
    const isAdmin =
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin";
    return isAdmin || !isRubricInUse(rubricId);
  };

  // Get table columns and filter options
  const {
    columns,
    passPointsOptions,
    totalPointsOptions,
    passPercentageOptions,
  } = useRubricColumns();

  // Helper function to get standard groups count for a rubric
  const getStandardGroupsCount = (rubricId: string) => {
    return standardGroups.filter((sg) => sg.rubricId === rubricId).length;
  };

  // Helper function to get simulations count for a rubric
  const getSimulationsCount = (rubricId: string) => {
    return simulations.filter((sim) => sim.rubricId === rubricId).length;
  };

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
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
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

  const renderRubricCard = (rubric: Rubric) => {
    const passPercentage = getPassPercentage(rubric);
    const standardGroupsCount = getStandardGroupsCount(rubric.id);
    const simulationsCount = getSimulationsCount(rubric.id);

    return (
      <Card
        key={rubric.id}
        aria-label={rubric.name}
        data-testid={`card-${rubric.id}`}
        className="relative flex flex-col h-full"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{rubric.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">
                  <Star className="h-3 w-3 mr-1" />
                  {rubric.points} total points
                </Badge>
                <Badge variant={rubric.active ? "default" : "secondary"}>
                  {rubric.active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant={rubric.defaultRubric ? "outline" : "secondary"}>
                  {rubric.defaultRubric ? "Default" : "Custom"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canEditRubric(rubric.id) && (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`edit-${rubric.id}`}
                  onClick={() => handleEdit(rubric.id)}
                  aria-label={`Edit ${rubric.name}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {canDuplicate(rubric) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicate(rubric)}
                  disabled={isDuplicating === rubric.id}
                  aria-label={`Duplicate ${rubric.name}`}
                >
                  {isDuplicating === rubric.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
              {!isRubricInUse(rubric.id) && (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`delete-${rubric.id}`}
                  onClick={() => handleDeleteClick(rubric.id, rubric.name)}
                  aria-label={`Delete ${rubric.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-grow flex flex-col">
          <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
            {rubric.description || "No description available"}
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <FileCheck className="h-3 w-3" />
            Pass: {rubric.passPoints} pts ({passPercentage}%) •{" "}
            {standardGroupsCount} standard groups • {simulationsCount}{" "}
            simulations
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <div className="col-span-full">
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
    </div>
  );

  return (
    <div className="space-y-6">
      {rubrics.length === 0 ? (
        renderEmptyState()
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
