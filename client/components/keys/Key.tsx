/**
 * Key.tsx
 * Used to create and manage keys for the admin dashboard
 */
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { Power } from "lucide-react";
import { useRouter } from "next/navigation";

// Type-only import from server pages
import type {
  KeyDetailOut,
  UpdateKeyIn,
  UpdateKeyOut,
} from "@/app/(main)/system/keys/k/[keyId]/page";
import type {
  CreateKeyIn,
  CreateKeyOut,
  KeyNewOut,
} from "@/app/(main)/system/keys/new/page";

interface FormErrors {
  name?: string;
  key?: string;
  description?: string;
}

interface FormData {
  name?: string;
  key?: string;
  description?: string;
  active?: boolean;
  departmentIds?: string[] | null;
}

export interface KeyProps {
  keyId?: string;
  // For create mode: default key detail
  keyDetailDefault?: KeyNewOut;
  // For edit mode: key detail
  keyDetail?: KeyDetailOut;
  createKeyAction?: (input: CreateKeyIn) => Promise<CreateKeyOut>;
  updateKeyAction?: (input: UpdateKeyIn) => Promise<UpdateKeyOut>;
}

export default function Key({
  keyId,
  keyDetailDefault,
  keyDetail: serverKeyDetail,
  createKeyAction,
  updateKeyAction,
}: KeyProps) {
  const router = useRouter();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { effectiveProfile } = useProfile();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!keyId;

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
      name: "",
      key: "",
      description: "",
      active: true,
      departmentIds: defaultDepartmentIds,
    }),
    [defaultDepartmentIds],
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // Use server-provided data
  const keyDetail = serverKeyDetail;

  // Extract body types from server action types for type safety
  type CreateKeyBody = CreateKeyIn extends { body: infer B } ? B : never;
  type UpdateKeyBody = UpdateKeyIn extends { body: infer B } ? B : never;

  // Use server actions directly (no mutations needed)
  const handleCreateKey = async (body: CreateKeyBody) => {
    if (!createKeyAction) {
      throw new Error("createKeyAction is required");
    }
    await createKeyAction({ body });
  };

  const handleUpdateKey = async (body: UpdateKeyBody) => {
    if (!updateKeyAction) {
      throw new Error("updateKeyAction is required");
    }
    await updateKeyAction({ body });
  };

  // Get department mapping
  const keyDataForMappings = isEditMode ? keyDetail : keyDetailDefault;
  const departmentMapping = useMemo(() => {
    return keyDataForMappings?.department_mapping || {};
  }, [keyDataForMappings]);

  const validDepartmentIds = useMemo(() => {
    return keyDataForMappings?.valid_department_ids || [];
  }, [keyDataForMappings]);

  // Get current department_ids for edit mode
  const currentDepartmentIds = useMemo(() => {
    if (isEditMode && keyDetail && "department_ids" in keyDetail) {
      return (keyDetail.department_ids as string[]) || [];
    }
    return defaultDepartmentIds;
  }, [isEditMode, keyDetail, defaultDepartmentIds]);

  // Check if readonly (default keys without department_ids for non-superadmin)
  const isReadonly = useMemo(() => {
    if (isEditMode && keyDetail) {
      return !keyDetail.can_edit;
    }
    return false;
  }, [isEditMode, keyDetail]);

  // Set breadcrumb context for key (edit mode only)
  useEffect(() => {
    if (keyDetail?.name && keyId && isEditMode) {
      setEntityMetadata({
        entityId: keyId,
        entityName: keyDetail.name,
        entityType: "key",
      });
    }
    return () => {
      if (keyId) {
        clearEntityMetadata(keyId);
      }
    };
  }, [keyDetail, keyId, isEditMode, setEntityMetadata, clearEntityMetadata]);

  // Single consolidated useEffect to handle all form state scenarios
  useEffect(() => {
    if (isEditMode && keyDetail) {
      // We are in EDIT mode and have the key's data, so populate the form
      setFormData({
        name: keyDetail.name,
        key: "", // Don't populate key value for security
        description: keyDetail.description || "",
        active: keyDetail.active,
        departmentIds: currentDepartmentIds,
      });
    } else if (!isEditMode) {
      // We are in CREATE mode, so reset the form to its initial state
      setFormData(initialFormData);
    }
  }, [isEditMode, keyDetail, initialFormData, currentDepartmentIds]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | string[] | undefined,
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

    if (!formData.key && !isEditMode) {
      setErrors((prev) => ({ ...prev, key: "Key value is required" }));
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && keyId) {
        await handleUpdateKey({
          keyId: keyId,
          name: formData.name!,
          key: formData.key || "", // Use existing key if not changed
          description: formData.description || "",
          active: formData.active ?? true,
          department_ids: formData.departmentIds || null,
        });
        resetFormAndState();
        toast.success("Key updated successfully!");
        router.push(`/system/keys`);
      } else {
        await handleCreateKey({
          name: formData.name!,
          key: formData.key!,
          description: formData.description || "",
          active: formData.active ?? true,
          department_ids: formData.departmentIds || null,
        });
        resetFormAndState();
        toast.success("Key created successfully!");
        router.push(`/system/keys`);
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode && keyId ? "update" : "create"} key: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Key Information */}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          {formData.name !== undefined ? (
            <Input
              id="name"
              data-testid="input-key-name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter key name"
              className={errors.name ? "border-destructive" : ""}
              disabled={isReadonly || isSubmitting}
            />
          ) : null}
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="key">Key Value</Label>
          {formData.key !== undefined ? (
            <Input
              id="key"
              type="password"
              data-testid="input-key-value"
              value={formData.key}
              onChange={(e) => handleInputChange("key", e.target.value)}
              placeholder={
                isEditMode
                  ? "Leave blank to keep existing key"
                  : "Enter key value"
              }
              className={errors.key ? "border-destructive" : ""}
              disabled={isReadonly || isSubmitting}
            />
          ) : null}
          {errors.key && (
            <p className="text-sm text-destructive">{errors.key}</p>
          )}
          {isEditMode && (
            <p className="text-xs text-muted-foreground">
              Leave blank to keep the existing key value unchanged
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          {formData.description !== undefined ? (
            <Textarea
              id="description"
              data-testid="input-key-description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter key description"
              className={errors.description ? "border-destructive" : ""}
              disabled={isReadonly || isSubmitting}
              rows={3}
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
                disabled={isReadonly || isSubmitting}
                triggerProps={{ "data-testid": "picker-department" }}
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
                  data-testid="switch-key-active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    handleInputChange("active", checked)
                  }
                  disabled={isReadonly || isSubmitting}
                />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Inactive keys will not be available for selection
            </p>
          </div>
        </div>

        {/* Submit Button */}
        {!isReadonly && (
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              type="submit"
              data-testid="btn-submit-key"
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {isEditMode && keyId ? "Updating..." : "Creating..."}
                </>
              ) : isEditMode && keyId ? (
                "Update Key"
              ) : (
                "Create Key"
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
