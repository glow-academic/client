/**
 * StaffNewEdit.tsx
 * Used to create and manage staff - supports both creation and editing
 * @AshokSaravanan222
 * 12/04/2025
 */
"use client";

import { Switch } from "@/components/ui/switch";
import { Check, Clock, Power, Search } from "lucide-react";
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
import { StaffCohortsSection } from "@/components/staff/StaffCohortsSection";
import { StaffEmailsSection } from "@/components/staff/StaffEmailsSection";
import { StaffRoleSection } from "@/components/staff/StaffRoleSection";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

interface FormData {
  firstName?: string;
  lastName?: string;
  emails?: string[];
  primaryEmailIndex?: number | undefined;
  role?: string;
  reqPerDay?: number | "";
  requestsPerDayEnabled?: boolean;
  cohortIds?: string[];
  departmentIds?: string[];
  primaryDepartmentIndex?: number | undefined;
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
  const { scopedRoles } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  const initialFormData: FormData = useMemo(
    () => ({
      firstName: "",
      lastName: "",
      emails: [],
      primaryEmailIndex: undefined,
      role: "instructional",
      reqPerDay: "",
      requestsPerDayEnabled: false,
      cohortIds: [],
      departmentIds: [],
      primaryDepartmentIndex: undefined,
      active: true,
    }),
    [],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [requestsPerDayEnabled, setRequestsPerDayEnabled] = useState(false);
  const [primaryDeptSearchTerm, setPrimaryDeptSearchTerm] = useState("");

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
              (e) =>
                e ===
                  (staffData as { primary_email?: string | null })
                    ?.primary_email || e === emails[0],
            )
          : undefined;
      // Type guard: StaffDetailOut has department_ids, StaffNewOut doesn't
      const departmentIds =
        "department_ids" in staffData && staffData.department_ids
          ? staffData.department_ids
          : [];
      const primaryDeptIndex =
        departmentIds.length > 0 && "primary_department_id" in staffData
          ? departmentIds.findIndex(
              (id: string) => id === staffData.primary_department_id,
            )
          : -1;
      // Type guard: StaffDetailOut has cohort_ids, StaffNewOut doesn't
      const cohortIds =
        "cohort_ids" in staffData && staffData.cohort_ids
          ? staffData.cohort_ids
          : [];
      setFormData({
        firstName: staffData.first_name || "",
        lastName: staffData.last_name || "",
        emails: emails,
        primaryEmailIndex:
          primaryIndex !== undefined && primaryIndex >= 0
            ? primaryIndex
            : undefined,
        role: staffData.role || "",
        reqPerDay: staffData.requests_per_day ?? "",
        requestsPerDayEnabled: staffData.requests_per_day != null,
        cohortIds: cohortIds,
        departmentIds: departmentIds,
        primaryDepartmentIndex:
          primaryDeptIndex >= 0 ? primaryDeptIndex : undefined,
        active: staffData.active ?? true,
      });
      setRequestsPerDayEnabled(staffData.requests_per_day != null);
    } else if (!isEditMode && staffData) {
      // For create mode, use defaults from the API response
      setFormData({
        ...initialFormData,
        firstName: staffData.first_name || "",
        lastName: staffData.last_name || "",
        emails: staffData.emails || [],
        role: staffData.role || initialFormData.role || "",
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

  const handleInputChange = useCallback(
    (
      field: string,
      value: string | number | boolean | string[] | undefined,
    ) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasFirstName = !!formData?.firstName?.trim();
      const hasRole = !!formData?.role?.trim();
      const hasDepartments =
        (formData?.departmentIds || []).length > 0 ||
        (staffData?.valid_department_ids || []).length > 1;
      const hasPrimaryDepartment =
        formData?.primaryDepartmentIndex !== undefined &&
        formData.primaryDepartmentIndex >= 0;
      const hasEmails = (formData?.emails || []).some(
        (e) => e.trim().length > 0,
      );
      const hasPrimaryEmail =
        formData?.primaryEmailIndex !== undefined &&
        formData.primaryEmailIndex >= 0;

      switch (stepId) {
        case "role":
          if (!hasFirstName) return "pending";
          return hasRole ? "completed" : "active";
        case "primaryDepartment":
          if (!hasFirstName || !hasRole) return "pending";
          // Only show as required if there are multiple departments
          if (!hasDepartments) return "pending";
          return hasPrimaryDepartment ? "completed" : "active";
        case "emails":
          if (!hasFirstName || !hasRole) return "pending";
          // If departments exist, require primary department first
          if (hasDepartments && !hasPrimaryDepartment) return "pending";
          return hasEmails && hasPrimaryEmail ? "completed" : "active";
        case "cohorts":
          // Cohorts are optional, so always completed if previous steps are done
          if (!hasFirstName || !hasRole) return "pending";
          if (hasDepartments && !hasPrimaryDepartment) return "pending";
          if (!hasEmails || !hasPrimaryEmail) return "pending";
          return "completed";
        default:
          return "pending";
      }
    },
    [formData, staffData],
  );

  // Steps array
  const steps: Step[] = useMemo(() => {
    const hasDepartments =
      (formData?.departmentIds || []).length > 0 ||
      (staffData?.valid_department_ids || []).length > 1;
    const baseSteps: Step[] = [
      {
        id: "role",
        title: "Role",
        description: "Select a role for this staff member.",
        status: getStepStatus("role"),
      },
    ];

    // Add Primary Department step if there are multiple departments
    if (hasDepartments) {
      baseSteps.push({
        id: "primaryDepartment",
        title: "Primary Department",
        description:
          "Select which department is primary for this staff member.",
        status: getStepStatus("primaryDepartment"),
      });
    }

    baseSteps.push(
      {
        id: "emails",
        title: "Email",
        description: "Select the primary email address for this staff member.",
        status: getStepStatus("emails"),
      },
      {
        id: "cohorts",
        title: "Cohorts",
        description: "Select cohorts for this staff member (optional).",
        status: getStepStatus("cohorts"),
      },
    );

    return baseSteps;
  }, [getStepStatus, formData, staffData]);

  // Filtered departments for primary department selection
  const filteredPrimaryDeptIds = useMemo(() => {
    if (
      !formData ||
      !staffData?.department_mapping ||
      !staffData?.valid_department_ids
    ) {
      return [];
    }
    const availableDeptIds =
      (formData.departmentIds?.length || 0) === 0
        ? staffData.valid_department_ids || []
        : formData.departmentIds || [];

    if (!primaryDeptSearchTerm.trim()) {
      return availableDeptIds;
    }

    const searchLower = primaryDeptSearchTerm.toLowerCase();
    return availableDeptIds.filter((deptId) => {
      const dept = staffData.department_mapping?.[deptId];
      return (
        dept?.name?.toLowerCase().includes(searchLower) ||
        dept?.description?.toLowerCase().includes(searchLower)
      );
    });
  }, [
    formData,
    staffData?.valid_department_ids,
    staffData?.department_mapping,
    primaryDeptSearchTerm,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData?.firstName || typeof formData.firstName !== "string") {
      toast.error("First name is required");
      return;
    }

    if (!formData.lastName || typeof formData.lastName !== "string") {
      // lastName is optional, but we need it to be a string if present
      formData.lastName = "";
    }

    // Validate emails
    const validEmails = (formData.emails || []).filter(
      (e) => e.trim().length > 0,
    );
    if (validEmails.length === 0) {
      toast.error("At least one email is required");
      return;
    }

    // Validate primary email index
    if (
      formData.primaryEmailIndex === undefined ||
      formData.primaryEmailIndex < 0 ||
      formData.primaryEmailIndex >= validEmails.length
    ) {
      toast.error("Please select a primary email");
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
        if (!updateStaffAction) {
          toast.error("Update action not available");
          setIsSubmitting(false);
          return;
        }

        // Determine which departments to use for primary index calculation
        const deptIdsForPrimary =
          (formData.departmentIds?.length || 0) === 0
            ? staffData?.valid_department_ids || []
            : formData.departmentIds || [];

        await handleUpdateStaff({
          profileId: profileId!,
          first_name: formData.firstName,
          last_name: formData.lastName || "",
          emails: validEmails,
          primary_email_index:
            formData.primaryEmailIndex != null &&
            formData.primaryEmailIndex >= 0 &&
            formData.primaryEmailIndex < validEmails.length
              ? formData.primaryEmailIndex
              : null,
          role: formData.role || "",
          requests_per_day: parsedReqPerDay,
          cohort_ids: formData.cohortIds || [],
          department_ids: formData.departmentIds || [],
          primary_department_index:
            formData.primaryDepartmentIndex != null &&
            formData.primaryDepartmentIndex >= 0 &&
            formData.primaryDepartmentIndex < deptIdsForPrimary.length
              ? formData.primaryDepartmentIndex
              : null,
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

        // Determine which departments to use for primary index calculation
        const deptIdsForPrimary =
          (formData.departmentIds?.length || 0) === 0
            ? staffData?.valid_department_ids || []
            : formData.departmentIds || [];

        await handleCreateStaff({
          firstName: formData.firstName,
          lastName: formData.lastName || "",
          emails: validEmails,
          primary_email_index:
            formData.primaryEmailIndex != null &&
            formData.primaryEmailIndex >= 0 &&
            formData.primaryEmailIndex < validEmails.length
              ? formData.primaryEmailIndex
              : null,
          role: formData.role || "",
          cohort_ids: formData.cohortIds || [],
          department_ids: formData.departmentIds || [],
          primary_department_index:
            formData.primaryDepartmentIndex != null &&
            formData.primaryDepartmentIndex >= 0 &&
            formData.primaryDepartmentIndex < deptIdsForPrimary.length
              ? formData.primaryDepartmentIndex
              : null,
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
        className="w-full p-6 space-y-8"
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
          <form onSubmit={handleSubmit}>
            <div className="space-y-8">
              {/* First Name Section */}
              {formData?.firstName !== undefined &&
                staffData?.department_mapping &&
                staffData?.valid_department_ids !== undefined && (
                  <Card className="transition-all">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div>
                          <input
                            type="text"
                            id="firstName"
                            data-testid="input-staff-first-name"
                            value={formData.firstName}
                            onChange={(e) =>
                              handleInputChange("firstName", e.target.value)
                            }
                            className={cn(
                              "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20",
                            )}
                            placeholder="First Name"
                            required
                            disabled={isReadonly || isSubmitting}
                          />
                          <p className="text-xs text-muted-foreground mt-1 px-2">
                            {formData.firstName === "" || !formData.firstName
                              ? "Click to edit • Name will be auto-generated if unchanged"
                              : "Click to edit"}
                          </p>
                        </div>

                        {/* Last Name */}
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            data-testid="input-staff-last-name"
                            value={formData.lastName || ""}
                            onChange={(e) =>
                              handleInputChange("lastName", e.target.value)
                            }
                            placeholder="Last Name (optional)"
                            disabled={isReadonly || isSubmitting}
                          />
                        </div>

                        {/* Department Selection */}
                        {staffData.valid_department_ids.length > 1 && (
                          <div className="space-y-2">
                            <Label htmlFor="department">Department</Label>
                            {formData?.departmentIds !== undefined ? (
                              <GenericPicker
                                items={staffData.department_mapping}
                                itemIds={Array.from(
                                  new Set([
                                    ...staffData.valid_department_ids,
                                    ...(formData.departmentIds || []),
                                  ]),
                                )}
                                selectedIds={formData.departmentIds || []}
                                onSelect={(ids) => {
                                  handleInputChange("departmentIds", ids);
                                  // Update primary department index if needed
                                  const currentPrimaryId =
                                    formData?.departmentIds &&
                                    formData?.primaryDepartmentIndex !==
                                      undefined &&
                                    formData.primaryDepartmentIndex >= 0 &&
                                    formData.primaryDepartmentIndex <
                                      formData.departmentIds.length
                                      ? formData.departmentIds[
                                          formData.primaryDepartmentIndex
                                        ]
                                      : undefined;
                                  if (
                                    currentPrimaryId &&
                                    ids.includes(currentPrimaryId)
                                  ) {
                                    // Keep the same primary if it's still in the list
                                    const newIndex =
                                      ids.indexOf(currentPrimaryId);
                                    handleInputChange(
                                      "primaryDepartmentIndex",
                                      newIndex,
                                    );
                                  } else if (ids.length > 0) {
                                    // Set first department as primary if none selected
                                    if (
                                      formData?.primaryDepartmentIndex ===
                                      undefined
                                    ) {
                                      handleInputChange(
                                        "primaryDepartmentIndex",
                                        0,
                                      );
                                    }
                                  } else {
                                    // Clear primary if no departments
                                    handleInputChange(
                                      "primaryDepartmentIndex",
                                      undefined,
                                    );
                                  }
                                }}
                                getId={(dept) =>
                                  (dept as unknown as { id: string }).id
                                }
                                getLabel={(dept) => dept.name || ""}
                                getSearchText={(dept) =>
                                  `${dept.name} ${dept.description || ""}`
                                }
                                placeholder="All Departments"
                                disabled={isReadonly}
                                multiSelect={true}
                                hideSelectedChips={true}
                                buttonClassName="w-full"
                              />
                            ) : null}
                          </div>
                        )}

                        {/* Active Switch */}
                        <div className="space-y-2 pt-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor="active"
                                className="text-sm flex items-center gap-1.5"
                              >
                                <Power className="h-3.5 w-3.5 text-muted-foreground" />
                                Active
                              </label>
                              <Switch
                                id="active"
                                checked={formData.active ?? true}
                                onCheckedChange={(checked) =>
                                  handleInputChange("active", checked)
                                }
                                disabled={isReadonly || isSubmitting}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground pl-5">
                              Whether this staff member is active
                            </p>
                          </div>
                        </div>

                        {/* Requests Per Day Switch */}
                        <div className="space-y-2 pt-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor="requestsPerDayEnabled"
                                className="text-sm flex items-center gap-1.5"
                              >
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                Requests per day
                              </label>
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
                            {!requestsPerDayEnabled && (
                              <p className="text-xs text-muted-foreground pl-6">
                                Set a daily request limit for this staff member
                              </p>
                            )}
                            {requestsPerDayEnabled && (
                              <div className="space-y-2 pt-2 pl-6">
                                <Input
                                  id="reqPerDay"
                                  type="number"
                                  value={
                                    formData.reqPerDay === ""
                                      ? ""
                                      : String(formData.reqPerDay)
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
                                  placeholder="Enter number"
                                  min={1}
                                  step={1}
                                  disabled={isReadonly || isSubmitting}
                                  data-testid="input-staff-requests-per-day"
                                  className="w-full"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

              {/* Step 1: Role */}
              {formData?.role !== undefined && (
                <Card
                  className={cn(
                    "transition-all",
                    !isEditMode &&
                      steps[0]?.status === "active" &&
                      "ring-2 ring-primary",
                    !isEditMode &&
                      steps[0]?.status === "pending" &&
                      "opacity-50",
                  )}
                >
                  <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
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
                      <div>
                        <CardTitle className="text-lg">
                          {steps[0]?.title || "Role"}
                        </CardTitle>
                        <CardDescription>
                          {steps[0]?.description ||
                            "Select a role for this staff member."}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 px-6">
                    <StaffRoleSection
                      role={formData.role}
                      scopedRoles={scopedRoles || []}
                      onRoleChange={(role) => handleInputChange("role", role)}
                      isReadonly={isReadonly}
                      isSubmitting={isSubmitting}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Primary Department */}
              {formData?.departmentIds !== undefined &&
                staffData?.department_mapping &&
                staffData?.valid_department_ids !== undefined &&
                (formData.departmentIds.length > 0 ||
                  staffData.valid_department_ids.length > 1) && (
                  <Card
                    className={cn(
                      "transition-all",
                      !isEditMode &&
                        steps[1]?.status === "active" &&
                        "ring-2 ring-primary",
                      !isEditMode &&
                        steps[1]?.status === "pending" &&
                        "opacity-50",
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
                            {steps[1]?.title || "Primary Department"}
                          </CardTitle>
                          <CardDescription>
                            {steps[1]?.description ||
                              "Select which department is primary for this staff member."}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 px-6">
                      {/* Search Bar */}
                      <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
                        <Search className="size-4 shrink-0 opacity-50" />
                        <input
                          type="text"
                          placeholder="Search departments..."
                          value={primaryDeptSearchTerm}
                          onChange={(e) =>
                            setPrimaryDeptSearchTerm(e.target.value)
                          }
                          className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isReadonly}
                        />
                      </div>

                      {/* Filtered departments */}
                      {!filteredPrimaryDeptIds ||
                      filteredPrimaryDeptIds.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No departments found. Try adjusting your search.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredPrimaryDeptIds.map((deptId) => {
                            const dept = staffData.department_mapping[deptId];
                            // For primary selection, if departmentIds is empty, use all valid departments
                            const availableDeptIds =
                              (formData.departmentIds?.length || 0) === 0
                                ? staffData.valid_department_ids
                                : formData.departmentIds || [];
                            const isPrimary =
                              formData?.primaryDepartmentIndex !== undefined &&
                              formData.primaryDepartmentIndex >= 0 &&
                              formData.primaryDepartmentIndex <
                                availableDeptIds.length &&
                              availableDeptIds[
                                formData.primaryDepartmentIndex
                              ] === deptId;

                            return (
                              <div
                                key={deptId}
                                className={cn(
                                  "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all cursor-pointer",
                                  "hover:shadow-md hover:bg-accent/50",
                                  isPrimary && "ring-2 ring-primary bg-accent",
                                )}
                                onClick={() => {
                                  if (!isReadonly) {
                                    const index =
                                      availableDeptIds.indexOf(deptId);
                                    handleInputChange(
                                      "primaryDepartmentIndex",
                                      index,
                                    );
                                  }
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-sm leading-tight">
                                      {dept?.name || "Unnamed Department"}
                                    </h3>
                                    {dept?.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {dept.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

              {/* Step 3: Email */}
              {formData?.emails !== undefined && (
                <Card
                  className={cn(
                    "transition-all",
                    !isEditMode &&
                      steps.find((s) => s.id === "emails")?.status ===
                        "active" &&
                      "ring-2 ring-primary",
                    !isEditMode &&
                      steps.find((s) => s.id === "emails")?.status ===
                        "pending" &&
                      "opacity-50",
                  )}
                >
                  <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                          steps.find((s) => s.id === "emails")?.status ===
                            "completed"
                            ? "bg-green-500 text-white"
                            : steps.find((s) => s.id === "emails")?.status ===
                                "active"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted",
                        )}
                      >
                        {steps.find((s) => s.id === "emails")?.status ===
                        "completed" ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span>
                            {steps.findIndex((s) => s.id === "emails") + 1}
                          </span>
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {steps.find((s) => s.id === "emails")?.title ||
                            "Email"}
                        </CardTitle>
                        <CardDescription>
                          {steps.find((s) => s.id === "emails")?.description ||
                            "Select the primary email address for this staff member."}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 px-6">
                    <StaffEmailsSection
                      emails={formData.emails}
                      primaryEmailIndex={formData.primaryEmailIndex}
                      onEmailsChange={(emails) =>
                        handleInputChange("emails", emails)
                      }
                      onPrimaryEmailIndexChange={(index) =>
                        handleInputChange("primaryEmailIndex", index)
                      }
                      isReadonly={isReadonly}
                      isSubmitting={isSubmitting}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 4: Cohorts */}
              {staffData?.cohort_mapping &&
                "valid_cohort_ids" in staffData &&
                staffData.valid_cohort_ids !== undefined && (
                  <Card
                    className={cn(
                      "transition-all",
                      !isEditMode &&
                        steps.find((s) => s.id === "cohorts")?.status ===
                          "active" &&
                        "ring-2 ring-primary",
                      !isEditMode &&
                        steps.find((s) => s.id === "cohorts")?.status ===
                          "pending" &&
                        "opacity-50",
                    )}
                  >
                    <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                            steps.find((s) => s.id === "cohorts")?.status ===
                              "completed"
                              ? "bg-green-500 text-white"
                              : steps.find((s) => s.id === "cohorts")
                                    ?.status === "active"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted",
                          )}
                        >
                          {steps.find((s) => s.id === "cohorts")?.status ===
                          "completed" ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <span>
                              {steps.findIndex((s) => s.id === "cohorts") + 1}
                            </span>
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {steps.find((s) => s.id === "cohorts")?.title ||
                              "Cohorts"}
                          </CardTitle>
                          <CardDescription>
                            {steps.find((s) => s.id === "cohorts")
                              ?.description ||
                              "Select cohorts for this staff member (optional)."}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 px-6">
                      <StaffCohortsSection
                        cohortIds={formData?.cohortIds || []}
                        validCohortIds={
                          "valid_cohort_ids" in staffData
                            ? staffData.valid_cohort_ids || []
                            : []
                        }
                        cohortMapping={staffData.cohort_mapping}
                        onCohortIdsChange={(ids) =>
                          handleInputChange("cohortIds", ids)
                        }
                        isReadonly={isReadonly}
                        isSubmitting={isSubmitting}
                      />
                    </CardContent>
                  </Card>
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
            </div>
          </form>
        </div>
      </div>
    </TooltipProvider>
  );
}
