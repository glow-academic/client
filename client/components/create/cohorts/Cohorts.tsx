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
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Cohort, Simulation } from "@/types";

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
  const [affectedSimulations, setAffectedSimulations] = useState<Simulation[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);

  // Fetch cohorts data
  const { data: cohorts = [], refetch: refetchCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  // Get table columns and filter options
  const { columns, profileOptions, simulationOptions, classOptions } =
    useCohortColumns();

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
    const cohortToDelete = cohorts.find((c) => c.id === id);
    if (cohortToDelete) {
      setDeleteItem({ id, name });
      setIsLoadingImpact(true);

      // Calculate impact
      const affectedSims = simulations.filter(
        (sim) => sim.cohortIds && sim.cohortIds.includes(id)
      );
      const memberCnt = cohortToDelete.profileIds?.length || 0;

      setAffectedSimulations(affectedSims);
      setMemberCount(memberCnt);
      setIsLoadingImpact(false);
      setShowDeleteDialog(true);
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/create/cohorts/c/${id}`);
  };

  const handleCreateNew = () => {
    router.push("/create/cohorts/new");
  };

  const canDuplicate = (cohort: Cohort) => {
    // Can only duplicate non-default cohorts
    return cohort.defaultCohort;
  };

  const renderCohortCard = (cohort: Cohort) => (
    <Card key={cohort.id} className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-base">{cohort.title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Users className="h-3 w-3" />
              {cohort.profileIds?.length || 0} members
            </CardDescription>
            {cohort.description && (
              <CardDescription className="text-xs line-clamp-2">
                {cohort.description}
              </CardDescription>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Badge variant={cohort.active ? "default" : "secondary"}>
              {cohort.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardFooter className="flex justify-end gap-2">
        {canDuplicate(cohort) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDuplicate(cohort)}
            disabled={isDuplicating === cohort.id}
          >
            <Copy className="h-4 w-4" />
            {isDuplicating === cohort.id ? "..." : ""}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEdit(cohort.id)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDeleteClick(cohort.id, cohort.title)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
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
          classOptions={classOptions}
          renderCohortCard={renderCohortCard}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cohort</AlertDialogTitle>
            <AlertDialogDescription>
              {isLoadingImpact ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Loading impact analysis...
                </div>
              ) : (
                <div className="space-y-3">
                  <p>
                    Are you sure you want to delete the cohort "
                    {deleteItem?.name}"? This action cannot be undone.
                  </p>

                  {(memberCount > 0 || affectedSimulations.length > 0) && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="font-medium text-red-800 mb-2">
                        ⚠️ Impact of deletion:
                      </div>

                      {memberCount > 0 && (
                        <div className="mb-2">
                          <span className="font-medium text-red-700">
                            {memberCount} member{memberCount !== 1 ? "s" : ""}{" "}
                            will lose access to cohort-based simulations
                          </span>
                        </div>
                      )}

                      {affectedSimulations.length > 0 && (
                        <div>
                          <span className="font-medium text-red-700">
                            {affectedSimulations.length} simulation
                            {affectedSimulations.length !== 1 ? "s" : ""} will
                            be affected:
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
                      )}
                    </div>
                  )}

                  <div className="mt-3 text-sm font-medium text-red-700">
                    This action will permanently remove the cohort and cannot be
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
