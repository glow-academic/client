/**
 * Cohorts.tsx
 * Used to display the cohorts page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { log } from "@/utils/logger";
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
import { useState } from "react";
import { toast } from "sonner";

import { useCohortColumns } from "@/hooks/use-cohort-columns";
import {
  useCohorts,
  useCreateCohort,
  useDeleteCohort,
} from "@/lib/api/hooks/cohorts";
import { useProfiles } from "@/lib/api/hooks/profiles";
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
import { useProfile } from "@/contexts/profile-context";
import { useUpdateCohort } from "@/lib/api/hooks/cohorts";
import { Cohort } from "@/types";

export default function Cohorts() {
  const router = useRouter();
  // Fetch cohorts data
  const { data: cohorts = [], isLoading: loadingCohorts } = useCohorts();

  // Fetch profiles data for role checking
  const { data: profiles = [], isLoading: loadingProfiles } = useProfiles();

  // Mutation hooks
  const createCohortMutation = useCreateCohort();
  const deleteCohortMutation = useDeleteCohort();
  const updateCohortMutation = useUpdateCohort();

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
  const { effectiveProfile, isLoading: isProfileLoading } = useProfile();

  // Get table columns and filter options - must be called before loading check
  const { columns, profileOptions, simulationOptions } = useCohortColumns();

  const isLoading =
    isProfileLoading || !effectiveProfile || loadingCohorts || loadingProfiles;

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

  // Check if a cohort is being used (has members)
  const isCohortInUse = (cohortId: string) => {
    const cohort = cohorts.find((c) => c.id === cohortId);
    if (!cohort) return false;

    // Check if cohort has members
    return cohort.profileIds && cohort.profileIds.length > 0;
  };

  // Check if a cohort can be deleted (inactive or no members)
  const canDeleteCohort = (cohortId: string) => {
    const cohort = cohorts.find((c) => c.id === cohortId);
    if (!cohort) return false;

    // Can delete if cohort is inactive
    if (!cohort.active) {
      return true;
    }

    // For active cohorts, check if there are any TA members
    const cohortProfiles = profiles.filter((profile) =>
      cohort.profileIds?.includes(profile.id),
    );
    const hasTAMembers = cohortProfiles.some(
      (profile) => profile.role === "ta",
    );

    // Cannot delete active cohorts that have TA members
    if (hasTAMembers) {
      return false;
    }

    // For active cohorts without TA members, check if user is the only member
    if (effectiveProfile?.role === "instructional") {
      // Can delete if the user is the only member in the cohort
      return (
        cohortProfiles.length === 1 &&
        cohortProfiles[0]?.id === effectiveProfile.id
      );
    }

    // Admin/superadmin can delete active cohorts without TA members
    const isAdmin =
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin";
    if (isAdmin) {
      return true;
    }

    return false;
  };

  // Check if user can leave the cohort
  const canLeaveCohort = (cohortId: string) => {
    const cohort = cohorts.find((c) => c.id === cohortId);
    if (!cohort) return false;

    // Only instructional users can leave cohorts
    if (effectiveProfile?.role !== "instructional") return false;

    // Check if user is in the cohort
    const isUserInCohort = cohort.profileIds?.includes(
      effectiveProfile?.id || "",
    );
    if (!isUserInCohort) return false;

    // Check if there are other instructional users in the cohort
    const cohortProfiles = profiles.filter((profile) =>
      cohort.profileIds?.includes(profile.id),
    );
    const instructionalProfiles = cohortProfiles.filter(
      (profile) => profile.role === "instructional",
    );

    // Can leave if there are other instructional users (not the only one)
    return instructionalProfiles.length > 1;
  };

  // Check if user can edit (admin/superadmin, cohort not in use, or user is in cohort)
  const canEditCohort = (cohortId: string) => {
    const isAdmin =
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin";

    const cohort = cohorts.find((c) => c.id === cohortId);
    if (!cohort) return false;

    // Only superadmins can edit default cohorts
    if (cohort.defaultCohort && effectiveProfile?.role !== "superadmin") {
      return false;
    }

    if (isAdmin) return true;

    // Check if user's profile is in the cohort's profileIds
    const isUserInCohort = cohort.profileIds?.includes(
      effectiveProfile?.id || "",
    );

    return isUserInCohort || !isCohortInUse(cohortId);
  };

  // Filter cohorts based on user role
  const filteredCohorts = cohorts.filter((cohort) => {
    const isAdmin =
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin";

    // Admin/superadmin can see all cohorts
    if (isAdmin) return true;

    // Instructional users can only see cohorts they're in
    if (effectiveProfile?.role === "instructional") {
      return cohort.profileIds?.includes(effectiveProfile?.id || "");
    }

    // Other roles can see all cohorts
    return true;
  });

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteCohortMutation.mutateAsync(deleteItem.id);
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
      // Remove the current user from the cohort
      const cohort = cohorts.find((c) => c.id === leaveItem.id);
      if (!cohort) {
        toast.error("Cohort not found");
        return;
      }

      const updatedProfileIds =
        cohort.profileIds?.filter((id) => id !== effectiveProfile?.id) || [];

      // Update the cohort to remove the current user
      await updateCohortMutation.mutateAsync({
        id: leaveItem.id,
        profileIds: updatedProfileIds,
        updatedAt: new Date().toISOString(),
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

  const handleDuplicate = async (cohort: Cohort) => {
    setIsDuplicating(cohort.id);
    try {
      await createCohortMutation.mutateAsync({
        ...cohort,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        defaultCohort: false,
        active: false,
        title: `${cohort.title} Copy`,
      });
      await log.info("cohort.duplicate.success", {
        message: "Cohort duplicated successfully",
        subject: { entityType: "cohort", entityId: cohort.id },
        context: {
          component: "Cohorts",
          function: "handleDuplicate",
          originalTitle: cohort.title,
        },
      });
      toast.success(`Cohort "${cohort.title}" duplicated successfully`);
    } catch (error) {
      await log.error("cohort.duplicate.failed", {
        message: "Error duplicating cohort",
        subject: { entityType: "cohort", entityId: cohort.id },
        context: {
          component: "Cohorts",
          function: "handleDuplicate",
          originalTitle: cohort.title,
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
            <div className="mt-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  {cohort.profileIds?.length || 0} members
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
            {canEditCohort(cohort.id) ? (
              <Button
                variant="outline"
                size="sm"
                data-testid={`edit-${cohort.id}`}
                onClick={() => handleEdit(cohort.id)}
                aria-label={`Edit ${cohort.title}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                data-testid={`view-${cohort.id}`}
                onClick={() => handleView(cohort.id)}
                aria-label={`View ${cohort.title}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
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
            {canDeleteCohort(cohort.id) && (
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
            {canLeaveCohort(cohort.id) && (
              <Button
                variant="outline"
                size="sm"
                data-testid={`leave-${cohort.id}`}
                onClick={() => handleLeaveClick(cohort.id, cohort.title)}
                aria-label={`Leave ${cohort.title}`}
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
      {filteredCohorts.length === 0 ? (
        renderEmptyState()
      ) : (
        <CohortsDataTable
          columns={columns}
          data={filteredCohorts}
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
