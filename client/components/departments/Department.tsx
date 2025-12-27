/**
 * Department.tsx
 * Used to display the department page with create/edit functionality.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// UI Components
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
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import { Check, Loader2, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
// Import types from new page (create action)
import type {
  CreateDepartmentIn,
  CreateDepartmentOut,
  DepartmentNewOut,
} from "@/app/(main)/system/departments/new/page";
// Import types from edit page (update action)
import type {
  DepartmentDetailOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
} from "@/app/(main)/system/departments/d/[departmentId]/page";
// Import types from list page (delete/duplicate actions)
import type {
  DeleteDepartmentIn,
  DeleteDepartmentOut,
} from "@/app/(main)/system/departments/page";

export interface DepartmentProps {
  departmentId?: string;
  // Optional server-provided data (for server-side rendering)
  departmentDetail?: DepartmentDetailOut;
  departmentDetailDefault?: DepartmentNewOut;
  // Server actions (replaces useMutation)
  createDepartmentAction?: (
    input: CreateDepartmentIn,
  ) => Promise<CreateDepartmentOut>;
  updateDepartmentAction?: (
    input: UpdateDepartmentIn,
  ) => Promise<UpdateDepartmentOut>;
  deleteDepartmentAction?: (
    input: DeleteDepartmentIn,
  ) => Promise<DeleteDepartmentOut>;
}

interface FormErrors {
  title?: string;
  description?: string;
}

interface FormData {
  title?: string;
  description?: string;
  active?: boolean;
}

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

export default function Department({
  departmentId,
  departmentDetail: serverDepartmentDetail,
  departmentDetailDefault: serverDepartmentDetailDefault,
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
}: DepartmentProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!departmentId;

  const initialFormData: FormData = useMemo(
    () => ({
      title: "New Department",
      description: "",
      active: true,
    }),
    [],
  );

  const [formData, setFormData] = useState<FormData>();
  const [originalFormData, setOriginalFormData] = useState<FormData>();
  const [errors, setErrors] = useState<FormErrors>({});

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Use server-provided data (no React Query needed when server data is provided)
  const departmentDetail = serverDepartmentDetail;
  const departmentDetailDefault = serverDepartmentDetailDefault;

  // Use edit detail when editing, default detail when creating
  const departmentData = isEditMode
    ? departmentDetail
    : departmentDetailDefault;

  // Set breadcrumb context when department data is loaded
  useEffect(() => {
    if (departmentDetail?.title && departmentId && isEditMode) {
      setEntityMetadata({
        entityId: departmentId,
        entityName: departmentDetail.title,
        entityType: "department",
      });
    }
    return () => clearEntityMetadata();
  }, [
    departmentDetail,
    departmentId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Extract body types from server action types for type safety
  type CreateDepartmentBody = CreateDepartmentIn extends { body: infer B }
    ? B
    : never;
  type UpdateDepartmentBody = UpdateDepartmentIn extends { body: infer B }
    ? B
    : never;
  // Server action handlers
  const handleCreateDepartment = async (body: CreateDepartmentBody) => {
    if (!createDepartmentAction) {
      throw new Error("createDepartmentAction is required");
    }
    await createDepartmentAction({ body });
  };

  const handleUpdateDepartment = async (body: UpdateDepartmentBody) => {
    if (!updateDepartmentAction) {
      throw new Error("updateDepartmentAction is required");
    }
    await updateDepartmentAction({ body });
  };

  // Readonly logic using v2 permission flags
  // Admins and superadmins can always edit regardless of in_use flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !departmentData) return false;
    // Check if user is admin or superadmin - they can always edit
    if (
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin"
    ) {
      return false;
    }
    return !departmentData.can_edit;
  }, [isEditMode, departmentData, effectiveProfile?.role]);

  // Initialize form when department data loads or in create mode
  useEffect(() => {
    if (departmentData && isEditMode) {
      const departmentFormData = {
        title: departmentData.title,
        description: departmentData.description || "",
        active: departmentData.active ?? true,
      };
      setFormData((prev) => {
        const hasChanged =
          prev?.title !== departmentFormData.title ||
          prev?.description !== departmentFormData.description ||
          prev?.active !== departmentFormData.active;
        return hasChanged ? departmentFormData : prev;
      });
      setOriginalFormData((prev) => {
        const hasChanged =
          prev?.title !== departmentFormData.title ||
          prev?.description !== departmentFormData.description ||
          prev?.active !== departmentFormData.active;
        return hasChanged ? departmentFormData : prev;
      });
    } else if (!isEditMode && departmentData) {
      // For create mode, use defaults
      setFormData(initialFormData);
      setOriginalFormData(initialFormData);
    }
  }, [departmentData, isEditMode, initialFormData]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;

    return (
      current?.title !== original?.title ||
      current?.description !== original?.description ||
      current?.active !== original?.active
    );
  }, [formData, originalFormData, isEditMode]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | undefined,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasTitle = !!formData?.title?.trim();
      if (stepId === "basic") {
        return hasTitle ? "completed" : "active";
      }
      return "pending";
    },
    [formData?.title],
  );

  // Steps array - extensible for future steps
  const steps: Step[] = useMemo(() => {
    return [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the department name, description, and active status.",
        status: getStepStatus("basic"),
      },
    ];
  }, [getStepStatus]);

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setOriginalFormData(initialFormData);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData?.title?.trim()) {
      setErrors((prev) => ({ ...prev, title: "Title is required" }));
      toast.error("Title is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && departmentId) {
        // UPDATE mode
        await handleUpdateDepartment({
          department_id: departmentId,
          title: formData.title || "",
          description: formData.description || "",
          active: formData.active ?? true,
        });
        resetFormAndState();
        toast.success("Department updated successfully!");
        router.push("/system/departments");
      } else {
        // CREATE mode
        await handleCreateDepartment({
          title: formData.title || "",
          description: formData.description || "",
          active: formData.active ?? true,
        });
        resetFormAndState();
        toast.success("Department created successfully!");
        router.push("/system/departments");
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} department: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDelete = async () => {
    if (!departmentId || !deleteDepartmentAction) return;

    setIsSubmitting(true);
    try {
      await deleteDepartmentAction({
        body: { department_id: departmentId },
      });
      toast.success("Department deleted successfully");
      router.push("/departments");
    } catch (error) {
      toast.error(
        `Failed to delete department: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div
      className="space-y-6"
      data-page={isEditMode ? "department-edit" : "department-new"}
    >
      {isReadonly && (
        <div className="bg-muted border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-muted-foreground"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-foreground">
                Department is read-only
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                <p>
                  {effectiveProfile?.role === "admin" ||
                  effectiveProfile?.role === "superadmin"
                    ? "You do not have permission to edit this department. You can view the details but cannot make changes."
                    : departmentData?.in_use
                      ? "This department is currently in use and cannot be edited. You can view the details but cannot make changes."
                      : "You do not have permission to edit this department. You can view the details but cannot make changes."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Basic Information */}
        <Card className="transition-all">
          <CardContent className="pt-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                  steps[0]?.status === "completed"
                    ? "bg-green-500 text-white"
                    : steps[0]?.status === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                )}
              >
                {steps[0]?.status === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>1</span>
                )}
              </div>
              <div className="flex-1">
                {formData?.title !== undefined ? (
                  <input
                    type="text"
                    id="title"
                    data-testid="input-department-title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    onFocus={(e) => {
                      if (e.target.value === "New Department") {
                        e.target.select();
                      }
                    }}
                    onBlur={(e) => {
                      // If empty on blur, revert to default name
                      if (!e.target.value || e.target.value.trim() === "") {
                        handleInputChange("title", "New Department");
                      }
                    }}
                    className={cn(
                      "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20",
                      errors.title && "border-destructive",
                    )}
                    placeholder="New Department"
                    disabled={isReadonly}
                  />
                ) : null}
                <p className="text-xs text-muted-foreground mt-1 px-2">
                  Click to edit
                </p>
                {errors.title && (
                  <p className="text-sm text-destructive mt-1 px-2">
                    {errors.title}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {formData?.description !== undefined ? (
                <Textarea
                  id="description"
                  data-testid="input-department-description"
                  value={formData.description || ""}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Enter a brief description (optional)"
                  rows={3}
                  className={errors.description ? "border-destructive" : ""}
                  disabled={isReadonly}
                />
              ) : null}
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            {/* Active Switch */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="active"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Power className="h-3.5 w-3.5 text-muted-foreground" />
                    Active
                  </Label>
                  {formData?.active !== undefined ? (
                    <Switch
                      id="active"
                      data-testid="switch-department-active"
                      checked={formData.active ?? true}
                      onCheckedChange={(checked) =>
                        handleInputChange("active", checked)
                      }
                      disabled={isReadonly}
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Inactive departments will not be visible to users
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/departments")}
            data-testid="btn-cancel-department"
          >
            Back
          </Button>
          {isEditMode &&
            departmentData?.can_delete &&
            deleteDepartmentAction && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isSubmitting}
                data-testid="btn-delete-department"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          <Button
            type="submit"
            disabled={isSubmitting || isReadonly || (isEditMode && !hasChanges)}
            className="min-w-[120px]"
            data-testid="btn-submit-department"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : isEditMode ? (
              "Update Department"
            ) : (
              "Create Department"
            )}
          </Button>
        </div>
      </form>

      {/* Delete Confirmation Dialog */}
      {isEditMode && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent
            aria-labelledby="delete-department-title"
            data-testid="dialog-delete-department"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-department-title">
                Delete Department
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{departmentData?.title}"? This
                action cannot be undone.
                {departmentData?.in_use && (
                  <div className="mt-2 text-sm font-medium text-destructive">
                    Warning: This department is currently in use and cannot be
                    deleted.
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isSubmitting}
                data-testid="btn-cancel-delete"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isSubmitting || departmentData?.in_use}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="btn-confirm-delete"
              >
                {isSubmitting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
