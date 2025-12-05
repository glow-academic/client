/**
 * Field.tsx
 * Used to create and manage fields
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { ParameterPicker } from "@/components/common/forms/ParameterPicker";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { Power } from "lucide-react";
import { useRouter } from "next/navigation";

interface FormErrors {
  name?: string;
  description?: string;
  value?: string;
}

interface FormData {
  name?: string;
  description?: string;
  value?: string;
  default_field?: boolean;
  departmentIds?: string[] | null;
  parameterIds?: string[] | null;
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
        effectiveProfile?.primaryDepartmentId || null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      value: "",
      default_field: false,
      departmentIds: defaultDepartmentIds,
      parameterIds: [],
    }),
    [defaultDepartmentIds]
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // Use server-provided data
  const fieldDetail = serverFieldDetail;

  // Extract body types from server action types for type safety
  type CreateFieldBody = CreateFieldIn extends { body: infer B } ? B : never;
  type UpdateFieldBody = UpdateFieldIn extends { body: infer B } ? B : never;

  // Get valid options from server data
  const validDepartmentIds = useMemo(() => {
    return (
      fieldDetail?.valid_department_ids ||
      fieldDetailDefault?.valid_department_ids ||
      []
    );
  }, [fieldDetail?.valid_department_ids, fieldDetailDefault?.valid_department_ids]);

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
  }, [fieldDetail?.valid_parameter_ids, fieldDetailDefault?.valid_parameter_ids]);

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
        value: fieldDetail.value || "",
        default_field: fieldDetail.default_field || false,
        departmentIds: fieldDetail.department_ids || null,
        parameterIds: fieldDetail.parameter_ids || [],
      });
    } else if (!isEditMode && fieldDetailDefault) {
      // We are in CREATE mode, use defaults from fieldDetailDefault
      setFormData({
        ...initialFormData,
        departmentIds: defaultDepartmentIds,
        parameterIds: [],
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
    if (isEditMode && fieldDetail) {
      setEntityMetadata({
        title: fieldDetail.name,
        description: fieldDetail.description,
      });
    } else {
      setEntityMetadata({
        title: "New Field",
        description: "Create a new field",
      });
    }

    return () => {
      clearEntityMetadata();
    };
  }, [isEditMode, fieldDetail, setEntityMetadata, clearEntityMetadata]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | string[] | null | undefined
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

    if (!formData.name) {
      setErrors((prev) => ({ ...prev, name: "Name is required" }));
      return;
    }

    if (!formData.description) {
      setErrors((prev) => ({
        ...prev,
        description: "Description is required",
      }));
      return;
    }

    if (!formData.value) {
      setErrors((prev) => ({ ...prev, value: "Value is required" }));
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && fieldId) {
        await updateFieldAction!({
          body: {
            fieldId: fieldId,
            name: formData.name!,
            description: formData.description!,
            value: formData.value!,
            default_field: formData.default_field ?? false,
            department_ids: formData.departmentIds || null,
            parameter_ids: formData.parameterIds || null,
            profileId: effectiveProfile?.id || "guest-profile-id",
          },
        });
        resetFormAndState();
        toast.success("Field updated successfully!");
        router.push(`/management/fields`);
      } else {
        await createFieldAction!({
          body: {
            name: formData.name!,
            description: formData.description!,
            value: formData.value!,
            default_field: formData.default_field ?? false,
            department_ids: formData.departmentIds || null,
            parameter_ids: formData.parameterIds || null,
            profileId: effectiveProfile?.id || "guest-profile-id",
          },
        });
        resetFormAndState();
        toast.success("Field created successfully!");
        router.push(`/management/fields`);
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode && fieldId ? "update" : "create"} field: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setIsSubmitting(false);
    }
  };


  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Field Information */}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          {formData.name !== undefined ? (
            <Input
              id="name"
              data-testid="input-field-name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter field name"
              className={errors.name ? "border-destructive" : ""}
            />
          ) : null}
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          {formData.description !== undefined ? (
            <Textarea
              id="description"
              data-testid="input-field-description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter field description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
            />
          ) : null}
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="value">Value</Label>
          {formData.value !== undefined ? (
            <Input
              id="value"
              data-testid="input-field-value"
              value={formData.value}
              onChange={(e) => handleInputChange("value", e.target.value)}
              placeholder="Enter field value"
              className={errors.value ? "border-destructive" : ""}
            />
          ) : null}
          {errors.value && (
            <p className="text-sm text-destructive">{errors.value}</p>
          )}
        </div>

        {/* Department Selection */}
        {validDepartmentIds && validDepartmentIds.length > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            {formData?.departmentIds !== undefined ? (
              <DepartmentPicker
                mapping={departmentMapping}
                validIds={validDepartmentIds}
                selectedIds={formData.departmentIds || []}
                onSelect={(ids) =>
                  setFormData((prev) => ({
                    ...prev,
                    departmentIds: ids,
                  }))
                }
                placeholder="All Departments"
                multiSelect={true}
                triggerProps={{ "data-testid": "picker-department" }}
              />
            ) : null}
          </div>
        ) : null}

        {/* Parameter Selection */}
        {validParameterIds && validParameterIds.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="parameters">Parameters</Label>
            {formData?.parameterIds !== undefined ? (
              <ParameterPicker
                mapping={parameterMapping}
                validIds={validParameterIds}
                selectedIds={formData.parameterIds || []}
                onSelect={(ids) =>
                  setFormData((prev) => ({
                    ...prev,
                    parameterIds: ids,
                  }))
                }
                placeholder="Select parameters..."
                multiSelect={true}
                triggerProps={{ "data-testid": "picker-parameter" }}
              />
            ) : null}
          </div>
        ) : null}

        {/* Default Field Switch */}
        <div className="space-y-1 pt-2">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="default_field"
              className="text-sm flex items-center gap-1.5"
            >
              <Power className="h-3.5 w-3.5 text-muted-foreground" />
              Default Field
            </Label>
            {formData.default_field !== undefined ? (
              <Switch
                id="default_field"
                data-testid="switch-field-default"
                checked={formData.default_field}
                onCheckedChange={(checked) =>
                  handleInputChange("default_field", checked)
                }
              />
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            Mark this field as a default option
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isEditMode
                ? "Updating..."
                : "Creating..."
              : isEditMode
                ? "Update Field"
                : "Create Field"}
          </Button>
        </div>
      </form>
    </div>
  );
}

