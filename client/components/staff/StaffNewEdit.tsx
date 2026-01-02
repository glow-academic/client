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
import {
  STAFF_ROLES,
  generateGradientFromHex,
} from "@/components/common/forms/staff-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Building2,
  Check,
  Clock,
  Mail,
  Plus,
  Power,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

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
  const { scopedRoles, selectedDraftId, setSelectedDraftId } = useProfile();
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

  // Inline parsers for URL-backed state (search/filter params only)
  const staffSearchParamsClient = {
    draftId: parseAsString,
    roleSearch: parseAsString,
    roleShowSelected: parseAsBoolean,
    primaryDeptSearch: parseAsString,
    primaryDeptShowSelected: parseAsBoolean,
    emailSearch: parseAsString,
    cohortSearch: parseAsString,
    cohortShowSelected: parseAsBoolean,
  } as const;

  // URL-backed state using nuqs (search/filter params only)
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

  // Email editing state (local to component, not in draft)
  const [editingEmailIndex, setEditingEmailIndex] = useState<number | null>(
    null
  );
  const [editingEmailValue, setEditingEmailValue] = useState("");

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

  // formData is URL params only (for GenericForm)
  // draftState is separate (form fields, autosaved)

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

  // Step status calculation (uses draftState, not formData)
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasFirstName = !!(
        draftState.firstName && String(draftState.firstName).trim()
      );
      const hasRole = !!(draftState.role && String(draftState.role).trim());
      const hasDepartments =
        (draftState.departmentIds?.length || 0) > 0 ||
        (staffData?.valid_department_ids || []).length > 1;
      const hasPrimaryDepartment =
        draftState.primaryDepartmentIndex !== undefined &&
        typeof draftState.primaryDepartmentIndex === "number" &&
        draftState.primaryDepartmentIndex >= 0;
      const hasEmails = (draftState.emails || []).some(
        (e) => String(e).trim().length > 0
      );
      const hasPrimaryEmail =
        draftState.primaryEmailIndex !== undefined &&
        typeof draftState.primaryEmailIndex === "number" &&
        draftState.primaryEmailIndex >= 0;

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
    [draftState, staffData]
  );

  // Steps configuration
  const steps = useMemo(() => {
    const hasDepartments =
      (draftState.departmentIds?.length || 0) > 0 ||
      (staffData?.valid_department_ids || []).length > 1;
    const baseSteps: Array<{
      id: string;
      title: string;
      description: string;
      resetFields?: string[];
      optional?: boolean;
    }> = [
      {
        id: "role",
        title: "Role",
        description: "Select a role for this staff member.",
        resetFields: ["role", "roleSearch", "roleShowSelected"],
      },
    ];

    if (hasDepartments) {
      baseSteps.push({
        id: "primaryDepartment",
        title: "Primary Department",
        description:
          "Select which department is primary for this staff member.",
        resetFields: [
          "primaryDepartmentIndex",
          "primaryDeptSearch",
          "primaryDeptShowSelected",
        ],
      });
    }

    baseSteps.push(
      {
        id: "emails",
        title: "Email",
        description: "Select the primary email address for this staff member.",
        resetFields: ["emails", "primaryEmailIndex", "emailSearch"],
      },
      {
        id: "cohorts",
        title: "Cohorts",
        description: "Select cohorts for this staff member (optional).",
        optional: true,
        resetFields: ["cohortIds", "cohortSearch", "cohortShowSelected"],
      }
    );

    return baseSteps;
  }, [draftState, staffData]);

  // Filtered roles for role selection
  const filteredRoles = useMemo(() => {
    const allRoles = STAFF_ROLES.filter((role) =>
      (scopedRoles || []).includes(role.id)
    );
    const searchTerm = (urlParams.roleSearch as string) || "";
    if (!searchTerm.trim()) {
      return allRoles;
    }
    const searchLower = searchTerm.toLowerCase();
    return allRoles.filter(
      (role) =>
        role.name?.toLowerCase().includes(searchLower) ||
        role.description?.toLowerCase().includes(searchLower)
    );
  }, [scopedRoles, urlParams.roleSearch]);

  // Filtered departments for primary department selection
  const filteredPrimaryDeptIds = useMemo(() => {
    if (!staffData?.departments || !staffData?.valid_department_ids) {
      return [];
    }
    const availableDeptIds = (
      (draftState.departmentIds?.length || 0) > 0
        ? draftState.departmentIds
        : staffData.valid_department_ids || []
    ) as string[];

    const searchTerm = (urlParams.primaryDeptSearch as string) || "";
    const showSelected = urlParams.primaryDeptShowSelected || false;

    let filtered = availableDeptIds;
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((deptId) => {
        const dept = staffData.departments?.find(
          (d) => d.department_id === deptId
        );
        return (
          dept?.name?.toLowerCase().includes(searchLower) ||
          dept?.description?.toLowerCase().includes(searchLower)
        );
      });
    }

    if (showSelected && draftState.primaryDepartmentIndex !== undefined) {
      const selectedId = availableDeptIds[draftState.primaryDepartmentIndex];
      if (selectedId) {
        filtered = filtered.filter((id) => id === selectedId);
      }
    }

    return filtered;
  }, [
    draftState.departmentIds,
    draftState.primaryDepartmentIndex,
    staffData?.valid_department_ids,
    staffData?.departments,
    urlParams.primaryDeptSearch,
    urlParams.primaryDeptShowSelected,
  ]);

  // Filtered cohorts for cohort selection
  const filteredCohorts = useMemo(() => {
    if (!staffData?.cohorts || !staffData?.valid_cohort_ids) {
      return [];
    }
    const cohortMap = new Map(
      (staffData.cohorts || []).map((c) => [c.cohort_id, c])
    );
    const baseCohorts = (staffData.valid_cohort_ids || [])
      .map((id) => {
        const cohort = cohortMap.get(id);
        if (cohort) {
          return {
            id: cohort.cohort_id,
            name: cohort.name || "",
            description: cohort.description || "",
          };
        }
        return null;
      })
      .filter(
        (
          c
        ): c is {
          id: string;
          name: string;
          description: string;
        } => c !== null
      )
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const searchTerm = (urlParams.cohortSearch as string) || "";
    const showSelected = urlParams.cohortShowSelected || false;

    let filtered = baseCohorts;
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (cohort) =>
          cohort.name?.toLowerCase().includes(searchLower) ||
          cohort.description?.toLowerCase().includes(searchLower)
      );
    }

    if (showSelected) {
      filtered = filtered.filter((cohort) =>
        (draftState.cohortIds || []).includes(cohort.id)
      );
    }

    // Sort: selected first, then by name
    return filtered.sort((a, b) => {
      const aSelected = (draftState.cohortIds || []).includes(a.id);
      const bSelected = (draftState.cohortIds || []).includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [
    staffData?.cohorts,
    staffData?.valid_cohort_ids,
    draftState.cohortIds,
    urlParams.cohortSearch,
    urlParams.cohortShowSelected,
  ]);

  // Submit handler
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
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

        const primaryDeptId =
          draftState.primaryDepartmentIndex != null &&
          draftState.primaryDepartmentIndex >= 0 &&
          draftState.primaryDepartmentIndex < deptIdsForPrimary.length
            ? deptIdsForPrimary[draftState.primaryDepartmentIndex]
            : null;

        await updateStaffAction({
          body: {
            profile_ids: [profileId!],
            role: draftState.role || null,
            active: draftState.active ?? null,
            requests_per_day: parsedReqPerDay,
            ...(primaryDeptId !== null && {
              primary_department_id: primaryDeptId,
            }),
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
            profiles: [
              {
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
                department_ids: draftState.departmentIds || [],
                primary_department_index:
                  draftState.primaryDepartmentIndex != null &&
                  draftState.primaryDepartmentIndex >= 0 &&
                  draftState.primaryDepartmentIndex < deptIdsForPrimary.length
                    ? draftState.primaryDepartmentIndex
                    : null,
              },
            ],
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
      isOptional: _isOptional,
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
          const roleShowSelected =
            (stepFormData["roleShowSelected"] as boolean | null | undefined) ??
            false;
          const currentRole = draftState.role || "";

          // Filter roles based on search and show selected
          let displayRoles = filteredRoles;
          if (roleShowSelected && currentRole) {
            displayRoles = displayRoles.filter((r) => r.id === currentRole);
          }

          // Sort: selected role first
          displayRoles = [...displayRoles].sort((a, b) => {
            if (a.id === currentRole) return -1;
            if (b.id === currentRole) return 1;
            return (a.name || "").localeCompare(b.name || "");
          });

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              searchTerm={
                (stepFormData["roleSearch"] as string | null | undefined) || ""
              }
              onSearchChange={(term: string) =>
                stepSetFormData({ roleSearch: term || null })
              }
              searchPlaceholder="Search roles..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: roleShowSelected,
                  onChange: (value) =>
                    stepSetFormData({ roleShowSelected: value }),
                },
              ]}
              resetFields={["role", "roleSearch", "roleShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <SelectableGrid
                items={displayRoles}
                selectedId={currentRole}
                onSelect={(roleId) => {
                  setDraftState((prev) => ({ ...prev, role: roleId }));
                }}
                getId={(role) => role.id}
                renderItem={(role, isSelected) => {
                  const IconComponent = role.icon;
                  const hexColor = role.color || "#64748b";
                  const gradientStyle = generateGradientFromHex(hexColor);

                  return (
                    <div
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                        "hover:shadow-md hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isSelected && "ring-2 ring-primary bg-accent"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div
                          className="p-2 rounded-lg shadow-sm flex-shrink-0"
                          style={{ background: gradientStyle }}
                        >
                          <IconComponent className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight">
                            {role.name}
                          </h3>
                          {role.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {role.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }}
                emptyMessage="No roles found. Try adjusting your search."
                disabled={isReadonly}
              />
            </StepCard>
          );
        }
        case "primaryDepartment": {
          const availableDeptIds = (
            (draftState.departmentIds?.length || 0) > 0
              ? draftState.departmentIds
              : staffData?.valid_department_ids || []
          ) as string[];

          const primaryDeptShowSelected =
            (stepFormData["primaryDeptShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              searchTerm={
                (stepFormData["primaryDeptSearch"] as
                  | string
                  | null
                  | undefined) || ""
              }
              onSearchChange={(term: string) =>
                stepSetFormData({ primaryDeptSearch: term || null })
              }
              searchPlaceholder="Search departments..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: primaryDeptShowSelected,
                  onChange: (value) =>
                    stepSetFormData({ primaryDeptShowSelected: value }),
                },
              ]}
              resetFields={[
                "primaryDepartmentIndex",
                "primaryDeptSearch",
                "primaryDeptShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
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
                    draftState.primaryDepartmentIndex !== undefined &&
                    typeof draftState.primaryDepartmentIndex === "number" &&
                    draftState.primaryDepartmentIndex >= 0 &&
                    draftState.primaryDepartmentIndex < availableDeptIds.length
                      ? (availableDeptIds[
                          draftState.primaryDepartmentIndex
                        ] as string)
                      : null
                  }
                  onSelect={(id) => {
                    const index = availableDeptIds.indexOf(id);
                    setDraftState((prev) => ({
                      ...prev,
                      primaryDepartmentIndex: index >= 0 ? index : undefined,
                    }));
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
          const emails = draftState.emails || [];
          const primaryEmailIndex = draftState.primaryEmailIndex;
          const emailSearch =
            (stepFormData["emailSearch"] as string | null | undefined) || "";

          // Filter emails based on search term, preserving original indices
          const filteredEmailIndices = (() => {
            if (!emailSearch.trim()) {
              return emails.map((_, index) => index);
            }
            const searchLower = emailSearch.toLowerCase();
            return emails
              .map((email, index) => ({ email, index }))
              .filter(({ email }) => email.toLowerCase().includes(searchLower))
              .map(({ index }) => index);
          })();

          const handleAddEmail = () => {
            if (isReadonly) return;
            const newEmails = [...emails, ""];
            setDraftState((prev) => ({ ...prev, emails: newEmails }));
            // If this is the first email, make it primary
            if (emails.length === 0 && primaryEmailIndex === undefined) {
              setDraftState((prev) => ({ ...prev, primaryEmailIndex: 0 }));
            }
            setEditingEmailIndex(newEmails.length - 1);
            setEditingEmailValue("");
          };

          const handleRemoveEmail = (index: number) => {
            if (isReadonly) return;
            const newEmails = emails.filter((_, i) => i !== index);
            if (newEmails.length === 0) {
              setDraftState((prev) => ({
                ...prev,
                emails: [],
                primaryEmailIndex: undefined,
              }));
              return;
            }
            let newPrimaryIndex = primaryEmailIndex;
            if (primaryEmailIndex !== undefined) {
              if (index === primaryEmailIndex) {
                newPrimaryIndex = 0;
              } else if (index < primaryEmailIndex) {
                newPrimaryIndex = primaryEmailIndex - 1;
              }
            }
            setDraftState((prev) => ({
              ...prev,
              emails: newEmails,
              primaryEmailIndex: newPrimaryIndex,
            }));
          };

          const handleEmailClick = (index: number) => {
            if (isReadonly) return;
            setDraftState((prev) => ({ ...prev, primaryEmailIndex: index }));
          };

          const handleStartEdit = (index: number, value: string) => {
            if (isReadonly) return;
            setEditingEmailIndex(index);
            setEditingEmailValue(value);
          };

          const handleSaveEdit = (index: number) => {
            if (isReadonly) return;
            if (!editingEmailValue.trim()) {
              handleCancelEdit();
              return;
            }
            const newEmails = [...emails];
            newEmails[index] = editingEmailValue.trim();
            setDraftState((prev) => ({ ...prev, emails: newEmails }));
            // If no primary email is selected, make this one primary
            if (primaryEmailIndex === undefined) {
              setDraftState((prev) => ({ ...prev, primaryEmailIndex: index }));
            }
            setEditingEmailIndex(null);
            setEditingEmailValue("");
          };

          const handleCancelEdit = () => {
            setEditingEmailIndex(null);
            setEditingEmailValue("");
          };

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              searchTerm={emailSearch || ""}
              onSearchChange={(term: string) =>
                stepSetFormData({ emailSearch: term || null })
              }
              searchPlaceholder="Search emails..."
              debounceMs={300}
              resetFields={["emails", "primaryEmailIndex", "emailSearch"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
                {filteredEmailIndices.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No emails found. Try adjusting your search.
                  </div>
                ) : (
                  filteredEmailIndices.map((index) => {
                    const email = emails[index];
                    const isPrimary =
                      primaryEmailIndex !== undefined &&
                      index === primaryEmailIndex;
                    const isEditing = editingEmailIndex === index;

                    return (
                      <div
                        key={index}
                        className={cn(
                          "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all",
                          "hover:shadow-md hover:bg-accent/50",
                          isPrimary && "ring-2 ring-primary bg-accent",
                          !isEditing && "cursor-pointer"
                        )}
                        onClick={() => !isEditing && handleEmailClick(index)}
                      >
                        <div className="flex items-start gap-3">
                          <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <Input
                                  type="email"
                                  value={editingEmailValue}
                                  onChange={(e) =>
                                    setEditingEmailValue(e.target.value)
                                  }
                                  placeholder="email@example.com"
                                  className="h-8 text-sm flex-1"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSaveEdit(index);
                                    } else if (e.key === "Escape") {
                                      handleCancelEdit();
                                    }
                                  }}
                                  onBlur={() => {
                                    if (
                                      editingEmailValue.trim() &&
                                      editingEmailValue.trim() !== email
                                    ) {
                                      handleSaveEdit(index);
                                    } else {
                                      handleCancelEdit();
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div
                                  className="flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleSaveEdit(index);
                                    }}
                                    disabled={isReadonly}
                                    className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleCancelEdit();
                                    }}
                                    disabled={isReadonly}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div
                                  className="flex-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(index, email || "");
                                  }}
                                >
                                  <input
                                    type="text"
                                    value={email || ""}
                                    readOnly
                                    className={cn(
                                      "w-full text-sm border-none outline-none bg-transparent px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                      email
                                        ? "text-foreground cursor-pointer hover:bg-muted/50"
                                        : "text-muted-foreground cursor-pointer hover:bg-muted/50"
                                    )}
                                    placeholder="Click to edit email"
                                    disabled={isReadonly}
                                  />
                                </div>
                                {emails.length > 1 && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveEmail(index);
                                    }}
                                    disabled={isReadonly}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Add Email Card */}
                {!isReadonly && (
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed bg-card text-card-foreground shadow-sm transition-all",
                      "hover:shadow-md hover:bg-accent/50 hover:border-primary",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    )}
                  >
                    <Plus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Add Email
                    </span>
                  </button>
                )}
              </div>
            </StepCard>
          );
        }
        case "cohorts": {
          const cohortShowSelected =
            (stepFormData["cohortShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          const cohortIds = draftState.cohortIds || [];

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              searchTerm={
                (stepFormData["cohortSearch"] as string | null | undefined) ??
                ""
              }
              onSearchChange={(term: string) =>
                stepSetFormData({ cohortSearch: term || null })
              }
              searchPlaceholder="Search cohorts..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: cohortShowSelected,
                  onChange: (value) =>
                    stepSetFormData({ cohortShowSelected: value }),
                },
              ]}
              resetFields={["cohortIds", "cohortSearch", "cohortShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <SelectableGrid
                items={filteredCohorts}
                selectedId={
                  cohortIds.length > 0 ? (cohortIds[0] as string) : null
                }
                selectedIds={cohortIds as string[]}
                onSelect={(cohortId) => {
                  const isSelected = cohortIds.includes(cohortId);
                  const newIds = isSelected
                    ? cohortIds.filter((id) => id !== cohortId)
                    : [...cohortIds, cohortId];
                  setDraftState((prev) => ({ ...prev, cohortIds: newIds }));
                }}
                getId={(cohort) => cohort.id}
                renderItem={(cohort, isSelected) => (
                  <div
                    className={cn(
                      "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                      "hover:shadow-md hover:bg-accent/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected && "ring-2 ring-primary bg-accent"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <Users className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm leading-tight">
                          {cohort.name || "Unnamed Cohort"}
                        </h3>
                        {cohort.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {cohort.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                emptyMessage="No cohorts found. Try adjusting your search."
                disabled={isReadonly}
              />
            </StepCard>
          );
        }
        default:
          return null;
      }
    },
    [
      isReadonly,
      isEditMode,
      staffData,
      draftState,
      filteredRoles,
      filteredPrimaryDeptIds,
      filteredCohorts,
      editingEmailIndex,
      editingEmailValue,
    ]
  );

  // Render first name section (not a step, but part of the form)
  const renderFirstNameSection = () => {
    if (
      draftState.firstName === undefined ||
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
            value={String(draftState.firstName || "")}
            onChange={(e) =>
              setDraftState((prev) => ({ ...prev, firstName: e.target.value }))
            }
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
            value={String(draftState.lastName || "")}
            onChange={(e) =>
              setDraftState((prev) => ({ ...prev, lastName: e.target.value }))
            }
            placeholder="Last Name (optional)"
            disabled={isReadonly}
          />
        </div>

        {staffData.valid_department_ids &&
          staffData.valid_department_ids.length > 1 && (
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
                    ...(staffData.valid_department_ids || []),
                    ...(draftState.departmentIds || []),
                  ])
                )}
                selectedIds={(draftState.departmentIds || []) as string[]}
                onSelect={(ids) => {
                  setDraftState((prev) => ({ ...prev, departmentIds: ids }));
                  const currentPrimaryId =
                    draftState.departmentIds &&
                    draftState.primaryDepartmentIndex !== undefined &&
                    typeof draftState.primaryDepartmentIndex === "number" &&
                    draftState.primaryDepartmentIndex >= 0 &&
                    draftState.primaryDepartmentIndex <
                      draftState.departmentIds.length
                      ? draftState.departmentIds[
                          draftState.primaryDepartmentIndex
                        ]
                      : undefined;
                  if (currentPrimaryId && ids.includes(currentPrimaryId)) {
                    const newIndex = ids.indexOf(currentPrimaryId);
                    setDraftState((prev) => ({
                      ...prev,
                      primaryDepartmentIndex: newIndex,
                    }));
                  } else if (ids.length > 0) {
                    if (draftState.primaryDepartmentIndex === undefined) {
                      setDraftState((prev) => ({
                        ...prev,
                        primaryDepartmentIndex: 0,
                      }));
                    }
                  } else {
                    setDraftState((prev) => ({
                      ...prev,
                      primaryDepartmentIndex: undefined,
                    }));
                  }
                }}
                getId={(dept) => (dept as unknown as { id: string }).id}
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
                checked={draftState.active ?? true}
                onCheckedChange={(checked) =>
                  setDraftState((prev) => ({ ...prev, active: checked }))
                }
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
                checked={draftState.requestsPerDayEnabled || false}
                onCheckedChange={(checked) => {
                  setDraftState((prev) => ({
                    ...prev,
                    requestsPerDayEnabled: checked,
                    reqPerDay: checked ? prev.reqPerDay : "",
                  }));
                }}
                disabled={isReadonly}
              />
            </div>
            {!draftState.requestsPerDayEnabled && (
              <p className="text-xs text-muted-foreground pl-6">
                Set a daily request limit for this staff member
              </p>
            )}
            {draftState.requestsPerDayEnabled && (
              <div className="space-y-2 pt-2 pl-6">
                <Input
                  id="reqPerDay"
                  type="number"
                  value={
                    draftState.reqPerDay === ""
                      ? ""
                      : String(draftState.reqPerDay || "")
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setDraftState((prev) => ({ ...prev, reqPerDay: "" }));
                    } else {
                      const num = parseInt(val, 10);
                      setDraftState((prev) => ({
                        ...prev,
                        reqPerDay: Number.isNaN(num) ? "" : num,
                      }));
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
            nuqsParsers={
              staffSearchParamsClient as Record<
                string,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                any
              >
            }
            steps={steps}
            getStepStatus={getStepStatus}
            renderStep={renderStep}
            formData={urlParams}
            setFormData={setUrlParams}
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
