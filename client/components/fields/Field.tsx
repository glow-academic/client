/**
 * Field.tsx
 * Used to create and manage fields
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */
"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { ParameterCardGrid } from "@/components/common/parameters/ParameterCardGrid";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { cn } from "@/lib/utils";
import { Check, Loader2, Power } from "lucide-react";
import { useRouter } from "next/navigation";

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

interface FormErrors {
  name?: string;
  description?: string;
}

interface FormData {
  name?: string;
  description?: string;
  active?: boolean;
  departmentIds?: string[] | null;
  conditionalParameterIds?: string[] | null;
}

// Type-only imports from server pages
import type {
  FieldDetailOut,
  UpdateFieldIn,
  UpdateFieldOut,
} from "@/app/(main)/management/fields/[fieldId]/page";
import type {
  CreateFieldIn,
  CreateFieldOut,
  FieldNewOut,
} from "@/app/(main)/management/fields/new/page";

export interface FieldProps {
  fieldId?: string;
  // For create mode: default field detail with options
  fieldDetailDefault?: FieldNewOut;
  // For edit mode: field detail with options
  fieldDetail?: FieldDetailOut;
  createFieldAction?: (input: CreateFieldIn) => Promise<CreateFieldOut>;
  updateFieldAction?: (input: UpdateFieldIn) => Promise<UpdateFieldOut>;
}

export default function Field({
  fieldId,
  fieldDetailDefault,
  fieldDetail: serverFieldDetail,
  createFieldAction,
  updateFieldAction,
}: FieldProps) {
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { effectiveProfile } = useProfile();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!fieldId;

  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId || null,
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId],
  );

  const initialFormData: FormData = useMemo(
    () => ({
      name: "New Field",
      description: "",
      active: true,
      departmentIds: defaultDepartmentIds,
      conditionalParameterIds: [],
    }),
    [defaultDepartmentIds],
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // Use server-provided data
  const fieldDetail = serverFieldDetail;

  // Get valid options from server data
  const validDepartmentIds = useMemo(() => {
    return (
      fieldDetail?.valid_department_ids ||
      fieldDetailDefault?.valid_department_ids ||
      []
    );
  }, [
    fieldDetail?.valid_department_ids,
    fieldDetailDefault?.valid_department_ids,
  ]);

  const departmentMapping = useMemo(() => {
    return (
      fieldDetail?.department_mapping ||
      fieldDetailDefault?.department_mapping ||
      {}
    );
  }, [fieldDetail?.department_mapping, fieldDetailDefault?.department_mapping]);

  const validParameterIds = useMemo(() => {
    return (
      fieldDetail?.valid_parameter_ids ||
      fieldDetailDefault?.valid_parameter_ids ||
      []
    );
  }, [
    fieldDetail?.valid_parameter_ids,
    fieldDetailDefault?.valid_parameter_ids,
  ]);

  const parameterMapping = useMemo(() => {
    return (
      fieldDetail?.parameter_mapping ||
      fieldDetailDefault?.parameter_mapping ||
      {}
    );
  }, [fieldDetail?.parameter_mapping, fieldDetailDefault?.parameter_mapping]);

  // Single consolidated useEffect to handle all form state scenarios
  useEffect(() => {
    if (isEditMode && fieldDetail) {
      // We are in EDIT mode and have the field's data, so populate the form
      setFormData({
        name: fieldDetail.name || "",
        description: fieldDetail.description || "",
        active: fieldDetail.active ?? true,
        departmentIds: fieldDetail.department_ids || null,
        conditionalParameterIds: fieldDetail.conditional_parameter_ids || [],
      });
    } else if (!isEditMode && fieldDetailDefault) {
      // We are in CREATE mode, use defaults from fieldDetailDefault
      setFormData({
        ...initialFormData,
        departmentIds: defaultDepartmentIds,
        conditionalParameterIds: [],
      });
    } else if (!isEditMode && !fieldDetailDefault) {
      // No default data available, use initial form data
      setFormData(initialFormData);
    }
  }, [
    isEditMode,
    fieldDetail,
    fieldDetailDefault,
    initialFormData,
    defaultDepartmentIds,
  ]);

  // Set breadcrumb metadata
  useEffect(() => {
    if (isEditMode && fieldDetail && fieldId) {
      setEntityMetadata({
        entityId: fieldId,
        entityName: fieldDetail.name,
        entityType: "parameter",
      });
    }

    return () => {
      if (fieldId) {
        clearEntityMetadata(fieldId);
      }
    };
  }, [
    isEditMode,
    fieldDetail,
    fieldId,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Readonly logic using server-provided can_edit flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !fieldDetail) return false;
    return !fieldDetail.can_edit;
  }, [isEditMode, fieldDetail]);

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formData?.name?.trim();

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "conditionalParameters":
          if (!hasName) return "pending";
          const hasParameters =
            (formData?.conditionalParameterIds?.length || 0) > 0;
          return hasParameters ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formData],
  );

  // Steps array
  const steps: Step[] = useMemo(() => {
    return [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the field name, description, departments, and active status.",
        status: getStepStatus("basic"),
      },
      {
        id: "conditionalParameters",
        title: "Conditional Parameters",
        description:
          "Select parameters to show when this field is selected (enables parameter chaining).",
        status: getStepStatus("conditionalParameters"),
      },
    ];
  }, [getStepStatus]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | string[] | null | undefined,
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

    if (!formData.name || !formData.name.trim()) {
      setErrors((prev) => ({ ...prev, name: "Name is required" }));
      return;
    }

    // Description is optional, so no validation needed

    // Ensure profileId exists - required for API calls
    if (!effectiveProfile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && fieldId) {
        await updateFieldAction!({
          body: {
            fieldId: fieldId,
            name: formData.name!,
            description: formData.description || "",
            active: formData.active ?? true,
            department_ids: formData.departmentIds || null,
            conditional_parameter_ids: formData.conditionalParameterIds || null,
            profileId: effectiveProfile.id,
          },
        });
        resetFormAndState();
        toast.success("Field updated successfully!");
        router.push(`/management/fields`);
      } else {
        await createFieldAction!({
          body: {
            name: formData.name!,
            description: formData.description || "",
            active: formData.active ?? true,
            department_ids: formData.departmentIds || null,
            conditional_parameter_ids: formData.conditionalParameterIds || null,
            profileId: effectiveProfile.id,
          },
        });
        resetFormAndState();
        toast.success("Field created successfully!");
        router.push(`/management/fields`);
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode && fieldId ? "update" : "create"} field: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="w-full p-6 space-y-8"
      data-page={`field-${isEditMode ? "edit" : "new"}`}
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
                Field is read-only
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                <p>
                  {fieldDetail?.department_ids?.length === 0
                    ? "This is a default field that cannot be edited. You can view the details but cannot make changes."
                    : "This field cannot be edited. You can view the details but cannot make changes."}
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
                {formData.name !== undefined ? (
                  <input
                    type="text"
                    id="name"
                    data-testid="input-field-name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    onFocus={(e) => {
                      if (e.target.value === "New Field") {
                        e.target.select();
                      }
                    }}
                    onBlur={(e) => {
                      // If empty on blur, revert to default name
                      if (!e.target.value || e.target.value.trim() === "") {
                        handleInputChange("name", "New Field");
                      }
                    }}
                    className={cn(
                      "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20",
                      errors.name && "border-destructive",
                    )}
                    placeholder="New Field"
                    disabled={isReadonly}
                  />
                ) : null}
                <p className="text-xs text-muted-foreground mt-1 px-2">
                  {formData?.name === "" ||
                  !formData?.name ||
                  formData?.name === "New Field"
                    ? "Click to edit • Name will be auto-generated if unchanged"
                    : "Click to edit"}
                </p>
                {errors.name && (
                  <p className="text-sm text-destructive mt-1 px-2">
                    {errors.name}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {formData.description !== undefined ? (
                <Textarea
                  id="description"
                  data-testid="input-field-description"
                  value={formData.description}
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

            {/* Department Selection */}
            {validDepartmentIds && validDepartmentIds.length > 1 ? (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                {formData?.departmentIds !== undefined ? (
                  <GenericPicker
                    items={departmentMapping}
                    itemIds={validDepartmentIds}
                    selectedIds={formData.departmentIds || []}
                    onSelect={(ids) => handleInputChange("departmentIds", ids)}
                    getId={(dept) => {
                      const entry = Object.entries(departmentMapping).find(
                        ([, v]) => v === dept,
                      );
                      return entry ? entry[0] : "";
                    }}
                    getLabel={(dept) =>
                      (dept["name"] as string | undefined) || ""
                    }
                    getSearchText={(dept) =>
                      `${dept["name"]} ${dept["description"] || ""}`
                    }
                    placeholder="All Departments"
                    disabled={isReadonly}
                    multiSelect={true}
                    hideSelectedChips={true}
                    buttonClassName="w-full"
                  />
                ) : null}
              </div>
            ) : null}

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
                  {formData.active !== undefined ? (
                    <Switch
                      id="active"
                      data-testid="switch-field-active"
                      checked={formData.active}
                      onCheckedChange={(checked) =>
                        handleInputChange("active", checked)
                      }
                      disabled={isReadonly}
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Inactive fields will not be available for selection
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Conditional Parameters */}
        {validParameterIds && validParameterIds.length > 0 && (
          <Card
            className={cn(
              "transition-all",
              !isEditMode &&
                steps[1]?.status === "active" &&
                "ring-2 ring-primary",
              !isEditMode && steps[1]?.status === "pending" && "opacity-50",
            )}
          >
            <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    steps[1]?.status === "completed"
                      ? "bg-green-500 text-white"
                      : steps[1]?.status === "active"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted",
                  )}
                >
                  {steps[1]?.status === "completed" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>2</span>
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {steps[1]?.title || "Conditional Parameters"}
                  </CardTitle>
                  <CardDescription>
                    {steps[1]?.description ||
                      "Select parameters to show when this field is selected (enables parameter chaining)."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-6">
              {formData?.conditionalParameterIds !== undefined ? (
                <ParameterCardGrid
                  parameterMapping={parameterMapping}
                  validParameterIds={validParameterIds}
                  selectedParameterIds={formData.conditionalParameterIds || []}
                  onSelect={(ids) =>
                    handleInputChange("conditionalParameterIds", ids)
                  }
                  readonly={isReadonly}
                />
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isReadonly}
            data-testid="btn-submit-field"
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : isEditMode ? (
              "Update Field"
            ) : (
              "Create Field"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
