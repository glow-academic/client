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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateDepartment,
  useDepartment,
  useUpdateDepartment,
} from "@/lib/api/hooks/departments";
import { log } from "@/utils/logger";

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
}

export default function Department({ departmentId }: DepartmentProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!departmentId;

  const initialFormData: FormData = useMemo(
    () => ({
      title: "",
      description: "",
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // Data fetching
  const { data: department, isLoading: isDepartmentLoading } = useDepartment(
    departmentId!,
    !!departmentId
  );

  // Mutation hooks
  const createDepartmentMutation = useCreateDepartment();
  const updateDepartmentMutation = useUpdateDepartment(departmentId);

  // Initialize form when department data loads or in create mode
  useEffect(() => {
    if (isEditMode && department) {
      setFormData({
        title: department.title,
        description: department.description || "",
      });
    } else if (!isEditMode) {
      setFormData(initialFormData);
    }
  }, [isEditMode, department, initialFormData]);

  const isLoading = isDepartmentLoading;

  const handleInputChange = (
    field: keyof FormData,
    value: string | undefined
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
    if (!formData.title) {
      setErrors((prev) => ({ ...prev, title: "Title is required" }));
      return;
    }

    if (!formData.description) {
      setErrors((prev) => ({
        ...prev,
        description: "Description is required",
      }));
      return;
    }

    setIsSubmitting(true);

    try {
      let result;
      if (isEditMode && departmentId && department) {
        // Prepare update data - only include changed fields
        const updateData: {
          title?: string;
          description?: string;
        } = {};

        if (formData.title !== department.title) {
          updateData.title = formData.title;
        }

        if (formData.description !== (department.description || "")) {
          updateData.description = formData.description;
        }

        result = await updateDepartmentMutation.mutateAsync(updateData);
      } else {
        result = await createDepartmentMutation.mutateAsync({
          title: formData.title!,
          description: formData.description!,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (!result) {
        toast.error(`Failed to ${isEditMode ? "update" : "create"} department`);
        return;
      }

      resetFormAndState();
      toast.success(
        isEditMode && departmentId
          ? "Department updated successfully!"
          : "Department created successfully!"
      );
      router.push(`/system/departments`);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Field */}
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          {formData.title !== undefined && !isLoading ? (
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter department title"
              className={errors.title ? "border-destructive" : ""}
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
          <Label htmlFor="description">Description</Label>
          {formData.description !== undefined && !isLoading ? (
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter department description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
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
            disabled={isSubmitting || isLoading}
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
