/**
 * Cohorts.tsx
 * Used to display the cohorts page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import {
  Copy,
  Edit,
  Eye,
  LogOut,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  useCohortsList,
  useDeleteCohort,
  useDuplicateCohort,
  useLeaveCohort,
} from "@/lib/api/v2/hooks/cohorts";
import { CohortItem } from "@/lib/api/v2/schemas/cohorts";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";

export default function Cohorts() {
  const router = useRouter();
  const { effectiveProfile, isLoading: isProfileLoading } = useProfile();
  const { effectiveDepartmentIds } = useDepartments();

  // V2 API hooks - single fetch with all data (pre-filtered by role)
  const { data: cohortsData, isLoading: loadingCohorts } = useCohortsList(
    {
      departmentIds: effectiveDepartmentIds,
      profileId: effectiveProfile?.id || "",
    },
    { enabled: !!effectiveProfile?.id && effectiveDepartmentIds.length > 0 }
  );

  // Mutation hooks
  const duplicateCohortMutation = useDuplicateCohort();
  const deleteCohortMutation = useDeleteCohort();
  const leaveCohortMutation = useLeaveCohort();

  // Extract data from V2 response
  const cohorts = useMemo(
    () => cohortsData?.cohorts || [],
    [cohortsData?.cohorts]
  );
  const profileMapping = useMemo(
    () => cohortsData?.profile_mapping || {},
    [cohortsData?.profile_mapping]
  );
  const simulationMapping = useMemo(
    () => cohortsData?.simulation_mapping || {},
    [cohortsData?.simulation_mapping]
  );

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaveItem, setLeaveItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  // Create filter options from mappings
  const profileOptions = useMemo(() => {
    return Object.entries(profileMapping).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [profileMapping]);

  const simulationOptions = useMemo(() => {
    return Object.entries(simulationMapping).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [simulationMapping]);

  const isLoading = isProfileLoading || !effectiveProfile || loadingCohorts;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Cohorts grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex space-x-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-3" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Permissions now come from server-side in V2 API
  // Cohorts are pre-filtered by role on the server
  // No need for client-side permission or filtering logic

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteCohortMutation.mutateAsync({ cohortId: deleteItem.id });
      await log.info("cohort.delete.success", {
        message: "Cohort deleted successfully",
        subject: { entityType: "cohort", entityId: deleteItem.id },
        context: {
          component: "Cohorts",
          function: "handleDelete",
          name: deleteItem.name,
        },
      });
      toast.success("Cohort deleted successfully");
    } catch (error) {
      await log.error("cohort.delete.failed", {
        message: "Error deleting cohort",
        subject: { entityType: "cohort", entityId: deleteItem?.id },
        context: { component: "Cohorts", function: "handleDelete" },
        error,
      });
      toast.error("Failed to delete cohort");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleLeave = async () => {
    if (!leaveItem) return;

    setIsLeaving(true);
    try {
      await leaveCohortMutation.mutateAsync({
        cohortId: leaveItem.id,
        profileId: effectiveProfile?.id || "",
      });

      await log.info("cohort.leave.success", {
        message: "Left cohort successfully",
        subject: { entityType: "cohort", entityId: leaveItem.id },
        context: {
          component: "Cohorts",
          function: "handleLeave",
          name: leaveItem.name,
        },
      });
      toast.success("Left cohort successfully");
    } catch (error) {
      await log.error("cohort.leave.failed", {
        message: "Error leaving cohort",
        subject: { entityType: "cohort", entityId: leaveItem?.id },
        context: { component: "Cohorts", function: "handleLeave" },
        error,
      });
      toast.error("Failed to leave cohort");
    } finally {
      setIsLeaving(false);
      setShowLeaveDialog(false);
      setLeaveItem(null);
    }
  };

  const handleDuplicate = async (cohortId: string, cohortName: string) => {
    setIsDuplicating(cohortId);
    try {
      await duplicateCohortMutation.mutateAsync({ cohortId });
      await log.info("cohort.duplicate.success", {
        message: "Cohort duplicated successfully",
        subject: { entityType: "cohort", entityId: cohortId },
        context: {
          component: "Cohorts",
          function: "handleDuplicate",
          originalTitle: cohortName,
        },
      });
      toast.success(`Cohort "${cohortName}" duplicated successfully`);
    } catch (error) {
      await log.error("cohort.duplicate.failed", {
        message: "Error duplicating cohort",
        subject: { entityType: "cohort", entityId: cohortId },
        context: {
          component: "Cohorts",
          function: "handleDuplicate",
          originalTitle: cohortName,
        },
        error,
      });
      toast.error("Failed to duplicate cohort");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleLeaveClick = (id: string, name: string) => {
    setLeaveItem({ id, name });
    setShowLeaveDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/cohorts/e/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/cohorts/e/${id}`);
  };

  const handleCreateNew = () => {
    router.push("/cohorts/new");
  };

  const renderCohortCard = (cohort: CohortItem) => (
    <Card
      key={cohort.cohort_id}
      aria-label={cohort.name}
      data-testid={`card-${cohort.cohort_id}`}
      className="relative flex flex-col h-full"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{cohort.name}</CardTitle>
            <div className="mt-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  {cohort.num_members} members
                </Badge>
              </div>
              {!cohort.active && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Inactive</Badge>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {cohort.can_edit ? (
              <Button
                variant="outline"
                size="sm"
                data-testid={`edit-${cohort.cohort_id}`}
                onClick={() => handleEdit(cohort.cohort_id)}
                aria-label={`Edit ${cohort.name}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                data-testid={`view-${cohort.cohort_id}`}
                onClick={() => handleView(cohort.cohort_id)}
                aria-label={`View ${cohort.name}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {cohort.can_duplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(cohort.cohort_id, cohort.name)}
                disabled={
                  isDuplicating === cohort.cohort_id ||
                  duplicateCohortMutation.isPending
                }
                aria-label={`Duplicate ${cohort.name}`}
              >
                {isDuplicating === cohort.cohort_id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {cohort.can_delete && (
              <Button
                variant="outline"
                size="sm"
                data-testid={`delete-${cohort.cohort_id}`}
                onClick={() => handleDeleteClick(cohort.cohort_id, cohort.name)}
                aria-label={`Delete ${cohort.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {cohort.can_leave && (
              <Button
                variant="outline"
                size="sm"
                data-testid={`leave-${cohort.cohort_id}`}
                onClick={() => handleLeaveClick(cohort.cohort_id, cohort.name)}
                aria-label={`Leave ${cohort.name}`}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col justify-end">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {cohort.description || "No description available"}
        </p>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {cohort.num_members} members
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
          data={cohorts}
          profileMapping={profileMapping}
          simulationMapping={simulationMapping}
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

      {/* Leave Cohort Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Cohort</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to leave the cohort "{leaveItem?.name}"?
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              disabled={isLeaving}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isLeaving ? "Leaving..." : "Leave Cohort"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
