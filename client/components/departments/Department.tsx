/**
 * Department.tsx
 * Used to display the department page with create/edit functionality.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import React, { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Badge } from "@/components/ui/badge";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { Loader2, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { SettingsForm } from "@/components/common/settings/SettingsForm";
// Import types from new page (create action)
import type {
  CreateDepartmentIn,
  CreateDepartmentOut,
  DepartmentNewOut,
} from "@/app/(main)/system/departments/new/page";
// Import types from edit page (update action)
import type {
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
  DepartmentDetailOut,
  KeysListOut,
  SettingsDetailOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
  UpdateKeyIn,
  UpdateKeyOut,
} from "@/app/(main)/system/departments/d/[departmentId]/page";
// Import types from list page (delete/duplicate actions)
import type {
  DeleteDepartmentIn,
  DeleteDepartmentOut,
  DuplicateDepartmentIn,
  DuplicateDepartmentOut,
} from "@/app/(main)/system/departments/page";

export interface DepartmentProps {
  departmentId?: string;
  // Optional server-provided data (for server-side rendering)
  departmentDetail?: DepartmentDetailOut;
  departmentDetailDefault?: DepartmentNewOut;
  keysList?: KeysListOut;
  settingsDetail?: SettingsDetailOut | null;
  // Server actions (replaces useMutation)
  createDepartmentAction?: (
    input: CreateDepartmentIn
  ) => Promise<CreateDepartmentOut>;
  updateDepartmentAction?: (
    input: UpdateDepartmentIn
  ) => Promise<UpdateDepartmentOut>;
  duplicateDepartmentAction?: (
    input: DuplicateDepartmentIn
  ) => Promise<DuplicateDepartmentOut>;
  deleteDepartmentAction?: (
    input: DeleteDepartmentIn
  ) => Promise<DeleteDepartmentOut>;
  // Key management actions
  createKeyAction?: (input: CreateKeyIn) => Promise<CreateKeyOut>;
  decryptKeyAction?: (input: DecryptKeyIn) => Promise<DecryptKeyOut>;
  updateKeyAction?: (input: UpdateKeyIn) => Promise<UpdateKeyOut>;
  getKeysListAction?: (profileId: string) => Promise<KeysListOut>;
  getSettingsDetailAction?: (
    settingsId: string,
    profileId: string
  ) => Promise<SettingsDetailOut>;
}

interface FormErrors {
  title?: string;
  description?: string;
}

interface FormData {
  title?: string;
  description?: string;
  active?: boolean;
  settingsId?: string | null;
}

export default function Department({
  departmentId,
  departmentDetail: serverDepartmentDetail,
  departmentDetailDefault: serverDepartmentDetailDefault,
  keysList: initialKeysList,
  settingsDetail: initialSettingsDetail,
  createDepartmentAction,
  updateDepartmentAction,
  duplicateDepartmentAction: _duplicateDepartmentAction,
  deleteDepartmentAction,
  createKeyAction: _createKeyAction,
  decryptKeyAction: _decryptKeyAction,
  updateKeyAction: _updateKeyAction,
  getKeysListAction,
  getSettingsDetailAction,
}: DepartmentProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!departmentId;

  const initialFormData: FormData = useMemo(
    () => ({
      title: "",
      description: "",
      active: true,
      settingsId: null,
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>();
  const [originalFormData, setOriginalFormData] = useState<FormData>();
  const [errors, setErrors] = useState<FormErrors>({});

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Keys and settings state
  const [keysList, setKeysList] = useState<KeysListOut | undefined>(
    initialKeysList
  );
  const [settingsDetail, setSettingsDetail] = useState<
    SettingsDetailOut | null | undefined
  >(initialSettingsDetail);

  // Key mappings state (for SettingsForm)
  const [providerKeyMapping, setProviderKeyMapping] = useState<
    Record<string, string>
  >({});
  const [authKeyMapping, setAuthKeyMapping] = useState<
    Record<string, Record<string, string>>
  >({});

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
        settingsId: departmentData.settings_id || null,
      };
      setFormData((prev) => {
        const hasChanged =
          prev?.title !== departmentFormData.title ||
          prev?.description !== departmentFormData.description ||
          prev?.active !== departmentFormData.active ||
          prev?.settingsId !== departmentFormData.settingsId;
        return hasChanged ? departmentFormData : prev;
      });
      setOriginalFormData((prev) => {
        const hasChanged =
          prev?.title !== departmentFormData.title ||
          prev?.description !== departmentFormData.description ||
          prev?.active !== departmentFormData.active ||
          prev?.settingsId !== departmentFormData.settingsId;
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
      current?.active !== original?.active ||
      current?.settingsId !== original?.settingsId
    );
  }, [formData, originalFormData, isEditMode]);

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
    setOriginalFormData(initialFormData);
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
        // UPDATE mode
        await handleUpdateDepartment({
          departmentId: departmentId,
          title: formData.title || "",
          description: formData.description || "",
          active: formData.active ?? true,
          settingsId: formData.settingsId || null,
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
        `Failed to ${isEditMode ? "update" : "create"} department: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };


  // Initialize key mappings and provider enabled state from settings detail
  useEffect(() => {
    if (settingsDetail) {
      setProviderKeyMapping(settingsDetail.provider_key_mapping || {});
      setAuthKeyMapping(settingsDetail.auth_key_mapping || {});
    }
  }, [settingsDetail]);

  // Settings picker handler
  const handleSettingsSelect = async (settingsId: string | null) => {
    setFormData((prev) => ({
      ...prev,
      settingsId: settingsId,
    }));

    // Fetch settings detail when settings changes
    if (settingsId && getSettingsDetailAction && effectiveProfile?.id) {
      try {
        const detail = await getSettingsDetailAction(
          settingsId,
          effectiveProfile.id
        );
        setSettingsDetail(detail);
        // Refresh keys list
        if (getKeysListAction) {
          const freshKeysList = await getKeysListAction(effectiveProfile.id);
          setKeysList(freshKeysList);
        }
      } catch {
        // Settings might not exist
        setSettingsDetail(null);
      }
    } else {
      setSettingsDetail(null);
    }
  };

  const handleDelete = async () => {
    if (!departmentId || !deleteDepartmentAction) return;

    setIsSubmitting(true);
    try {
      await deleteDepartmentAction({
        body: { departmentId },
      });
      toast.success("Department deleted successfully");
      router.push("/departments");
    } catch (error) {
      toast.error(
        `Failed to delete department: ${error instanceof Error ? error.message : "Unknown error"}`
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Field */}
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          {formData?.title !== undefined ? (
            <Input
              id="title"
              data-testid="input-department-title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter department title"
              className={errors.title ? "border-destructive" : ""}
              required
              disabled={isReadonly}
            />
          ) : null}
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        {/* Description Field */}
        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          {formData?.description !== undefined ? (
            <Textarea
              id="description"
              data-testid="input-department-description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter department description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
              required
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

        {/* Settings Picker */}
        {isEditMode && departmentData && departmentData.settings_mapping && (
          <div className="space-y-2">
            <Label htmlFor="settings">Settings</Label>
            {formData?.settingsId !== undefined && (
              <GenericPicker
                items={
                  departmentData.settings_mapping as Record<
                    string,
                    {
                      settings_id: string;
                      created_at: string;
                      active: boolean;
                      department_ids: string[] | null;
                    }
                  >
                }
                itemIds={Object.keys(departmentData.settings_mapping)}
                selectedIds={formData.settingsId ? [formData.settingsId] : []}
                onSelect={(ids) => handleSettingsSelect(ids[0] || null)}
                getId={(item) => (item as unknown as { id: string }).id}
                getLabel={(item) => {
                  const date = new Date(item.created_at);
                  return `Settings (${date.toLocaleDateString()})`;
                }}
                getSearchText={(item) => {
                  const date = new Date(item.created_at);
                  return `Settings ${date.toLocaleDateString()} ${item.active ? "Active" : "Inactive"}`;
                }}
                renderButton={(selectedItems) => {
                  if (selectedItems.length === 0) {
                    return "Select settings...";
                  }
                  const setting = selectedItems[0];
                  if (!setting) return "Select settings...";
                  const date = new Date(setting.created_at);
                  const defaultSettingsId =
                    Object.values(departmentData.settings_mapping).find(
                      (s) => !s.department_ids || s.department_ids.length === 0
                    )?.settings_id || null;
                  const isDefault = setting.settings_id === defaultSettingsId;
                  return (
                    <div className="flex items-center gap-2 truncate">
                      {isDefault && (
                        <Badge
                          variant="secondary"
                          className="text-xs h-5 px-1.5 flex-shrink-0"
                        >
                          Default
                        </Badge>
                      )}
                      <span className="truncate">
                        Settings ({date.toLocaleDateString()})
                      </span>
                    </div>
                  );
                }}
                renderItem={(item, _isSelected) => {
                  const date = new Date(item.created_at);
                  const defaultSettingsId =
                    Object.values(departmentData.settings_mapping).find(
                      (s) => !s.department_ids || s.department_ids.length === 0
                    )?.settings_id || null;
                  const isDefault = item.settings_id === defaultSettingsId;
                  return (
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isDefault && (
                            <Badge
                              variant="secondary"
                              className="text-xs h-5 px-1.5"
                            >
                              Default
                            </Badge>
                          )}
                          <div className="font-medium truncate">
                            Settings ({date.toLocaleDateString()})
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                          {item.active ? "Active" : "Inactive"}
                        </div>
                        {item.department_ids &&
                          item.department_ids.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {item.department_ids.length} department
                              {item.department_ids.length !== 1 ? "s" : ""}
                            </div>
                          )}
                      </div>
                    </div>
                  );
                }}
                placeholder="Select settings..."
                disabled={isReadonly}
                multiSelect={false}
                hideSelectedChips={true}
                buttonClassName="h-10 w-full"
                groupHeading="Settings"
              />
            )}
          </div>
        )}

        {/* Settings Configuration - Using Shared SettingsForm */}
        {isEditMode && settingsDetail && keysList && formData?.settingsId && (
          <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
              <h3 className="text-lg font-semibold">Department Settings</h3>
              <p className="text-sm text-muted-foreground">
                View and configure settings for this department. Settings changes
                affect the linked settings version.
              </p>
                            </div>
            <SettingsForm
              settingsDetail={settingsDetail}
              keysList={keysList}
              formData={{
                primary_color: settingsDetail.primary_color || "#171717",
                accent: settingsDetail.accent || "#f5f5f5",
                background: settingsDetail.background || "#ffffff",
                surface: settingsDetail.surface || "#ffffff",
                success: settingsDetail.success || "#009e34",
                warning: settingsDetail.warning || "#ea8100",
                error: settingsDetail.error || "#e7000b",
                sidebar_background:
                  settingsDetail.sidebar_background || "#fafafa",
                sidebar_primary: settingsDetail.sidebar_primary || "#171717",
                chart1: settingsDetail.chart1 || "#f54900",
                chart2: settingsDetail.chart2 || "#009689",
                chart3: settingsDetail.chart3 || "#104e64",
                chart4: settingsDetail.chart4 || "#ffb900",
                chart5: settingsDetail.chart5 || "#fe9a00",
                guest_login_enabled:
                  settingsDetail.guest_login_enabled ?? true,
                success_threshold: settingsDetail.success_threshold ?? 85,
                warning_threshold: settingsDetail.warning_threshold ?? 80,
                danger_threshold: settingsDetail.danger_threshold ?? 70,
                default_admin_profile_id:
                  settingsDetail.default_admin_profile_id || null,
                default_guest_profile_id:
                  settingsDetail.default_guest_profile_id || null,
              }}
              providerKeyMapping={providerKeyMapping}
              authKeyMapping={authKeyMapping}
              onFormDataChange={() => {
                // Read-only in department context
              }}
              onProviderKeyChange={() => {
                // Read-only in department context
              }}
              onProviderEnabledChange={() => {
                // Read-only in department context
              }}
              onAuthKeyChange={() => {
                // Read-only in department context
              }}
              onAuthValueChange={() => {
                // Read-only in department context
              }}
              isSubmitting={isSubmitting}
              readonly={true}
            />
          </div>
        )}

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
