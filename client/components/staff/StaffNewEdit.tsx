/**
 * StaffNewEdit.tsx
 * Used to create and manage staff - supports both creation and editing
 * Refactored to use GenericForm pattern with nuqs and draft autosave
 * @AshokSaravanan222
 * 12/04/2025
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";

import type {
  CreateStaffIn,
  CreateStaffOut,
  PatchStaffDraftIn,
  PatchStaffDraftOut,
  StaffNewOut,
} from "@/app/(main)/management/staff/new/page";
import type {
  StaffDetailOut,
  UpdateStaffIn,
  UpdateStaffOut,
} from "@/app/(main)/management/staff/p/[profileId]/page";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { StaffCohortCardGrid } from "@/components/staff/StaffCohortCardGrid";
import { StaffEmailCardGrid } from "@/components/staff/StaffEmailCardGrid";
import { StaffRoleCardGrid } from "@/components/staff/StaffRoleCardGrid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Building2, Clock, Power } from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";

export interface StaffNewEditProps {
  profileId?: string;
  mode?: "create" | "edit";
  // Server-provided data (for server-side rendering)
  staffDetail?: StaffDetailOut;
  staffDetailDefault?: StaffNewOut;
  // Server actions
  createStaffAction?: (input: CreateStaffIn) => Promise<CreateStaffOut>;
  updateStaffAction?: (input: UpdateStaffIn) => Promise<UpdateStaffOut>;
  patchStaffDraftAction?: (
    input: PatchStaffDraftIn
  ) => Promise<PatchStaffDraftOut>;
}

export default function StaffNewEdit({
  profileId,
  mode = profileId ? "edit" : "create",
  staffDetail: serverStaffDetail,
  staffDetailDefault: serverStaffDetailDefault,
  createStaffAction,
  updateStaffAction,
  patchStaffDraftAction,
}: StaffNewEditProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = mode === "edit" && !!profileId;
  const { scopedRoles, effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Stabilize server props to prevent unnecessary re-renders
  const stabilizeServerProp = React.useCallback(
    (
      data: typeof serverStaffDetail | typeof serverStaffDetailDefault
    ): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("profile_id" in data && data.profile_id) {
          return `profile_id:${String(data.profile_id)}`;
        }
        const keyFields: Record<string, unknown> = {};
        if ("valid_department_ids" in data) {
          keyFields["valid_department_ids"] = Array.isArray(
            data["valid_department_ids"]
          )
            ? data["valid_department_ids"].sort().join(",")
            : data["valid_department_ids"];
        }
        if ("valid_cohort_ids" in data) {
          keyFields["valid_cohort_ids"] = Array.isArray(
            data["valid_cohort_ids"]
          )
            ? data["valid_cohort_ids"].sort().join(",")
            : data["valid_cohort_ids"];
        }
        const sortedKeys = Object.keys(keyFields).sort();
        const hash = sortedKeys
          .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
          .join("|");
        return `new:${hash.length}:${hash.slice(0, 100)}`;
      }
      return String(data);
    },
    []
  );

  const staffDetailId = React.useMemo(
    () => stabilizeServerProp(serverStaffDetail),
    [serverStaffDetail, stabilizeServerProp]
  );
  const staffDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverStaffDetailDefault),
    [serverStaffDetailDefault, stabilizeServerProp]
  );

  // Use refs to track latest server props
  const latestServerStaffDetailRef = React.useRef(serverStaffDetail);
  const latestServerStaffDetailDefaultRef = React.useRef(
    serverStaffDetailDefault
  );

  latestServerStaffDetailRef.current = serverStaffDetail;
  latestServerStaffDetailDefaultRef.current = serverStaffDetailDefault;

  // Use refs to track stable server props
  const stableStaffDetailRef = React.useRef<{
    data: typeof serverStaffDetail;
    id: string | null;
  }>({
    data: serverStaffDetail,
    id: staffDetailId,
  });
  const stableStaffDetailDefaultRef = React.useRef<{
    data: typeof serverStaffDetailDefault;
    id: string | null;
  }>({
    data: serverStaffDetailDefault,
    id: staffDetailDefaultId,
  });

  React.useEffect(() => {
    if (stableStaffDetailRef.current.id !== staffDetailId) {
      stableStaffDetailRef.current = {
        data: latestServerStaffDetailRef.current,
        id: staffDetailId,
      };
    }
  }, [staffDetailId]);

  React.useEffect(() => {
    if (stableStaffDetailDefaultRef.current.id !== staffDetailDefaultId) {
      stableStaffDetailDefaultRef.current = {
        data: latestServerStaffDetailDefaultRef.current,
        id: staffDetailDefaultId,
      };
    }
  }, [staffDetailDefaultId]);

  const staffDetail = stableStaffDetailRef.current.data;
  const staffDetailDefault = stableStaffDetailDefaultRef.current.data;

  // Use edit detail when editing, default detail when creating
  const staffDataId = React.useMemo(() => {
    const data = isEditMode ? staffDetail : staffDetailDefault;
    if (!data) return null;
    return stabilizeServerProp(data);
  }, [isEditMode, staffDetail, staffDetailDefault, stabilizeServerProp]);

  const stableStaffDataRef = React.useRef<{
    data: typeof staffDetail | typeof staffDetailDefault;
    id: string | null;
  }>({
    data: isEditMode ? staffDetail : staffDetailDefault,
    id: staffDataId,
  });

  React.useEffect(() => {
    if (stableStaffDataRef.current.id !== staffDataId) {
      stableStaffDataRef.current = {
        data: isEditMode ? staffDetail : staffDetailDefault,
        id: staffDataId,
      };
    }
  }, [isEditMode, staffDetail, staffDetailDefault, staffDataId]);

  const staffData = stableStaffDataRef.current.data;

  // Inline parsers for URL-backed state
  const staffSearchParamsClient = {
    draftId: parseAsString,
    primaryDeptSearch: parseAsString,
  } as const;

  // URL-backed state using nuqs
  const [urlParams, setUrlParams] = useQueryStates(staffSearchParamsClient, {
    history: "replace",
    shallow: true,
  });

  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

  // Local draft state (not in URL)
  type DraftState = {
    firstName: string;
    lastName: string;
    emails: string[];
    primaryEmailIndex: number | undefined;
    role: string;
    reqPerDay: number | "";
    requestsPerDayEnabled: boolean;
    cohortIds: string[];
    departmentIds: string[];
    primaryDepartmentIndex: number | undefined;
    active: boolean;
  };

  // Initialize draft state from server data or draft payload
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? staffDetail : staffDetailDefault;
    if (!data) {
      return {
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
      };
    }

    // If draftId exists, server should have merged draft payload into data
    const emails = data.emails || [];
    const primaryIndex =
      "primary_email_index" in data && data.primary_email_index != null
        ? data.primary_email_index
        : emails.length > 0
          ? emails.findIndex(
              (e) =>
                e ===
                ("primary_email" in data && data.primary_email
                  ? data.primary_email
                  : emails[0])
            )
          : undefined;

    const departmentIds =
      "department_ids" in data && data.department_ids
        ? data.department_ids
        : [];
    const primaryDeptIndex =
      "primary_department_index" in data &&
      data.primary_department_index != null
        ? data.primary_department_index
        : departmentIds.length > 0 &&
            "primary_department_id" in data &&
            data.primary_department_id
          ? departmentIds.findIndex(
              (id: string) => id === data.primary_department_id
            )
          : undefined;

    const cohortIds =
      "cohort_ids" in data && data.cohort_ids ? data.cohort_ids : [];

    return {
      firstName: data.first_name || "",
      lastName: data.last_name || "",
      emails: emails,
      primaryEmailIndex:
        primaryIndex !== undefined && primaryIndex >= 0
          ? primaryIndex
          : undefined,
      role: data.role || "instructional",
      reqPerDay: data.requests_per_day ?? "",
      requestsPerDayEnabled: data.requests_per_day != null,
      cohortIds: cohortIds,
      departmentIds: departmentIds,
      primaryDepartmentIndex:
        primaryDeptIndex !== undefined && primaryDeptIndex >= 0
          ? primaryDeptIndex
          : undefined,
      active: data.active ?? true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    staffDetail,
    staffDetailDefault,
    staffDetailId,
    staffDetailDefaultId,
    draftId,
    urlDraftId,
    staffDetailDefault?.first_name,
    staffDetailDefault?.last_name,
    staffDetailDefault?.emails,
    staffDetailDefault?.role,
    staffDetailDefault?.requests_per_day,
    staffDetailDefault?.cohort_ids,
    staffDetailDefault?.department_ids,
    staffDetailDefault?.active,
    staffDetail?.first_name,
    staffDetail?.last_name,
    staffDetail?.emails,
    staffDetail?.role,
    staffDetail?.requests_per_day,
    staffDetail?.cohort_ids,
    staffDetail?.department_ids,
    staffDetail?.active,
    staffDetail?.primary_email_index,
    staffDetail?.primary_department_index,
  ]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
  );

  useEffect(() => {
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    if (currentStateStr !== newStateStr) {
      prevInitialDraftStateRef.current = newStateStr;
      setDraftState(initialDraftState);
    }
  }, [initialDraftState]);

  // Get draft version from server data
  const draftVersion =
    (staffData &&
    "draft_version" in staffData &&
    typeof staffData.draft_version === "number"
      ? staffData.draft_version
      : 0) || 0;

  // Integrate autosave hook
  const {
    saveStatus: _saveStatus,
    saveNow: _saveNow,
    lastSavedVersion: _lastSavedVersion,
  } = useDraftAutosave({
    draftId,
    draftState,
    initialVersion: draftVersion,
    patchDraftAction: patchStaffDraftAction
      ? async (input) => {
          const result = await patchStaffDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: input.body.patch as Record<string, unknown>,
              expected_version: input.body.expected_version,
            } as PatchStaffDraftIn["body"],
          });
          return {
            draftId: result.draft_id || "",
            newVersion: result.new_version || 0,
            draftExists: result.draft_exists || false,
          };
        }
      : async () => ({ draftId: "", newVersion: 0, draftExists: false }),
    debounceMs: 1000,
    onDraftCreated: useCallback(
      (newDraftId: string) => {
        const currentUrlDraftId = searchParams.get("draftId");
        if (newDraftId === currentUrlDraftId) {
          return;
        }
        const params = new URLSearchParams(searchParams.toString());
        params.set("draftId", newDraftId);
        const newUrl = `?${params.toString()}`;
        router.replace(newUrl, { scroll: false });
        router.refresh();
      },
      [router, searchParams]
    ),
  });

  // Merge draftState with urlParams for formData
  const formData = useMemo(() => {
    return {
      ...draftState,
      primaryDeptSearch: urlParams.primaryDeptSearch || null,
    } as Record<string, unknown>;
  }, [draftState, urlParams]);

  // Create setFormData wrapper
  const setFormData = useCallback(
    (updates: Partial<Record<string, unknown>>) => {
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      const draftUpdates: Partial<DraftState> = {};
      const urlUpdates: Partial<Record<string, unknown>> = {};

      Object.entries(resolvedUpdates).forEach(([key, value]) => {
        if (key === "primaryDeptSearch") {
          urlUpdates[key] = value;
        } else {
          draftUpdates[key as keyof DraftState] = value as never;
        }
      });

      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }
      if (Object.keys(urlUpdates).length > 0) {
        setUrlParams(urlUpdates);
      }
    },
    [formData, setUrlParams]
  );

  // Readonly logic
  const isReadonly = useMemo(() => {
    if (!isEditMode || !staffData) return false;
    return !("can_edit" in staffData && staffData.can_edit);
  }, [isEditMode, staffData]);

  // Set breadcrumb context
  useEffect(() => {
    if (staffDetail?.name && profileId && isEditMode) {
      // Note: "staff" is not in EntityMetadata union type, so we skip breadcrumb metadata
    }
    return () => clearEntityMetadata();
  }, [
    staffDetail,
    profileId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Step status calculation
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasFirstName = !!(
        formData.firstName && String(formData.firstName).trim()
      );
      const hasRole = !!(formData.role && String(formData.role).trim());
      const hasDepartments =
        (Array.isArray(formData.departmentIds)
          ? formData.departmentIds.length
          : 0) > 0 || (staffData?.valid_department_ids || []).length > 1;
      const hasPrimaryDepartment =
        formData.primaryDepartmentIndex !== undefined &&
        typeof formData.primaryDepartmentIndex === "number" &&
        formData.primaryDepartmentIndex >= 0;
      const hasEmails = (
        Array.isArray(formData.emails) ? formData.emails : []
      ).some((e) => String(e).trim().length > 0);
      const hasPrimaryEmail =
        formData.primaryEmailIndex !== undefined &&
        typeof formData.primaryEmailIndex === "number" &&
        formData.primaryEmailIndex >= 0;

      switch (stepId) {
        case "role":
          if (!hasFirstName) return "pending";
          return hasRole ? "completed" : "active";
        case "primaryDepartment":
          if (!hasFirstName || !hasRole) return "pending";
          if (!hasDepartments) return "pending";
          return hasPrimaryDepartment ? "completed" : "active";
        case "emails":
          if (!hasFirstName || !hasRole) return "pending";
          if (hasDepartments && !hasPrimaryDepartment) return "pending";
          return hasEmails && hasPrimaryEmail ? "completed" : "active";
        case "cohorts":
          if (!hasFirstName || !hasRole) return "pending";
          if (hasDepartments && !hasPrimaryDepartment) return "pending";
          if (!hasEmails || !hasPrimaryEmail) return "pending";
          return "completed";
        default:
          return "pending";
      }
    },
    [staffData]
  );

  // Steps configuration
  const steps = useMemo(() => {
    const hasDepartments =
      (Array.isArray(formData.departmentIds)
        ? formData.departmentIds.length
        : 0) > 0 || (staffData?.valid_department_ids || []).length > 1;
    const baseSteps = [
      {
        id: "role",
        title: "Role",
        description: "Select a role for this staff member.",
        resetFields: ["role"] as const,
      },
    ];

    if (hasDepartments) {
      baseSteps.push({
        id: "primaryDepartment",
        title: "Primary Department",
        description:
          "Select which department is primary for this staff member.",
        resetFields: ["primaryDepartmentIndex"] as const,
      });
    }

    baseSteps.push(
      {
        id: "emails",
        title: "Email",
        description: "Select the primary email address for this staff member.",
        resetFields: ["emails", "primaryEmailIndex"] as const,
      },
      {
        id: "cohorts",
        title: "Cohorts",
        description: "Select cohorts for this staff member (optional).",
        optional: true,
        resetFields: ["cohortIds"] as const,
      }
    );

    return baseSteps;
  }, [formData, staffData]);

  // Filtered departments for primary department selection
  const filteredPrimaryDeptIds = useMemo(() => {
    if (!staffData?.departments || !staffData?.valid_department_ids) {
      return [];
    }
    const availableDeptIds = (
      Array.isArray(formData.departmentIds) && formData.departmentIds.length > 0
        ? formData.departmentIds
        : staffData.valid_department_ids || []
    ) as string[];

    const searchTerm = (formData.primaryDeptSearch as string) || "";
    if (!searchTerm.trim()) {
      return availableDeptIds;
    }

    const searchLower = searchTerm.toLowerCase();
    return availableDeptIds.filter((deptId) => {
      const dept = staffData.departments?.find(
        (d) => d.department_id === deptId
      );
      return (
        dept?.name?.toLowerCase().includes(searchLower) ||
        dept?.description?.toLowerCase().includes(searchLower)
      );
    });
  }, [formData, staffData?.valid_department_ids, staffData?.departments]);

  // Submit handler
  const handleSubmit = useCallback(
    async (formData: Record<string, unknown>) => {
      // Use draftState, not formData parameter
      if (!draftState.firstName?.trim()) {
        toast.error("First name is required");
        throw new Error("First name is required");
      }

      const validEmails = (draftState.emails || []).filter(
        (e) => String(e).trim().length > 0
      );
      if (validEmails.length === 0) {
        toast.error("At least one email is required");
        throw new Error("At least one email is required");
      }

      if (
        draftState.primaryEmailIndex === undefined ||
        draftState.primaryEmailIndex < 0 ||
        draftState.primaryEmailIndex >= validEmails.length
      ) {
        toast.error("Please select a primary email");
        throw new Error("Please select a primary email");
      }

      const parsedReqPerDay =
        !draftState.requestsPerDayEnabled ||
        draftState.reqPerDay === "" ||
        draftState.reqPerDay === undefined
          ? null
          : Number(draftState.reqPerDay);

      const deptIdsForPrimary =
        (draftState.departmentIds?.length || 0) === 0
          ? staffData?.valid_department_ids || []
          : draftState.departmentIds || [];

      if (isEditMode) {
        if (!updateStaffAction) {
          toast.error("Update action not available");
          throw new Error("Update action not available");
        }

        await updateStaffAction({
          body: {
            profileId: profileId!,
            first_name: draftState.firstName,
            last_name: draftState.lastName || "",
            emails: validEmails,
            primary_email_index:
              draftState.primaryEmailIndex != null &&
              draftState.primaryEmailIndex >= 0 &&
              draftState.primaryEmailIndex < validEmails.length
                ? draftState.primaryEmailIndex
                : null,
            role: draftState.role || "",
            requests_per_day: parsedReqPerDay,
            cohort_ids: draftState.cohortIds || [],
            department_ids: draftState.departmentIds || [],
            primary_department_index:
              draftState.primaryDepartmentIndex != null &&
              draftState.primaryDepartmentIndex >= 0 &&
              draftState.primaryDepartmentIndex < deptIdsForPrimary.length
                ? draftState.primaryDepartmentIndex
                : null,
            active: draftState.active ?? true,
          },
        });

        toast.success("Staff updated successfully!");
        router.push("/management/staff");
      } else {
        if (!createStaffAction) {
          toast.error("Create action not available");
          throw new Error("Create action not available");
        }

        await createStaffAction({
          body: {
            first_name: draftState.firstName,
            last_name: draftState.lastName || "",
            emails: validEmails,
            primary_email_index:
              draftState.primaryEmailIndex != null &&
              draftState.primaryEmailIndex >= 0 &&
              draftState.primaryEmailIndex < validEmails.length
                ? draftState.primaryEmailIndex
                : null,
            role: draftState.role || "",
            cohort_ids: draftState.cohortIds || [],
            department_ids: draftState.departmentIds || [],
            primary_department_index:
              draftState.primaryDepartmentIndex != null &&
              draftState.primaryDepartmentIndex >= 0 &&
              draftState.primaryDepartmentIndex < deptIdsForPrimary.length
                ? draftState.primaryDepartmentIndex
                : null,
          },
        });

        toast.success("Staff created successfully!");
        router.push("/management/staff");
      }
    },
    [
      draftState,
      isEditMode,
      profileId,
      staffData,
      createStaffAction,
      updateStaffAction,
      router,
    ]
  );

  // Render step callback
  const renderStep = useCallback(
    ({
      stepId,
      stepTitle,
      stepDescription,
      stepNumber,
      stepStatus,
      isOptional,
      formData: stepFormData,
      setFormData: stepSetFormData,
      onReset,
    }: {
      stepId: string;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      stepStatus: StepStatus;
      isOptional: boolean;
      formData: Record<string, unknown>;
      setFormData: (updates: Partial<Record<string, unknown>>) => void;
      onReset?: () => void;
    }) => {
      switch (stepId) {
        case "role": {
          return (
            <StepCard
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              stepStatus={stepStatus}
              isOptional={isOptional}
              onReset={onReset}
            >
              <StaffRoleCardGrid
                selectedRoleId={(stepFormData.role as string) || ""}
                scopedRoles={scopedRoles || []}
                onRoleChange={(role) => stepSetFormData({ role })}
                readonly={isReadonly}
              />
            </StepCard>
          );
        }
        case "primaryDepartment": {
          const availableDeptIds = (
            Array.isArray(stepFormData.departmentIds) &&
            stepFormData.departmentIds.length > 0
              ? stepFormData.departmentIds
              : staffData?.valid_department_ids || []
          ) as string[];

          return (
            <StepCard
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              stepStatus={stepStatus}
              isOptional={isOptional}
              onReset={onReset}
              searchValue={
                (stepFormData.primaryDeptSearch as string) || undefined
              }
              onSearchChange={(value) =>
                stepSetFormData({ primaryDeptSearch: value || null })
              }
            >
              {!filteredPrimaryDeptIds ||
              filteredPrimaryDeptIds.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No departments found. Try adjusting your search.
                </div>
              ) : (
                <SelectableGrid
                  items={filteredPrimaryDeptIds.map((deptId) => {
                    const dept = staffData?.departments?.find(
                      (d) => d.department_id === deptId
                    );
                    return {
                      id: deptId,
                      name: dept?.name || "Unnamed Department",
                      description: dept?.description || "",
                    };
                  })}
                  selectedId={
                    stepFormData.primaryDepartmentIndex !== undefined &&
                    typeof stepFormData.primaryDepartmentIndex === "number" &&
                    stepFormData.primaryDepartmentIndex >= 0 &&
                    stepFormData.primaryDepartmentIndex <
                      availableDeptIds.length
                      ? availableDeptIds[stepFormData.primaryDepartmentIndex]
                      : null
                  }
                  onSelect={(id) => {
                    const index = availableDeptIds.indexOf(id);
                    stepSetFormData({
                      primaryDepartmentIndex: index >= 0 ? index : undefined,
                    });
                  }}
                  getId={(item) => item.id}
                  renderItem={(item, isSelected) => (
                    <div
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all",
                        "hover:shadow-md hover:bg-accent/50",
                        isSelected && "ring-2 ring-primary bg-accent"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  disabled={isReadonly}
                />
              )}
            </StepCard>
          );
        }
        case "emails": {
          return (
            <StepCard
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              stepStatus={stepStatus}
              isOptional={isOptional}
              onReset={onReset}
            >
              <StaffEmailCardGrid
                emails={(stepFormData.emails as string[]) || []}
                primaryEmailIndex={
                  stepFormData.primaryEmailIndex !== undefined
                    ? (stepFormData.primaryEmailIndex as number)
                    : undefined
                }
                onEmailsChange={(emails) => stepSetFormData({ emails })}
                onPrimaryEmailIndexChange={(index) =>
                  stepSetFormData({ primaryEmailIndex: index })
                }
                readonly={isReadonly}
              />
            </StepCard>
          );
        }
        case "cohorts": {
          return (
            <StepCard
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              stepStatus={stepStatus}
              isOptional={isOptional}
              onReset={onReset}
            >
              <StaffCohortCardGrid
                cohortIds={(stepFormData.cohortIds as string[]) || []}
                validCohortIds={(staffData?.valid_cohort_ids as string[]) || []}
                cohorts={
                  (staffData?.cohorts || []) as Array<{
                    cohort_id: string;
                    name: string;
                    description: string;
                  }>
                }
                onCohortIdsChange={(ids) => stepSetFormData({ cohortIds: ids })}
                readonly={isReadonly}
              />
            </StepCard>
          );
        }
        default:
          return null;
      }
    },
    [scopedRoles, isReadonly, staffData, filteredPrimaryDeptIds]
  );

  // Render first name section (not a step, but part of the form)
  const renderFirstNameSection = () => {
    if (
      formData.firstName === undefined ||
      !staffData?.departments ||
      staffData?.valid_department_ids === undefined
    ) {
      return null;
    }

    return (
      <div className="space-y-4">
        <div>
          <input
            type="text"
            id="firstName"
            data-testid="input-staff-first-name"
            value={String(formData.firstName || "")}
            onChange={(e) => setFormData({ firstName: e.target.value })}
            className={cn(
              "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
            )}
            placeholder="First Name"
            required
            disabled={isReadonly}
          />
          <p className="text-xs text-muted-foreground mt-1 px-2">
            Click to edit
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            data-testid="input-staff-last-name"
            value={String(formData.lastName || "")}
            onChange={(e) => setFormData({ lastName: e.target.value })}
            placeholder="Last Name (optional)"
            disabled={isReadonly}
          />
        </div>

        {staffData.valid_department_ids.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <GenericPicker
              items={staffData.departments.reduce(
                (acc, dept) => {
                  if (dept.department_id) {
                    acc[dept.department_id] = {
                      name: dept.name || "",
                      description: dept.description || "",
                    };
                  }
                  return acc;
                },
                {} as Record<string, { name: string; description: string }>
              )}
              itemIds={Array.from(
                new Set([
                  ...staffData.valid_department_ids,
                  ...((formData.departmentIds as string[]) || []),
                ])
              )}
              selectedIds={(formData.departmentIds as string[]) || []}
              onSelect={(ids) => {
                setFormData({ departmentIds: ids });
                const currentPrimaryId =
                  formData.departmentIds &&
                  formData.primaryDepartmentIndex !== undefined &&
                  typeof formData.primaryDepartmentIndex === "number" &&
                  formData.primaryDepartmentIndex >= 0 &&
                  formData.primaryDepartmentIndex <
                    (formData.departmentIds as string[]).length
                    ? (formData.departmentIds as string[])[
                        formData.primaryDepartmentIndex
                      ]
                    : undefined;
                if (currentPrimaryId && ids.includes(currentPrimaryId)) {
                  const newIndex = ids.indexOf(currentPrimaryId);
                  setFormData({ primaryDepartmentIndex: newIndex });
                } else if (ids.length > 0) {
                  if (formData.primaryDepartmentIndex === undefined) {
                    setFormData({ primaryDepartmentIndex: 0 });
                  }
                } else {
                  setFormData({ primaryDepartmentIndex: undefined });
                }
              }}
              getId={(dept) => (dept as unknown as { id: string }).id}
              getLabel={(dept) => dept.name || ""}
              getSearchText={(dept) => `${dept.name} ${dept.description || ""}`}
              placeholder="All Departments"
              disabled={isReadonly}
              multiSelect={true}
              hideSelectedChips={true}
              buttonClassName="w-full"
            />
          </div>
        )}

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
                checked={(formData.active as boolean) ?? true}
                onCheckedChange={(checked) => setFormData({ active: checked })}
                disabled={isReadonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Whether this staff member is active
            </p>
          </div>
        </div>

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
                checked={(formData.requestsPerDayEnabled as boolean) || false}
                onCheckedChange={(checked) => {
                  setFormData({
                    requestsPerDayEnabled: checked,
                    reqPerDay: checked ? formData.reqPerDay : "",
                  });
                }}
                disabled={isReadonly}
              />
            </div>
            {!(formData.requestsPerDayEnabled as boolean) && (
              <p className="text-xs text-muted-foreground pl-6">
                Set a daily request limit for this staff member
              </p>
            )}
            {(formData.requestsPerDayEnabled as boolean) && (
              <div className="space-y-2 pt-2 pl-6">
                <Input
                  id="reqPerDay"
                  type="number"
                  value={
                    formData.reqPerDay === ""
                      ? ""
                      : String(formData.reqPerDay || "")
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setFormData({ reqPerDay: "" });
                    } else {
                      const num = parseInt(val, 10);
                      setFormData({
                        reqPerDay: Number.isNaN(num) ? "" : num,
                      });
                    }
                  }}
                  placeholder="Enter number"
                  min={1}
                  step={1}
                  disabled={isReadonly}
                  data-testid="input-staff-requests-per-day"
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
          {/* First Name Section - rendered before GenericForm */}
          {renderFirstNameSection() && (
            <div className="mb-8">
              <div className="bg-card border border-border rounded-lg p-6">
                {renderFirstNameSection()}
              </div>
            </div>
          )}

          <GenericForm
            nuqsParsers={staffSearchParamsClient}
            steps={steps}
            getStepStatus={getStepStatus}
            renderStep={renderStep}
            formData={formData}
            setFormData={setFormData}
            serverData={staffData}
            initializeForm={() => ({})}
            onSubmit={handleSubmit}
            isReadonly={isReadonly}
            isEditMode={isEditMode}
            submitButton={{
              createLabel: "Create Staff",
              updateLabel: "Update Staff",
              backUrl: "/management/staff",
            }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
