/**
 * Cohorts.tsx
 * Used to display the cohorts page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Edit, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useCohortColumns } from "@/hooks/use-cohort-columns";
import { createCohort } from "@/utils/mutations/cohorts/create-cohort";
import { deleteCohort } from "@/utils/mutations/cohorts/delete-cohort";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { CohortsDataTable } from "./CohortsDataTable";

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
import { Cohort } from "@/types";

export default function Cohorts() {
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

  // Fetch cohorts data
  const { data: cohorts = [], refetch: refetchCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Check if a cohort is being used (has members)
  const isCohortInUse = (cohortId: string) => {
    const cohort = cohorts.find((c) => c.id === cohortId);
    if (!cohort) return false;

    // Check if cohort has members
    return cohort.profileIds && cohort.profileIds.length > 0;
  };

  // Check if user can edit (admin/superadmin or cohort not in use)
  const canEditCohort = (cohortId: string) => {
    const isAdmin =
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin";
    return isAdmin || !isCohortInUse(cohortId);
  };

  // Get table columns and filter options
  const { columns, profileOptions, simulationOptions } = useCohortColumns();

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteCohort(deleteItem.id);
      logInfo("Cohort deleted successfully:", {
        id: deleteItem.id,
        name: deleteItem.name,
      });
      toast.success("Cohort deleted successfully");
      // Invalidate queries to ensure all components refresh
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
      refetchCohorts();
    } catch (error) {
      logError("Error deleting cohort:", error);
      toast.error("Failed to delete cohort");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (cohort: Cohort) => {
    // Only allow duplicating non-default cohorts
    if (!cohort.defaultCohort) {
      toast.error("This cohort cannot be duplicated");
      return;
    }

    setIsDuplicating(cohort.id);
    try {
      await createCohort({
        ...cohort,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        defaultCohort: false,
        title: `${cohort.title} Copy`,
      });
      logInfo("Cohort duplicated successfully:", {
        originalId: cohort.id,
        originalTitle: cohort.title,
      });
      toast.success(`Cohort "${cohort.title}" duplicated successfully`);
      // Invalidate queries to ensure all components refresh
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
      refetchCohorts();
    } catch (error) {
      logError("Error duplicating cohort:", error);
      toast.error("Failed to duplicate cohort");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/cohorts/c/${id}/edit`);
  };

  const handleCreateNew = () => {
    router.push("/cohorts/new");
  };

  const canDuplicate = (cohort: Cohort) => {
    // Can only duplicate non-default cohorts
    return cohort.defaultCohort;
  };

  const renderCohortCard = (cohort: Cohort) => (
    <Card
      key={cohort.id}
      aria-label={cohort.title}
      data-testid={`card-${cohort.id}`}
      className="relative flex flex-col h-full"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{cohort.title}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                {cohort.profileIds?.length || 0} members
              </Badge>
              <Badge variant={cohort.active ? "default" : "secondary"}>
                {cohort.active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canDuplicate(cohort) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(cohort)}
                disabled={isDuplicating === cohort.id}
                aria-label={`Duplicate ${cohort.title}`}
              >
                {isDuplicating === cohort.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {canEditCohort(cohort.id) && (
              <Button
                variant="outline"
                size="sm"
                data-testid={`edit-${cohort.id}`}
                onClick={() => handleEdit(cohort.id)}
                aria-label={`Edit ${cohort.title}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {!isCohortInUse(cohort.id) && (
              <Button
                variant="outline"
                size="sm"
                data-testid={`delete-${cohort.id}`}
                onClick={() => handleDeleteClick(cohort.id, cohort.title)}
                aria-label={`Delete ${cohort.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col">
        <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
          {cohort.description || "No description available"}
        </p>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {cohort.profileIds?.length || 0} members •{" "}
          {cohort.simulationIds?.length || 0} simulations
        </div>
      </CardContent>
    </Card>
  );

  const renderEmptyState = () => (
    <div className="col-span-full">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No cohorts yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first cohort to organize students into groups
          </p>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Cohort
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {cohorts.length === 0 ? (
        renderEmptyState()
      ) : (
        <CohortsDataTable
          columns={columns}
          data={cohorts}
          profileOptions={profileOptions}
          simulationOptions={simulationOptions}
          renderCohortCard={renderCohortCard}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cohort</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the cohort "{deleteItem?.name}"?
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
