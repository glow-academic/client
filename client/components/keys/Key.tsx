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
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { Power, Key as KeyIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Type-only import from server pages
import type {
  KeyDetailOut,
  UpdateKeyIn,
  UpdateKeyOut,
} from "@/app/(main)/engine/keys/k/[keyId]/page";
import type {
  CreateKeyIn,
  CreateKeyOut,
  KeyDetailDefaultOut,
} from "@/app/(main)/engine/keys/new/page";

const KEY_TYPES = [
  {
    id: "api",
    name: "API",
    description: "API key for model access",
  },
  {
    id: "auth",
    name: "Auth",
    description: "Authentication key",
  },
] as const;

export type KeyType = (typeof KEY_TYPES)[number]["id"];

interface TypePickerProps {
  selectedType: string;
  onSelect: (type: string) => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
}

function TypePicker({
  selectedType,
  onSelect,
  placeholder = "Select type...",
  disabled = false,
  buttonClassName,
}: TypePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (typeId: string) => {
    onSelect(typeId);
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedType) {
      return placeholder;
    }
    const type = KEY_TYPES.find((t) => t.id === selectedType);
    return type?.name || placeholder;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select key type"
          className={cn("w-full justify-between", buttonClassName)}
          disabled={disabled}
        >
          <span className="truncate text-left">{getButtonText()}</span>
          <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-0">
        <Command loop>
          <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
            <CommandInput placeholder="Search types..." />
            <CommandEmpty>No types found.</CommandEmpty>
            <CommandGroup heading="Key Types">
              {KEY_TYPES.map((type) => (
                <CommandItem
                  key={type.id}
                  onSelect={() => handleSelect(type.id)}
                  className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                  data-testid="type-option"
                  data-type-id={type.id}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{type.name}</div>
                        {type.description && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {type.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto flex-shrink-0",
                        selectedType === type.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface FormErrors {
  name?: string;
  key?: string;
  type?: string;
}

interface FormData {
  name?: string;
  key?: string;
  type?: string;
  active?: boolean;
  departmentIds?: string[] | null;
}

export interface KeyProps {
  keyId?: string;
  // For create mode: default key detail
  keyDetailDefault?: KeyDetailDefaultOut;
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
        effectiveProfile?.primaryDepartmentId || null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      key: "",
      type: "api",
      active: true,
      departmentIds: defaultDepartmentIds,
    }),
    [defaultDepartmentIds]
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
  }, [
    keyDetail,
    keyId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Single consolidated useEffect to handle all form state scenarios
  useEffect(() => {
    if (isEditMode && keyDetail) {
      // We are in EDIT mode and have the key's data, so populate the form
      setFormData({
        name: keyDetail.name,
        key: "", // Don't populate key value for security
        type: keyDetail.type,
        active: keyDetail.active,
        departmentIds: currentDepartmentIds,
      });
    } else if (!isEditMode) {
      // We are in CREATE mode, so reset the form to its initial state
      setFormData(initialFormData);
    }
  }, [
    isEditMode,
    keyDetail,
    initialFormData,
    currentDepartmentIds,
  ]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | string[] | undefined
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

    if (!formData.type) {
      setErrors((prev) => ({
        ...prev,
        type: "Type is required",
      }));
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && keyId) {
        await handleUpdateKey({
          keyId: keyId,
          name: formData.name!,
          key: formData.key || "", // Use existing key if not changed
          active: formData.active ?? true,
          department_ids: formData.departmentIds || null,
        });
        resetFormAndState();
        toast.success("Key updated successfully!");
        router.push(`/engine/keys`);
      } else {
        await handleCreateKey({
          name: formData.name!,
          key: formData.key!,
          type: formData.type!,
          active: formData.active ?? true,
          department_ids: formData.departmentIds || null,
        });
        resetFormAndState();
        toast.success("Key created successfully!");
        router.push(`/engine/keys`);
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode && keyId ? "update" : "create"} key: ${error instanceof Error ? error.message : "Unknown error"}`
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
              placeholder={isEditMode ? "Leave blank to keep existing key" : "Enter key value"}
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

        {/* Type Selection */}
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <div data-testid="picker-type">
            <TypePicker
              selectedType={formData.type || ""}
              onSelect={(type) => handleInputChange("type", type)}
              placeholder="Select a type..."
              disabled={isReadonly || isSubmitting}
              buttonClassName={errors.type ? "border-destructive" : ""}
            />
          </div>
          {errors.type && (
            <p className="text-sm text-destructive">{errors.type}</p>
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

