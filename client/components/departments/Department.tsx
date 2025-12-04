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

import { StaffDataTable } from "@/components/common/staff/StaffDataTable";
import StaffEditModal from "@/components/common/staff/StaffEditModal";
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
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { Power, Trash2 } from "lucide-react";
// Type-only import from server page
import type {
  CreateStaffDataOut,
  ProfileListItem,
  SearchStaffOut,
} from "@/app/(main)/management/staff/page";
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
  RemoveProfilesFromDepartmentIn,
  RemoveProfilesFromDepartmentOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
  UpdateKeyIn,
  UpdateKeyOut,
} from "@/app/(main)/departments/d/[departmentId]/page";
// Import types from list page (delete/duplicate actions)
import type {
  DeleteDepartmentIn,
  DeleteDepartmentOut,
  DuplicateDepartmentIn,
  DuplicateDepartmentOut,
} from "@/app/(main)/departments/page";
import type {
  BulkCreateOrUpdateStaffAction,
  ProcessCSVAction,
  SearchStaffAction,
  UpdateStaffAction,
} from "@/components/staff/Staff";
// Import staff item types from API responses
import type { DepartmentStaffItem } from "@/app/(main)/departments/d/[departmentId]/page";
import type { DepartmentDefaultStaffItem } from "@/app/(main)/departments/new/page";

// Helper to normalize department staff item to ProfileListItem format
// Note: ProfileListItem doesn't have can_remove, so we extend it
type ProfileListItemWithRemove = ProfileListItem & { can_remove?: boolean };

const normalizeDepartmentStaffItem = (
  item: DepartmentStaffItem | DepartmentDefaultStaffItem,
  departmentId?: string
): ProfileListItemWithRemove => ({
  profile_id: item.profile_id,
  first_name: item.first_name,
  last_name: item.last_name,
  emails: "emails" in item ? item.emails || [] : [],
  primary_email: "primary_email" in item ? item.primary_email || "" : "",
  name: item.name,
  role: item.role,
  initials: item.initials,
  active: item.active,
  last_active: item.last_active ?? null,
  cohort_ids: item.cohort_ids ?? [],
  department_ids: item.department_ids ?? [],
  primary_department_id: (() => {
    if (departmentId) return departmentId;
    if (
      "primary_department_id" in item &&
      typeof item.primary_department_id === "string"
    )
      return item.primary_department_id;
    if ("department_id" in item && typeof item.department_id === "string")
      return item.department_id;
    if (
      Array.isArray(item.department_ids) &&
      item.department_ids.length > 0 &&
      typeof item.department_ids[0] === "string"
    )
      return item.department_ids[0];
    return "";
  })(), // Use current departmentId, primary_department_id, department_id, or first in array
  requests_per_day: item.requests_per_day ?? null,
  total_requests: item.total_requests ?? 0,
  default_profile: item.default_profile,
  requests_in_last_day: item.requests_in_last_day ?? 0,
  can_edit: item.can_edit,
  can_delete: item.can_delete,
  can_remove: "can_remove" in item ? item.can_remove : false,
});

export interface DepartmentProps {
  departmentId?: string;
  // Optional server-provided data (for server-side rendering)
  departmentDetail?: DepartmentDetailOut;
  departmentDetailDefault?: DepartmentNewOut;
  // Server actions (replaces useMutation)
  createDepartmentAction?: (
    input: CreateDepartmentIn
  ) => Promise<CreateDepartmentOut>;
  updateDepartmentAction?: (
    input: UpdateDepartmentIn
  ) => Promise<UpdateDepartmentOut>;
  removeProfilesFromDepartmentAction?: (
    input: RemoveProfilesFromDepartmentIn
  ) => Promise<RemoveProfilesFromDepartmentOut>;
  duplicateDepartmentAction?: (
    input: DuplicateDepartmentIn
  ) => Promise<DuplicateDepartmentOut>;
  deleteDepartmentAction?: (
    input: DeleteDepartmentIn
  ) => Promise<DeleteDepartmentOut>;
  // Staff actions for StaffDataTable
  processCSVAction?: ProcessCSVAction;
  bulkCreateOrUpdateStaffAction?: BulkCreateOrUpdateStaffAction;
  searchStaffAction?: SearchStaffAction;
  initialSearchData?: SearchStaffOut;
  initialCreateStaffData?: CreateStaffDataOut;
  // Staff edit actions
  updateStaffAction?: UpdateStaffAction;
  // Key management actions
  createKeyAction?: (input: CreateKeyIn) => Promise<CreateKeyOut>;
  decryptKeyAction?: (input: DecryptKeyIn) => Promise<DecryptKeyOut>;
  updateKeyAction?: (input: UpdateKeyIn) => Promise<UpdateKeyOut>;
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

export default function Department({
  departmentId,
  departmentDetail: serverDepartmentDetail,
  departmentDetailDefault: serverDepartmentDetailDefault,
  createDepartmentAction,
  updateDepartmentAction,
  removeProfilesFromDepartmentAction,
  duplicateDepartmentAction: _duplicateDepartmentAction,
  deleteDepartmentAction,
  processCSVAction,
  bulkCreateOrUpdateStaffAction,
  searchStaffAction,
  initialSearchData,
  initialCreateStaffData,
  updateStaffAction,
  createKeyAction: _createKeyAction,
  decryptKeyAction: _decryptKeyAction,
  updateKeyAction: _updateKeyAction,
}: DepartmentProps) {
  const router = useRouter();
  const { effectiveProfile, scopedRoles } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Staff management state (for StaffDataTable)
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Edit modal state
  const [editProfileId, setEditProfileId] = useState<string | null>(null);
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Use server-provided data (no React Query needed when server data is provided)
  const departmentDetail = serverDepartmentDetail;
  const departmentDetailDefault = serverDepartmentDetailDefault;

  // Role options from scopedRoles
  const roleOptions = useMemo(() => {
    const roleLabels: Record<string, string> = {
      superadmin: "Super Administrator",
      admin: "Administrator",
      instructional: "Instructional Staff",
      ta: "Teaching Assistant",
      guest: "Guest",
    };
    return (scopedRoles || []).map((role) => ({
      value: role,
      label: roleLabels[role] || role,
    }));
  }, [scopedRoles]);

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
  type RemoveProfilesFromDepartmentBody =
    RemoveProfilesFromDepartmentIn extends { body: infer B } ? B : never;

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

  const handleRemoveProfilesFromDepartment = async (
    body: RemoveProfilesFromDepartmentBody
  ) => {
    if (!removeProfilesFromDepartmentAction) {
      throw new Error("removeProfilesFromDepartmentAction is required");
    }
    await removeProfilesFromDepartmentAction({ body });
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
        // UPDATE mode
        await handleUpdateDepartment({
          departmentId: departmentId,
          title: formData.title,
          description: formData.description,
          active: formData.active ?? true,
        });
        resetFormAndState();
        toast.success("Department updated successfully!");
        router.push("/departments");
      } else {
        // CREATE mode
        await handleCreateDepartment({
          title: formData.title,
          description: formData.description,
          active: formData.active ?? true,
          profile_id: effectiveProfile?.id || "",
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

        {/* Staff Management */}
        {departmentId && departmentData && (
          <div className="space-y-4">
            <StaffDataTable
              data={(departmentData.staff || []).map((item) =>
                normalizeDepartmentStaffItem(item, departmentId)
              )}
              cohortMapping={departmentData.cohort_mapping || {}}
              departmentMapping={departmentData.department_mapping || {}}
              roleOptions={roleOptions}
              cohortOptions={Object.entries(
                departmentData.cohort_mapping || {}
              ).map(([id, item]) => ({
                value: id,
                label: item.name,
              }))}
              lastActiveOptions={[
                { value: "recent", label: "Recently Active (< 7 days)" },
                { value: "moderate", label: "Moderately Active (7-30 days)" },
                { value: "old", label: "Inactive (> 30 days)" },
                { value: "never", label: "Never Active" },
              ]}
              isRefreshing={isRefreshing}
              onRefresh={async () => {
                setIsRefreshing(true);
                router.refresh();
                setIsRefreshing(false);
              }}
              departmentId={departmentId}
              {...(departmentId && { departmentIds: [departmentId] })}
              selectedStaffIds={selectedStaffIds}
              onStaffSelect={(id: string, checked: boolean) =>
                setSelectedStaffIds((prev: string[]) =>
                  checked ? [...prev, id] : prev.filter((x: string) => x !== id)
                )
              }
              onSelectAll={(checked: boolean, visibleRowIds?: string[]) => {
                if (checked && visibleRowIds) {
                  setSelectedStaffIds((prev: string[]) => {
                    const newSelection = [...prev];
                    visibleRowIds.forEach((id: string) => {
                      if (!newSelection.includes(id)) {
                        newSelection.push(id);
                      }
                    });
                    return newSelection;
                  });
                } else {
                  setSelectedStaffIds((prev: string[]) =>
                    prev.filter((id: string) => !visibleRowIds?.includes(id))
                  );
                }
              }}
              onCreate={async () => {
                // Refresh after create
                setIsRefreshing(true);
                router.refresh();
                setIsRefreshing(false);
              }}
              onPreview={(staff) => {
                window.open(
                  `/analytics/reports/p/${staff.profile_id}`,
                  "_blank",
                  "noopener,noreferrer"
                );
              }}
              onEdit={(staff) => {
                setEditProfileId(staff.profile_id);
              }}
              onDelete={() => {
                // Delete not available in scoped view
              }}
              onRemoveFromDepartment={async (staff) => {
                if (!departmentId) return;
                try {
                  await handleRemoveProfilesFromDepartment({
                    departmentId: departmentId,
                    profileIds: [staff.profile_id],
                  });
                  toast.success("Profile removed from department");
                  setIsRefreshing(true);
                  router.refresh();
                  setIsRefreshing(false);
                } catch (error) {
                  toast.error(
                    `Failed to remove profile: ${error instanceof Error ? error.message : "Unknown error"}`
                  );
                }
              }}
              onBulkEdit={() => {
                // Bulk edit can be implemented if needed
              }}
              onBulkDelete={async () => {
                if (selectedStaffIds.length === 0) return;
                // Filter selected staff that can be removed (use server-side can_remove)
                const removableIds = selectedStaffIds.filter((id) => {
                  const staff = (departmentData.staff || [])
                    .map((item) =>
                      normalizeDepartmentStaffItem(item, departmentId)
                    )
                    .find((s) => s.profile_id === id);
                  if (!staff) return false;
                  return (
                    (staff as ProfileListItemWithRemove).can_remove ?? false
                  );
                });

                if (removableIds.length === 0) {
                  toast.error(
                    "None of the selected staff members can be removed from the department."
                  );
                  return;
                }

                try {
                  await handleRemoveProfilesFromDepartment({
                    departmentId: departmentId,
                    profileIds: removableIds,
                  });
                  toast.success(
                    `Removed ${removableIds.length} profile(s) from department`
                  );
                  setSelectedStaffIds([]);
                  setIsRefreshing(true);
                  router.refresh();
                  setIsRefreshing(false);
                } catch (error) {
                  toast.error(
                    `Failed to remove profiles: ${error instanceof Error ? error.message : "Unknown error"}`
                  );
                }
              }}
              canRemove={(profileId) => {
                const staff = (departmentData.staff || [])
                  .map((item) =>
                    normalizeDepartmentStaffItem(item, departmentId)
                  )
                  .find((s) => s.profile_id === profileId);
                if (!staff) return false;
                return (staff as ProfileListItemWithRemove).can_remove ?? false;
              }}
              canDelete={() => false} // Delete not available in scoped view (use remove instead)
              deletableCount={
                selectedStaffIds.filter((id) => {
                  const staff = (departmentData.staff || [])
                    .map((item) =>
                      normalizeDepartmentStaffItem(item, departmentId)
                    )
                    .find((s) => s.profile_id === id);
                  if (!staff) return false;
                  return (
                    (staff as ProfileListItemWithRemove).can_remove ?? false
                  );
                }).length
              }
              canEdit={(profileId) => {
                const staff = (departmentData.staff || [])
                  .map((item) =>
                    normalizeDepartmentStaffItem(item, departmentId)
                  )
                  .find((s) => s.profile_id === profileId);
                return staff?.can_edit ?? false;
              }}
              editableCount={
                (departmentData.staff || [])
                  .map((item) =>
                    normalizeDepartmentStaffItem(item, departmentId)
                  )
                  .filter((s) => s.can_edit ?? false).length
              }
              {...(searchStaffAction && { searchStaffAction })}
              {...(processCSVAction && { processCSVAction })}
              {...(bulkCreateOrUpdateStaffAction && {
                bulkCreateOrUpdateStaffAction,
              })}
              {...(initialCreateStaffData && { initialCreateStaffData })}
              {...(initialSearchData && { initialSearchData })}
            />
          </div>
        )}

        {/* Edit Staff Modal */}
        {departmentId && updateStaffAction && departmentData && (
          <StaffEditModal
            profileId={editProfileId}
            open={!!editProfileId}
            onOpenChange={(open: boolean) => {
              if (!open) {
                setEditProfileId(null);
              }
            }}
            onDone={() => {
              setEditProfileId(null);
              router.refresh();
            }}
            updateStaffAction={updateStaffAction}
            staffItem={
              (departmentData.staff || [])
                .map((item) => normalizeDepartmentStaffItem(item, departmentId))
                .find((s) => s.profile_id === editProfileId) || null
            }
            validDepartmentIds={
              "valid_department_ids" in departmentData &&
              Array.isArray(departmentData.valid_department_ids)
                ? departmentData.valid_department_ids
                : []
            }
            departmentMapping={departmentData.department_mapping || {}}
          />
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
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
            disabled={isSubmitting || isReadonly}
            className="min-w-[120px]"
            data-testid="btn-submit-department"
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
