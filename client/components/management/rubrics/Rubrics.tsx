/**
 * Rubrics.tsx
 * Used to display the rubrics page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import {
  Copy,
  Edit,
  Eye,
  FileCheck,
  Loader2,
  Star,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ColumnDef } from "@tanstack/react-table";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/contexts/profile-context";
import { useLogger } from "@/lib/api/v2/hooks/logs";
import {
  useDeleteRubric,
  useDuplicateRubric,
  useRubricsList,
} from "@/lib/api/v2/hooks/rubrics";
import type { RubricItem } from "@/lib/api/v2/schemas/rubrics";
import { RubricsDataTable } from "./RubricsDataTable";

export default function Rubrics() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const { effectiveProfile } = useProfile();
  const log = useLogger();

  // Mutation hooks
  const deleteRubricMutation = useDeleteRubric();
  const duplicateRubricMutation = useDuplicateRubric();

  // V2 API: Single fetch with hierarchical data and permissions
  const filters = useMemo(
    () => ({
      profileId: effectiveProfile?.id || "",
    }),
    [effectiveProfile?.id]
  );

  const { data: rubricsData, isLoading } = useRubricsList(filters);
  const rubrics = useMemo(() => rubricsData?.rubrics || [], [rubricsData]);
  const standardGroupsMapping = useMemo(
    () => rubricsData?.standard_groups_mapping || {},
    [rubricsData]
  );
  const standardsMapping = useMemo(
    () => rubricsData?.standards_mapping || {},
    [rubricsData]
  );
  const departmentMapping = useMemo(
    () =>
      (rubricsData?.department_mapping as Record<
        string,
        { name: string; description: string }
      >) || {},
    [rubricsData]
  );

  // Build filter options
  const departmentOptions = useMemo(() => {
    return Object.entries(departmentMapping).map(([id, obj]) => ({
      value: id,
      label: obj?.name || id,
    }));
  }, [departmentMapping]);

  const passPointsOptions = [
    { value: "0-25", label: "0-25 points" },
    { value: "26-50", label: "26-50 points" },
    { value: "51-75", label: "51-75 points" },
    { value: "76-100", label: "76-100 points" },
    { value: "100+", label: "100+ points" },
  ];

  const totalPointsOptions = [
    { value: "0-25", label: "0-25 points" },
    { value: "26-50", label: "26-50 points" },
    { value: "51-75", label: "51-75 points" },
    { value: "76-100", label: "76-100 points" },
    { value: "100+", label: "100+ points" },
  ];

  const passPercentageOptions = [
    { value: "0-25", label: "0-25%" },
    { value: "26-50", label: "26-50%" },
    { value: "51-75", label: "51-75%" },
    { value: "76-100", label: "76-100%" },
  ];

  // Column definitions for TanStack Table
  const columns = useMemo<ColumnDef<RubricItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.getValue("name"),
        filterFn: (row, id, value) => {
          const name = String(row.getValue(id)).toLowerCase();
          const desc = String(row.original.description).toLowerCase();
          const query = String(value).toLowerCase();
          return name.includes(query) || desc.includes(query);
        },
      },
      // Hidden faceting column for Pass Points
      {
        id: "passPoints",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: RubricItem) => row.passPoints,
        filterFn: (row, _id, value: string[]) => {
          const passPoints = Number(row.getValue("passPoints"));
          return value.some((range) => {
            if (range === "100+") return passPoints >= 100;
            const [min, max] = range.split("-").map(Number);
            return (
              min !== undefined &&
              max !== undefined &&
              passPoints >= min &&
              passPoints <= max
            );
          });
        },
      },
      // Hidden faceting column for Total Points
      {
        id: "points",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: RubricItem) => row.points,
        filterFn: (row, _id, value: string[]) => {
          const points = Number(row.getValue("points"));
          return value.some((range) => {
            if (range === "100+") return points >= 100;
            const [min, max] = range.split("-").map(Number);
            return (
              min !== undefined &&
              max !== undefined &&
              points >= min &&
              points <= max
            );
          });
        },
      },
      // Hidden faceting column for Pass Percentage (computed)
      {
        id: "passPercentage",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: RubricItem) => {
          const points = row.points;
          if (!points || points === 0) return 0;
          return Math.round((row.passPoints / points) * 100);
        },
        filterFn: (row, _id, value: string[]) => {
          const percentage =
            row.original.points > 0
              ? Math.round(
                  (row.original.passPoints / row.original.points) * 100
                )
              : 0;
          return value.some((range) => {
            const [min, max] = range.split("-").map(Number);
            return (
              min !== undefined &&
              max !== undefined &&
              percentage >= min &&
              percentage <= max
            );
          });
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: RubricItem) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
    ],
    []
  );

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteRubricMutation.mutateAsync({ rubricId: deleteItem.id });
      await log.info("rubric.delete.success", {
        message: "Rubric deleted successfully",
        subject: { entityType: "rubric", entityId: deleteItem.id },
        context: {
          component: "Rubrics",
          function: "handleDelete",
          name: deleteItem.name,
        },
      });
      toast.success("Rubric deleted successfully");
    } catch (error) {
      await log.error("rubric.delete.failed", {
        message: "Error deleting rubric",
        subject: { entityType: "rubric", entityId: deleteItem?.id },
        context: { component: "Rubrics", function: "handleDelete" },
        error,
      });
      toast.error("Failed to delete rubric");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (rubric: RubricItem) => {
    if (!rubric.can_duplicate) {
      toast.error("This rubric cannot be duplicated");
      return;
    }

    setIsDuplicating(rubric.rubric_id);
    try {
      await duplicateRubricMutation.mutateAsync({
        rubricId: rubric.rubric_id,
      });
      await log.info("rubric.duplicate.success", {
        message: "Rubric duplicated successfully",
        subject: { entityType: "rubric", entityId: rubric.rubric_id },
        context: {
          component: "Rubrics",
          function: "handleDuplicate",
          originalName: rubric.name,
        },
      });
      toast.success(`Rubric "${rubric.name}" duplicated successfully`);
    } catch (error) {
      await log.error("rubric.duplicate.failed", {
        message: "Error duplicating rubric",
        subject: { entityType: "rubric", entityId: rubric.rubric_id },
        context: {
          component: "Rubrics",
          function: "handleDuplicate",
          originalName: rubric.name,
        },
        error,
      });
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
    router.push(`/management/rubrics/r/${id}`);
  };

  const getPassPercentage = (rubric: RubricItem) => {
    if (!rubric.points || rubric.points === 0) return 0;
    return Math.round((rubric.passPoints / rubric.points) * 100);
  };

  const renderRubricCard = (rubric: RubricItem) => {
    const passPercentage = getPassPercentage(rubric);

    return (
      <Card key={rubric.rubric_id} className="w-full">
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
              </div>
              {rubric.description && (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {rubric.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {rubric.can_edit ? (
                <Button
                  variant="outline"
                  onClick={() => handleEdit(rubric.rubric_id)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(rubric.rubric_id)}
                  aria-label={`View ${rubric.name}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {rubric.can_duplicate && (
                <Button
                  variant="outline"
                  onClick={() => handleDuplicate(rubric)}
                  disabled={isDuplicating === rubric.rubric_id}
                >
                  {isDuplicating === rubric.rubric_id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Duplicate
                </Button>
              )}
              {rubric.can_delete && (
                <Button
                  variant="outline"
                  onClick={() =>
                    handleDeleteClick(rubric.rubric_id, rubric.name)
                  }
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
          <TableRubric
            standardGroups={rubric.standard_groups}
            standardGroupsMapping={standardGroupsMapping}
            standardsMapping={standardsMapping}
          />
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <RubricsDataTable
          columns={columns}
          rubrics={rubrics}
          standardGroupsMapping={standardGroupsMapping}
          standardsMapping={standardsMapping}
          departmentOptions={departmentOptions}
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
            <AlertDialogCancel
              disabled={isDeleting || deleteRubricMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || deleteRubricMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting || deleteRubricMutation.isPending
                ? "Deleting..."
                : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
