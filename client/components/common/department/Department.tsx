/**
 * Department.tsx
 * Used to display the department page with create/edit functionality.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  useCreateDepartment,
  useDepartmentDetail,
  useDepartmentDetailDefault,
  useUpdateDepartment,
} from "@/lib/api/v2/hooks/departments";
import { useLogger } from "@/lib/api/v2/hooks/logs";

export interface DepartmentProps {
  departmentId?: string;
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


export default function Department({ departmentId }: DepartmentProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const log = useLogger();
  const isEditMode = !!departmentId;

  const initialFormData: FormData = useMemo(
    () => ({
      title: "",
      description: "",
      active: true,
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>();
  const [errors, setErrors] = useState<FormErrors>({});

  // V2 API hooks
  const { data: departmentDetail, isLoading: isLoadingDepartmentDetail } =
    useDepartmentDetail(
      departmentId || "",
      effectiveProfile?.id || "",
      !!departmentId && isEditMode
    );

  const {
    data: departmentDetailDefault,
    isLoading: isLoadingDepartmentDefault,
  } = useDepartmentDetailDefault(effectiveProfile?.id || "", !isEditMode);

  // Use edit detail when editing, default detail when creating
  const departmentData = isEditMode
    ? departmentDetail
    : departmentDetailDefault;
  const isLoadingData = isEditMode
    ? isLoadingDepartmentDetail
    : isLoadingDepartmentDefault;

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

  // Mutations
  const { mutate: createDepartment } = useCreateDepartment();
  const { mutate: updateDepartment } = useUpdateDepartment();

  const isLoading = isLoadingData;

  // Readonly logic using v2 permission flags
  const isReadonly = useMemo(() => {
    if (!isEditMode || !departmentData) return false;
    return !departmentData.can_edit;
  }, [isEditMode, departmentData]);

  // Initialize form when department data loads or in create mode
  useEffect(() => {
    if (departmentData && isEditMode) {
      setFormData({
        title: departmentData.title,
        description: departmentData.description || "",
        active: departmentData.active ?? true,
      });
    } else if (!isEditMode && departmentData) {
      // For create mode, use defaults
      setFormData(initialFormData);
    }
  }, [departmentData, isEditMode, initialFormData]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData?.title) {
      setErrors((prev) => ({ ...prev, title: "Title is required" }));
      toast.error("Title is required");
      return;
    }

    if (!formData?.description) {
      setErrors((prev) => ({
        ...prev,
        description: "Description is required",
      }));
      toast.error("Description is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && departmentId) {
        // UPDATE mode - single mutation with all data
        updateDepartment(
          {
            departmentId: departmentId,
            title: formData.title,
            description: formData.description,
            active: formData.active ?? true,
          },
          {
            onSuccess: () => {
              resetFormAndState();
              toast.success("Department updated successfully!");
              router.push("/management/departments");
            },
            onError: (error) => {
              toast.error(`Failed to update department: ${error.message}`);
              setIsSubmitting(false);
            },
          }
        );
      } else {
        // CREATE mode - single mutation with all data
        createDepartment(
          {
            title: formData.title,
            description: formData.description,
            active: formData.active ?? true,
            profile_id: effectiveProfile?.id || "",
          },
          {
            onSuccess: () => {
              resetFormAndState();
              toast.success("Department created successfully!");
              router.push("/management/departments");
            },
            onError: (error) => {
              toast.error(`Failed to create department: ${error.message}`);
              setIsSubmitting(false);
            },
          }
        );
      }
    } catch (error) {
      const message = `Error ${isEditMode ? "updating" : "creating"} department:`;
      log.error("department.save.failed", {
        message,
        error,
        context: { component: "Department", isEditMode, departmentId },
      });
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} department: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {isReadonly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
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
              <h3 className="text-sm font-medium text-yellow-800">
                Department is read-only
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  {departmentData?.in_use
                    ? "This department is currently in use and cannot be edited. You can view the details but cannot make changes."
                    : "You do not have permission to edit this department. You can view the details but cannot make changes."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Field */}
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          {formData?.title !== undefined && !isLoading ? (
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter department title"
              className={errors.title ? "border-destructive" : ""}
              required
              disabled={isReadonly}
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        {/* Description Field */}
        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          {formData?.description !== undefined && !isLoading ? (
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter department description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
              required
              disabled={isReadonly}
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        {/* Active Switch */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Label htmlFor="active" className="text-sm">
              Department Active
            </Label>
            {formData?.active !== undefined && !isLoading ? (
              <Switch
                id="active"
                checked={formData.active ?? true}
                onCheckedChange={(checked) =>
                  handleInputChange("active", checked)
                }
                disabled={isReadonly}
              />
            ) : (
              <Skeleton className="h-6 w-11" />
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting || isLoading}
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isLoading || isReadonly}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
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
    </div>
  );
}
