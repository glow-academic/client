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

import { SettingsPicker } from "@/components/common/forms/SettingsPicker";
import { KeyPicker } from "@/components/common/forms/KeyPicker";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { Loader2, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
// Import types from new page (create action)
import type {
  CreateDepartmentIn,
  CreateDepartmentOut,
  DepartmentNewOut,
} from "@/app/(main)/departments/new/page";
// Import types from edit page (update action)
import type {
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
  DepartmentDetailOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
  UpdateKeyIn,
  UpdateKeyOut,
  KeysListOut,
  SettingsDetailOut,
} from "@/app/(main)/departments/d/[departmentId]/page";
// Import types from list page (delete/duplicate actions)
import type {
  DeleteDepartmentIn,
  DeleteDepartmentOut,
  DuplicateDepartmentIn,
  DuplicateDepartmentOut,
} from "@/app/(main)/departments/page";

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
  
  // Key mappings state
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
        router.push("/departments");
      } else {
        // CREATE mode
        await handleCreateDepartment({
          title: formData.title || "",
          description: formData.description || "",
          active: formData.active ?? true,
        });
        resetFormAndState();
        toast.success("Department created successfully!");
        router.push("/departments");
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} department: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build key mapping for KeyPicker
  const keyMapping = useMemo(() => {
    if (!keysList) return {};
    const mapping: Record<
      string,
      { name: string; description: string; key_masked: string; active: boolean; department_ids: string[] | null }
    > = {};
    keysList.keys.forEach((key) => {
      mapping[key.key_id] = {
        name: key.name,
        description: key.description || "",
        key_masked: key.key_masked,
        active: key.active,
        department_ids: key.department_ids || null,
      };
    });
    return mapping;
  }, [keysList]);

  const validKeyIds = useMemo(() => {
    return keysList?.keys.map((key) => key.key_id) || [];
  }, [keysList]);

  // Initialize key mappings from settings detail
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
              <SettingsPicker
                settingsMapping={
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
                selectedSettingsId={formData.settingsId || null}
                defaultSettingsId={
                  Object.values(departmentData.settings_mapping).find(
                    (s) => !s.department_ids || s.department_ids.length === 0
                  )?.settings_id || null
                }
                onSelect={handleSettingsSelect}
                placeholder="Select settings..."
                disabled={isReadonly}
                buttonClassName="h-10"
              />
            )}
          </div>
        )}

        {/* Key Pickers for Linked Settings */}
        {isEditMode &&
          settingsDetail &&
          keysList &&
          formData?.settingsId && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold">
                Settings Key Configuration
              </h3>

              {/* Provider Keys */}
              {settingsDetail.provider_ids &&
                settingsDetail.provider_ids.length > 0 && (
                  <div className="space-y-2">
                    <Label>AI Provider Keys</Label>
                    <div className="space-y-4">
                      {settingsDetail.provider_ids.map((providerId) => {
                        const provider =
                          settingsDetail.provider_mapping?.[providerId];
                        const selectedKeyId =
                          providerKeyMapping[providerId] || null;
                        return provider ? (
                          <div
                            key={providerId}
                            className="p-3 border rounded-lg bg-muted/50 space-y-2"
                          >
                            <div className="font-medium">{provider.name}</div>
                            {provider.description && (
                              <div className="text-sm text-muted-foreground">
                                {provider.description}
                              </div>
                            )}
                            <div className="space-y-1">
                              <Label className="text-xs">API Key</Label>
                              <KeyPicker
                                mapping={keyMapping}
                                validIds={validKeyIds}
                                selectedIds={
                                  selectedKeyId ? [selectedKeyId] : []
                                }
                                defaultKeyId={null}
                                onSelect={(ids) => {
                                  setProviderKeyMapping((prev) => ({
                                    ...prev,
                                    [providerId]: ids[0] || "",
                                  }));
                                }}
                                multiSelect={false}
                                placeholder="Select key..."
                                disabled={isReadonly || isSubmitting}
                                compact={true}
                              />
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

              {/* Auth Keys */}
              {settingsDetail.auth_ids &&
                settingsDetail.auth_ids.length > 0 && (
                  <div className="space-y-2">
                    <Label>Authentication Method Keys</Label>
                    <div className="space-y-4">
                      {settingsDetail.auth_ids.map((authId) => {
                        const auth = settingsDetail.auth_mapping?.[authId];
                        const authItems =
                          settingsDetail.auth_items_mapping?.[authId] || [];
                        const encryptedItems = authItems.filter(
                          (item: { encrypted?: boolean }) =>
                            item.encrypted === true
                        );
                        return auth ? (
                          <div
                            key={authId}
                            className="p-3 border rounded-lg bg-muted/50 space-y-3"
                          >
                            <div>
                              <div className="font-medium">{auth.name}</div>
                              {auth.description && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {auth.description}
                                </div>
                              )}
                            </div>
                            {encryptedItems.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-xs">
                                  Encrypted Items
                                </Label>
                                {encryptedItems.map(
                                  (item: {
                                    auth_item_id: string;
                                    name: string;
                                    description?: string;
                                  }) => {
                                    const itemKeyMapping =
                                      authKeyMapping[authId] || {};
                                    const selectedKeyId =
                                      itemKeyMapping[item.auth_item_id] || null;
                                    return (
                                      <div
                                        key={item.auth_item_id}
                                        className="space-y-1"
                                      >
                                        <Label className="text-xs text-muted-foreground">
                                          {item.name}
                                          {item.description && (
                                            <span className="ml-1 text-xs text-muted-foreground">
                                              - {item.description}
                                            </span>
                                          )}
                                        </Label>
                                        <KeyPicker
                                          mapping={keyMapping}
                                          validIds={validKeyIds}
                                          selectedIds={
                                            selectedKeyId
                                              ? [selectedKeyId]
                                              : []
                                          }
                                          defaultKeyId={null}
                                          onSelect={(ids) => {
                                            setAuthKeyMapping((prev) => ({
                                              ...prev,
                                              [authId]: {
                                                ...(prev[authId] || {}),
                                                [item.auth_item_id]:
                                                  ids[0] || "",
                                              },
                                            }));
                                          }}
                                          multiSelect={false}
                                          placeholder="Select key..."
                                          disabled={
                                            isReadonly || isSubmitting
                                          }
                                          compact={true}
                                        />
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            )}
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

              <p className="text-xs text-muted-foreground">
                Note: Key changes will update the linked settings version.
              </p>
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
