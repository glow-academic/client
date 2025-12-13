/**
 * StaffNewEdit.tsx
 * Used to create and manage staff - supports both creation and editing
 * @AshokSaravanan222
 * 12/04/2025
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";

import type {
  CreateStaffIn,
  CreateStaffOut,
  StaffNewOut,
} from "@/app/(main)/management/staff/new/page";
import type {
  StaffDetailOut,
  UpdateStaffIn,
  UpdateStaffOut,
} from "@/app/(main)/management/staff/p/[profileId]/page";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { STAFF_ROLES } from "@/components/common/forms/staff-roles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Check, CheckCircle2, Clock, PlusCircle, Trash2, User } from "lucide-react";

interface FormData {
  firstName?: string;
  lastName?: string;
  emails?: string[];
  primaryEmailIndex?: number;
  role?: string;
  reqPerDay?: number | "";
  requestsPerDayEnabled?: boolean;
  primaryDepartmentId?: string;
  active?: boolean;
}

export interface StaffNewEditProps {
  profileId?: string;
  mode?: "create" | "edit";
  // Server-provided data (for server-side rendering)
  staffDetail?: StaffDetailOut;
  staffDetailDefault?: StaffNewOut;
  // Server actions
  createStaffAction?: (input: CreateStaffIn) => Promise<CreateStaffOut>;
  updateStaffAction?: (input: UpdateStaffIn) => Promise<UpdateStaffOut>;
}

export default function StaffNewEdit({
  profileId,
  mode = profileId ? "edit" : "create",
  staffDetail: serverStaffDetail,
  staffDetailDefault: serverStaffDetailDefault,
  createStaffAction,
  updateStaffAction,
}: StaffNewEditProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!profileId;
  const { effectiveProfile, scopedRoles } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const initialFormData: FormData = useMemo(
    () => ({
      firstName: "",
      lastName: "",
      emails: [""],
      primaryEmailIndex: 0,
      role: "instructional",
      reqPerDay: "",
      requestsPerDayEnabled: false,
      primaryDepartmentId: "",
      active: true,
    }),
    [],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [requestsPerDayEnabled, setRequestsPerDayEnabled] = useState(false);

  // Use server-provided data directly
  const staffDetail = serverStaffDetail;
  const staffDetailDefault = serverStaffDetailDefault;

  // Use edit detail when editing, default detail when creating
  const staffData = isEditMode ? staffDetail : staffDetailDefault;

  // Extract body types for type safety
  type CreateStaffBody = CreateStaffIn extends { body: infer B } ? B : never;
  type UpdateStaffBody = UpdateStaffIn extends { body: infer B } ? B : never;

  // Server action handlers
  const handleCreateStaff = async (body: CreateStaffBody) => {
    if (!createStaffAction) {
      throw new Error("createStaffAction is required");
    }
    await createStaffAction({ body });
  };

  const handleUpdateStaff = async (body: UpdateStaffBody) => {
    if (!updateStaffAction) {
      throw new Error("updateStaffAction is required");
    }
    await updateStaffAction({ body });
  };

  // Readonly logic using permission flags
  const isReadonly = useMemo(() => {
    if (!isEditMode || !staffData) return false;
    return !staffData.can_edit;
  }, [isEditMode, staffData]);

  // Initialize form data
  useEffect(() => {
    if (staffData && isEditMode) {
      const emails = staffData.emails || [];
      const primaryIndex =
        emails.length > 0
          ? emails.findIndex(
              (e) => e === (staffData as { primary_email?: string | null })?.primary_email || e === emails[0],
            )
          : 0;
      setFormData({
        firstName: staffData.first_name || "",
        lastName: staffData.last_name || "",
        emails: emails.length > 0 ? emails : [""],
        primaryEmailIndex: primaryIndex >= 0 ? primaryIndex : 0,
        role: staffData.role || "",
        reqPerDay: staffData.requests_per_day ?? "",
        requestsPerDayEnabled: staffData.requests_per_day != null,
        primaryDepartmentId: staffData.primary_department_id || "",
        active: staffData.active ?? true,
      });
      setRequestsPerDayEnabled(staffData.requests_per_day != null);
    } else if (!isEditMode && staffData) {
      // For create mode, use defaults from the API response
      setFormData({
        ...initialFormData,
        firstName: staffData.first_name || "",
        lastName: staffData.last_name || "",
        emails: staffData.emails || [""],
        role: staffData.role || initialFormData.role || "",
        primaryDepartmentId: staffData.primary_department_id || "",
        active: staffData.active ?? true,
      });
    }
  }, [staffData, isEditMode, initialFormData]);

  // Set breadcrumb context when staff data is loaded
  useEffect(() => {
    if (staffDetail?.name && profileId && isEditMode) {
      // Note: "staff" is not in EntityMetadata union type, so we skip breadcrumb metadata
      // setEntityMetadata({
      //   entityId: profileId,
      //   entityName: staffDetail.name,
      //   entityType: "staff",
      // });
    }
    return () => clearEntityMetadata();
  }, [
    staffDetail,
    profileId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Email management functions
  const addEmail = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      emails: [...(prev?.emails || [""]), ""],
    }));
  }, []);

  const removeEmail = useCallback((index: number) => {
    setFormData((prev) => {
      const newEmails = (prev?.emails || [""]).filter((_, i) => i !== index);
      // Ensure at least one email
      if (newEmails.length === 0) {
        return { ...prev, emails: [""], primaryEmailIndex: 0 };
      }
      // Adjust primary index if needed
      let newPrimaryIndex = prev?.primaryEmailIndex || 0;
      if (index === newPrimaryIndex) {
        // If removing primary, set first email as primary
        newPrimaryIndex = 0;
      } else if (index < newPrimaryIndex) {
        // If removing before primary, adjust index
        newPrimaryIndex = newPrimaryIndex - 1;
      }
      return { ...prev, emails: newEmails, primaryEmailIndex: newPrimaryIndex };
    });
  }, []);

  const updateEmail = useCallback((index: number, value: string) => {
    setFormData((prev) => {
      const newEmails = [...(prev?.emails || [""])];
      newEmails[index] = value;
      return { ...prev, emails: newEmails };
    });
  }, []);

  const setPrimaryEmail = useCallback((index: number) => {
    setFormData((prev) => ({ ...prev, primaryEmailIndex: index }));
  }, []);

  const handleInputChange = useCallback(
    (field: string, value: string | number | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData?.firstName || !formData?.lastName) {
      toast.error("First name and last name are required");
      return;
    }

    // Validate emails
    const validEmails = (formData.emails || []).filter(
      (e) => e.trim().length > 0,
    );
    if (validEmails.length === 0) {
      toast.error("At least one email is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const parsedReqPerDay =
        !requestsPerDayEnabled ||
        formData.reqPerDay === "" ||
        formData.reqPerDay === undefined
          ? null // Unlimited
          : Number(formData.reqPerDay);

      if (isEditMode) {
        // Update staff
        const departmentId =
          formData.primaryDepartmentId ||
          (staffData?.valid_department_ids &&
          staffData.valid_department_ids.length > 0
            ? staffData.valid_department_ids[0]
            : "") ||
          "";

        if (!updateStaffAction) {
          toast.error("Update action not available");
          setIsSubmitting(false);
          return;
        }

        await handleUpdateStaff({
          profileId: profileId!,
          first_name: formData.firstName,
          last_name: formData.lastName,
          emails: validEmails,
          primary_email_index:
            formData.primaryEmailIndex != null &&
            formData.primaryEmailIndex >= 0 &&
            formData.primaryEmailIndex < validEmails.length
              ? formData.primaryEmailIndex
              : 0,
          role: formData.role || "",
          requests_per_day: parsedReqPerDay,
          primary_department_id: departmentId,
          active: formData.active ?? true,
        });

        toast.success("Staff updated successfully!");
        router.push("/management/staff");
      } else {
        // Create staff
        if (!createStaffAction) {
          toast.error("Create action not available");
          setIsSubmitting(false);
          return;
        }

        await handleCreateStaff({
          firstName: formData.firstName,
          lastName: formData.lastName,
          emails: validEmails,
          primary_email_index:
            formData.primaryEmailIndex != null &&
            formData.primaryEmailIndex >= 0 &&
            formData.primaryEmailIndex < validEmails.length
              ? formData.primaryEmailIndex
              : 0,
          role: formData.role || "",
          primary_department_id: formData.primaryDepartmentId || null,
        });

        toast.success("Staff created successfully!");
        router.push("/management/staff");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} staff: ${errorMessage}`,
      );
      setIsSubmitting(false);
    }
  };

  return (
    <TooltipProvider>
      <div
        className="space-y-6 py-4 px-4"
        data-page={`staff-${isEditMode ? "edit" : "new"}`}
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
                  Staff is read-only
                </h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>
                    This staff member cannot be edited. You can view the details
                    but cannot make changes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="w-full">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                {formData?.firstName !== undefined ? (
                  <Input
                    id="firstName"
                    data-testid="input-staff-first-name"
                    value={formData.firstName}
                    onChange={(e) =>
                      handleInputChange("firstName", e.target.value)
                    }
                    placeholder="Jane"
                    required
                    disabled={isReadonly || isSubmitting}
                  />
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                {formData?.lastName !== undefined ? (
                  <Input
                    id="lastName"
                    data-testid="input-staff-last-name"
                    value={formData.lastName}
                    onChange={(e) =>
                      handleInputChange("lastName", e.target.value)
                    }
                    placeholder="Smith"
                    required
                    disabled={isReadonly || isSubmitting}
                  />
                ) : null}
              </div>
            </div>

            {/* Emails Section */}
            <div className="space-y-2">
              <Label>Emails *</Label>
              {formData?.emails !== undefined ? (
                <div className="space-y-2">
                  {formData.emails.map((email, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => updateEmail(index, e.target.value)}
                          placeholder="redacted@purdue.edu"
                          disabled={isReadonly || isSubmitting}
                          data-testid={`input-staff-email-${index}`}
                          className={
                            formData.primaryEmailIndex === index
                              ? "border-primary"
                              : ""
                          }
                          required={index === 0}
                        />
                        {formData.primaryEmailIndex === index && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary font-medium">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant={
                            formData.primaryEmailIndex === index
                              ? "default"
                              : "outline"
                          }
                          size="icon"
                          onClick={() => setPrimaryEmail(index)}
                          disabled={
                            isReadonly ||
                            isSubmitting ||
                            formData.primaryEmailIndex === index
                          }
                          className="h-8 w-8 shrink-0"
                          title="Set as primary"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        {formData?.emails && formData.emails.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeEmail(index)}
                            disabled={isReadonly || isSubmitting}
                            className="h-8 w-8 shrink-0"
                            title="Remove email"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addEmail}
                    disabled={isReadonly || isSubmitting}
                    size="sm"
                    className="w-full"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" /> Add email
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Role Section */}
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              {formData?.role !== undefined ? (
                <div data-testid="input-staff-role">
                  <GenericPicker
                    items={STAFF_ROLES.filter((r) =>
                      (scopedRoles || []).includes(r.id)
                    )}
                    selectedIds={formData.role ? [formData.role] : []}
                    onSelect={(ids) => handleInputChange("role", ids[0] || "")}
                    getId={(role) => role.id}
                    getLabel={(role) => role.name}
                    getSearchText={(role) => `${role.name} ${role.description || ""}`}
                    renderItem={(role, isSelected) => {
                      const IconComponent = role.icon || User;
                      const hexColor = role.color || "#64748b";
                      const generateGradient = (hex: string) => {
                        const cleanHex = hex.replace("#", "");
                        const r = parseInt(cleanHex.substr(0, 2), 16);
                        const g = parseInt(cleanHex.substr(2, 2), 16);
                        const b = parseInt(cleanHex.substr(4, 2), 16);
                        const lighterR = Math.min(255, r + 60);
                        const lighterG = Math.min(255, g + 60);
                        const lighterB = Math.min(255, b + 60);
                        const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                        return `linear-gradient(135deg, ${lighterHex} 0%, ${hex} 100%)`;
                      };
                      return (
                        <div className="flex items-center gap-3 w-full">
                          <div
                            className="p-2 rounded-lg shadow-lg flex-shrink-0"
                            style={{
                              background: generateGradient(hexColor),
                            }}
                          >
                            <IconComponent className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{role.name}</div>
                            {role.description && (
                              <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                {role.description}
                              </div>
                            )}
                          </div>
                          <Check
                            className={cn(
                              "ml-auto",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                        </div>
                      );
                    }}
                    renderButton={(selectedItems) => {
                      if (selectedItems.length === 0) return "Select role...";
                      const role = selectedItems[0];
                      const IconComponent = role?.icon || User;
                      const hexColor = role?.color || "#64748b";
                      const generateGradient = (hex: string) => {
                        const cleanHex = hex.replace("#", "");
                        const r = parseInt(cleanHex.substr(0, 2), 16);
                        const g = parseInt(cleanHex.substr(2, 2), 16);
                        const b = parseInt(cleanHex.substr(4, 2), 16);
                        const lighterR = Math.min(255, r + 60);
                        const lighterG = Math.min(255, g + 60);
                        const lighterB = Math.min(255, b + 60);
                        const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                        return `linear-gradient(135deg, ${lighterHex} 0%, ${hex} 100%)`;
                      };
                      return (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="p-1 rounded-md shadow-sm flex-shrink-0"
                            style={{
                              background: generateGradient(hexColor),
                            }}
                          >
                            <IconComponent className="h-3.5 w-3.5 text-white" />
                          </div>
                          <span className="truncate">{role?.name || "Select role"}</span>
                        </div>
                      );
                    }}
                    placeholder="Select role"
                    multiSelect={false}
                    hideSelectedChips={true}
                    disabled={isReadonly || isSubmitting}
                    buttonClassName="h-10"
                    groupHeading="Staff Roles"
                  />
                </div>
              ) : null}
            </div>

            {/* Requests Per Day Section */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="requestsPerDayEnabled"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Requests per day
                  </Label>
                  <Switch
                    id="requestsPerDayEnabled"
                    checked={requestsPerDayEnabled}
                    onCheckedChange={(checked) => {
                      setRequestsPerDayEnabled(checked);
                      if (!checked) {
                        handleInputChange("reqPerDay", "");
                      }
                    }}
                    disabled={isReadonly || isSubmitting}
                  />
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Set a daily request limit for this staff member
                </p>
                {requestsPerDayEnabled && (
                  <div className="space-y-2 pt-2">
                    <Input
                      id="reqPerDay"
                      type="number"
                      value={
                        formData?.reqPerDay === ""
                          ? ""
                          : String(formData?.reqPerDay || "")
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          handleInputChange("reqPerDay", "");
                        } else {
                          const num = parseInt(val, 10);
                          handleInputChange(
                            "reqPerDay",
                            Number.isNaN(num) ? "" : num,
                          );
                        }
                      }}
                      placeholder="e.g. 100"
                      min={1}
                      step={1}
                      disabled={isReadonly || isSubmitting}
                      data-testid="input-staff-requests-per-day"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Primary Department Section (superadmin only) */}
            {isSuperadmin &&
              staffData?.valid_department_ids &&
              staffData.valid_department_ids.length > 1 && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="primaryDepartment">Primary Department</Label>
                  {formData?.primaryDepartmentId !== undefined ? (
                    <GenericPicker
                      items={staffData?.department_mapping || {}}
                      itemIds={staffData?.valid_department_ids || []}
                      selectedIds={
                        formData.primaryDepartmentId
                          ? [formData.primaryDepartmentId]
                          : []
                      }
                      onSelect={(ids) => {
                        const deptId = ids.length > 0 ? ids[0] : "";
                        if (deptId !== undefined) {
                          handleInputChange("primaryDepartmentId", deptId);
                        }
                      }}
                      getId={(dept) => (dept as unknown as { id: string }).id}
                      getLabel={(dept) => dept.name || ""}
                      getSearchText={(dept) => `${dept.name} ${dept.description || ""}`}
                      multiSelect={false}
                      placeholder="Select primary department"
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Set the primary department for this staff member
                  </p>
                </div>
              )}

            {/* Active Switch (edit mode only) */}
            {isEditMode && (
              <div className="space-y-2 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="active"
                      className="text-sm flex items-center gap-1.5"
                    >
                      Active
                    </Label>
                    {formData?.active !== undefined ? (
                      <Switch
                        id="active"
                        checked={formData.active ?? true}
                        onCheckedChange={(checked) =>
                          handleInputChange("active", checked)
                        }
                        disabled={isReadonly || isSubmitting}
                      />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Whether this staff member is active
                  </p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
                data-testid="btn-cancel-staff"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isReadonly || isSubmitting}
                data-testid="btn-submit-staff"
              >
                {isSubmitting
                  ? isEditMode
                    ? "Updating..."
                    : "Creating..."
                  : isEditMode
                    ? "Update Staff"
                    : "Create Staff"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </TooltipProvider>
  );
}
