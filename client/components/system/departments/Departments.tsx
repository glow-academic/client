/**
 * Departments.tsx
 * Used to display the departments page.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { Copy, DollarSign, Edit, Eye, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { api } from "@/lib/api/client";
import type { DepartmentItem } from "@/lib/api/v2/schemas/departments";
import { keys } from "@/lib/query/keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DepartmentsDataTable } from "./DepartmentsDataTable";

export default function Departments() {
  const router = useRouter();
  const { effectiveProfile, departmentIds } = useProfile();
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const queryClient = useQueryClient();

  // V3 API hook
  const filters = useMemo(
    () => ({
      departmentIds: departmentIds,
      profileId: effectiveProfile?.id || "",
    }),
    [departmentIds, effectiveProfile?.id]
  );

  const { data: departmentsData, isLoading } = useQuery({
    queryKey: keys.departments.list(filters),
    queryFn: () => api.post("/departments/list", { body: filters }),
    enabled: !!effectiveProfile?.id && departmentIds.length > 0,
  });

  // Mutations with V3 API
  const duplicateDepartmentMutation = useMutation({
    mutationFn: (req: { departmentId: string }) =>
      api.post("/departments/duplicate", { body: req }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.departments.all });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: (req: { departmentId: string }) =>
      api.post("/departments/delete", { body: req }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.departments.all });
    },
  });

  // Extract data from V2 response
  const departments = useMemo(
    () => departmentsData?.departments || [],
    [departmentsData?.departments]
  );

  // Filter options (inline)
  const priceSpentOptions = useMemo(
    () => [
      { value: "0-10", label: "$0 - $10" },
      { value: "10-50", label: "$10 - $50" },
      { value: "50-100", label: "$50 - $100" },
      { value: "100+", label: "$100+" },
    ],
    []
  );

  const staffCountOptions = useMemo(
    () => [
      { value: "1-5", label: "1-5 staff" },
      { value: "6-10", label: "6-10 staff" },
      { value: "11-20", label: "11-20 staff" },
      { value: "20+", label: "20+ staff" },
    ],
    []
  );

  const handleEdit = (id: string) => {
    router.push(`/system/departments/d/${id}`);
  };

  const handleDuplicate = async (department: DepartmentItem) => {
    if (!department.can_duplicate) {
      toast.error("This department cannot be duplicated");
      return;
    }

    setIsDuplicating(department.department_id);
    try {
      await duplicateDepartmentMutation.mutateAsync({
        departmentId: department.department_id,
      });
      toast.success(`Department "${department.title}" duplicated successfully`);
    } catch (error) {
      toast.error("Failed to duplicate department");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;

    try {
      await deleteDepartmentMutation.mutateAsync({
        departmentId: deleteItem.id,
      });
      toast.success(`Department "${deleteItem.name}" deleted successfully`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete department"
      );
    } finally {
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, title: string) => {
    setDeleteItem({ id, name: title });
    setShowDeleteDialog(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderDepartmentCard = (department: (typeof departments)[0]) => (
    <Card
      key={department.department_id}
      className="hover:shadow-md transition-shadow"
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <CardTitle className="text-base">
              {department.title || "Unnamed Department"}
            </CardTitle>
            <div className="mt-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <DollarSign className="h-3 w-3 mr-1" />$
                  {department.total_price_spent.toFixed(2)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {department.staff_count} staff
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {department.description || "No description available"}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {department.can_edit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(department.department_id)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(department.department_id)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {department.can_duplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(department)}
                disabled={isDuplicating === department.department_id}
              >
                {isDuplicating === department.department_id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {department.can_delete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleDeleteClick(department.department_id, department.title)
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          <span className="text-muted-foreground">Updated:</span>
          <span className="font-medium ml-2">
            {formatDate(department.updated_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading departments...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DepartmentsDataTable
        data={departments}
        priceSpentOptions={priceSpentOptions}
        staffCountOptions={staffCountOptions}
        renderDepartmentCard={renderDepartmentCard}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteItem?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
