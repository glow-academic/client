/**
 * Profile.tsx
 * Implementation using modular resource components
 * Used to create and manage profiles - supports both creation and editing
 * Follows Persona.tsx pattern exactly
 */
"use client";

import { useRouter } from "next/navigation";
import React, {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Cohorts, type CohortsProps } from "@/components/resources/Cohorts";
import {
  Departments,
  type DepartmentsProps,
} from "@/components/resources/Departments";
import { Emails, type EmailsProps } from "@/components/resources/Emails";
import { Flags } from "@/components/resources/Flags";
import { Names, type NamesProps } from "@/components/resources/Names";
import {
  RequestLimits,
  type RequestLimitsProps,
} from "@/components/resources/RequestLimits";
import { Roles, type RolesProps } from "@/components/resources/Roles";
import { Label } from "@/components/ui/label";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDrafts } from "@/contexts/draft-context";
import { useProfile } from "@/contexts/profile-context";
import { useSocket } from "@/contexts/socket-context";
import { useAiGeneration } from "@/hooks/use-ai-generation";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  type ResourceConfig,
  buildDraftPayload,
  checkHasResourceIds,
  computeEffectiveFormState,
} from "@/lib/resources/action-builders";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type PatchProfileDraftIn = InputOf<"/api/v4/artifacts/profiles/draft", "patch">;
type PatchProfileDraftOut = {
  draft_id?: string | null;
  new_version?: number | null;
};

type SaveStaffIn = InputOf<"/api/v4/artifacts/profiles/save", "post">;
type SaveStaffOut = OutputOf<"/api/v4/artifacts/profiles/save", "post">;
type CreateDraftNamesIn = Parameters<NonNullable<NamesProps["createNamesAction"]>>[0];
type CreateDraftNamesOut = Awaited<
  ReturnType<NonNullable<NamesProps["createNamesAction"]>>
>;
type CreateDraftEmailsIn = Parameters<NonNullable<EmailsProps["createEmailsAction"]>>[0];
type CreateDraftEmailsOut = Awaited<
  ReturnType<NonNullable<EmailsProps["createEmailsAction"]>>
>;
type CreateDraftRequestLimitsIn = Parameters<
  NonNullable<RequestLimitsProps["createRequestLimitsAction"]>
>[0];
type CreateDraftRequestLimitsOut = Awaited<
  ReturnType<NonNullable<RequestLimitsProps["createRequestLimitsAction"]>>
>;

type NameItem = NonNullable<NamesProps["names"]>[number];
type NameResource = NonNullable<NamesProps["name_resource"]>;
import type { FlagConfig } from "@/components/resources/Flags";
type RequestLimitItem = NonNullable<RequestLimitsProps["request_limits"]>[number];
type RequestLimitResource = NonNullable<RequestLimitsProps["request_limit_resource"]>;
type DepartmentItem = NonNullable<DepartmentsProps["departments"]>[number];
type DepartmentResource = NonNullable<DepartmentsProps["department_resources"]>[number];
type EmailItem = NonNullable<EmailsProps["emails"]>[number];
type EmailResource = NonNullable<EmailsProps["email_resources"]>[number];
type CohortItem = NonNullable<CohortsProps["cohorts"]>[number];
type RoleItem = NonNullable<RolesProps["roles"]>[number];

type StaffData = OutputOf<"/api/v4/artifacts/profiles/get", "post"> &
  Record<string, unknown> & {
  group_id?: string | null;
  draft_version?: number | null;
  can_edit?: boolean | null;
  disabled_reason?: string | null;
  role?: string | null;
  role_options?: string[] | null;
  roles?: RoleItem[] | null;
  names?: {
    show?: boolean;
    required?: boolean;
    suggestions?: string[];
    resource?: NameResource | null;
    resources?: NameItem[];
  } | null;
  flags?: {
    show?: boolean;
    required?: boolean;
    current?: FlagConfig | null;
    resources?: FlagConfig[];
  } | null;
  request_limits?: {
    show?: boolean;
    required?: boolean;
    suggestions?: string[];
    resource?: RequestLimitResource | null;
    resources?: RequestLimitItem[];
  } | null;
  departments?: {
    show?: boolean;
    required?: boolean;
    suggestions?: string[];
    current?: DepartmentResource[];
    resources?: DepartmentItem[];
  } | null;
  emails?: {
    show?: boolean;
    required?: boolean;
    suggestions?: string[];
    current?: EmailResource[];
    resources?: EmailItem[];
  } | null;
  cohorts?: {
    show?: boolean;
    required?: boolean;
    suggestions?: string[];
    current?: CohortItem[];
    resources?: CohortItem[];
  } | null;
  };

const VALID_RESOURCE_TYPES = [
  "names",
  "flags",
  "request_limits",
  "departments",
  "emails",
  "cohorts",
] as const;
type ProfileResourceType = (typeof VALID_RESOURCE_TYPES)[number];
type ProfileFormState = {
  name_id: string | null;
  active_flag_id: string | null;
  request_limit_id: string | null;
  department_ids: string[];
  email_ids: string[];
  primary_email_index: number;
  cohort_ids: string[];
  role: string;
  primary_department_id: string | null;
};

const STEP_RESOURCES = {
  basic: ["names", "flags", "departments"],
  contact: ["emails", "request_limits"],
  roles: [],
  cohorts: ["cohorts"],
  all: ["names", "flags", "request_limits", "departments", "emails", "cohorts"],
} as const;

const FLUSH_KEYS = ["names", "emails", "request_limits"] as const;

const PROFILE_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  { key: "flags", formKey: "active_flag_id", flushKey: null, type: "single" },
  {
    key: "request_limits",
    formKey: "request_limit_id",
    flushKey: "request_limit_id",
    type: "single",
  },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "emails", formKey: "email_ids", flushKey: null, type: "multi" },
  { key: "cohorts", formKey: "cohort_ids", flushKey: null, type: "multi" },
];

export interface ProfileProps {
  staffId?: string;
  staffData?: unknown;
  saveStaffAction?: (input: SaveStaffIn) => Promise<SaveStaffOut>;
  patchProfileDraftAction?: (
    input: PatchProfileDraftIn
  ) => Promise<PatchProfileDraftOut>;
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createEmailsAction?: (
    input: CreateDraftEmailsIn
  ) => Promise<CreateDraftEmailsOut>;
  createRequestLimitsAction?: (
    input: CreateDraftRequestLimitsIn
  ) => Promise<CreateDraftRequestLimitsOut>;
}

function ProfileComponent({
  staffId,
  staffData,
  saveStaffAction,
  patchProfileDraftAction,
  createNamesAction,
  createEmailsAction,
  createRequestLimitsAction,
}: ProfileProps) {
  const router = useRouter();
  const isEditMode = !!staffId;
  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const { socket, isConnected } = useSocket();
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<Record<string, unknown>>(FLUSH_KEYS);

  const staffSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      roleSearch: parseAsString,
      roleShowSelected: parseAsBoolean,
      cohortSearch: parseAsString,
      cohortShowSelected: parseAsBoolean,
    }),
    []
  );

  const stableStaffDataFields = React.useMemo(() => {
    if (!staffData) return null;
    const s = staffData as StaffData;
    const nameResource = s.names?.resource ?? null;
    const flagResource = s.flags?.current ?? null;
    const requestLimitResource = s.request_limits?.resource ?? null;
    const departmentResources = s.departments?.current ?? [];
    const emailResources = s.emails?.current ?? [];
    const cohortResources = s.cohorts?.current ?? [];
    const departmentIds = departmentResources
      .map((d) => d.department_id)
      .filter((id): id is string => !!id);
    const emailIds = emailResources
      .map((e) => e.id)
      .filter((id): id is string => !!id);
    const cohortIds = cohortResources
      .map((c) => c.cohort_id)
      .filter((id): id is string => !!id);

    return {
      disabled_reason: s.disabled_reason ?? null,
      group_id: s.group_id ?? null,
      draft_version: s.draft_version ?? null,
      can_edit: s.can_edit ?? null,
      role: s.role ?? null,
      name_id: nameResource?.id ?? null,
      active_flag_id: flagResource?.flag_option_id ?? null,
      request_limit_id: requestLimitResource?.id ?? null,
      department_ids: departmentIds,
      email_ids: emailIds,
      cohort_ids: cohortIds,
      primary_email_index: 0,
      primary_department_id: departmentIds[0] ?? null,
      name: nameResource?.name ?? null,
      name_resource: nameResource,
      show_name: s.names?.show ?? true,
      name_suggestions: s.names?.suggestions ?? [],
      names: s.names?.resources ?? [],
      name_required: s.names?.required ?? false,
      flag_resource: flagResource,
      show_flag: s.flags?.show ?? false,
      flag_required: s.flags?.required ?? false,
      flags: s.flags?.resources ?? [],
      request_limit_resource: requestLimitResource,
      show_request_limit: s.request_limits?.show ?? true,
      request_limit_required: s.request_limits?.required ?? false,
      request_limit_suggestions: s.request_limits?.suggestions ?? [],
      request_limits: s.request_limits?.resources ?? [],
      department_resources: departmentResources,
      show_departments: s.departments?.show ?? false,
      department_suggestions: s.departments?.suggestions ?? [],
      departments_required: s.departments?.required ?? false,
      departments: s.departments?.resources ?? [],
      email_resources: emailResources,
      show_emails: s.emails?.show ?? true,
      email_suggestions: s.emails?.suggestions ?? [],
      emails_required: s.emails?.required ?? false,
      emails: s.emails?.resources ?? [],
      cohorts: s.cohorts?.resources ?? [],
      role_options: s.role_options ?? [],
      roles: s.roles ?? [],
    };
  }, [staffData]);

  const staffDataRef = React.useRef(stableStaffDataFields);
  React.useEffect(() => {
    staffDataRef.current = stableStaffDataFields;
  }, [stableStaffDataFields]);

  const currentStaffData = stableStaffDataFields;

  const canRegenerate = useCallback(
    (resourceType: ProfileResourceType): boolean => {
      if (!stableStaffDataFields) return false;
      switch (resourceType) {
        case "names":
          return stableStaffDataFields.name_resource?.generated ?? false;
        case "flags":
          return stableStaffDataFields.flag_resource?.generated ?? false;
        case "request_limits":
          return (
            stableStaffDataFields.request_limit_resource?.generated ?? false
          );
        case "departments":
          return (
            stableStaffDataFields.department_resources?.some(
              (d) => d.generated
            ) ?? false
          );
        case "emails":
          return (
            stableStaffDataFields.email_resources?.some((e) => e.generated) ??
            false
          );
        case "cohorts":
          return false;
        default:
          return false;
      }
    },
    [stableStaffDataFields]
  );

  const getInitialFormState = useCallback((): ProfileFormState => {
    const data = staffDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        active_flag_id: null as string | null,
        request_limit_id: null as string | null,
        department_ids: [] as string[],
        email_ids: [] as string[],
        primary_email_index: 0 as number,
        cohort_ids: [] as string[],
        role: "instructional" as string,
        primary_department_id: null as string | null,
      };
    }
    const primaryDepartmentId =
      "primary_department_id" in data && data.primary_department_id
        ? data.primary_department_id
        : (data.department_ids?.[0] ?? null);
    return {
      name_id: data.name_id ?? null,
      active_flag_id: data.active_flag_id ?? null,
      request_limit_id: data.request_limit_id ?? null,
      department_ids: data.department_ids ?? [],
      email_ids: data.email_ids ?? [],
      primary_email_index: data.primary_email_index ?? 0,
      cohort_ids: data.cohort_ids ?? [],
      role: data.role ?? "instructional",
      primary_department_id: primaryDepartmentId,
    };
  }, []);

  const [formState, setFormState] =
    useState<ProfileFormState>(getInitialFormState);
  const formStateRef = React.useRef<Record<string, unknown>>(
    formState as unknown as Record<string, unknown>
  );
  const lastPatchedFormStateRef = React.useRef<ProfileFormState | null>(
    getInitialFormState()
  );
  React.useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  const departmentIdsStr = React.useMemo(
    () => JSON.stringify(currentStaffData?.department_ids ?? []),
    [currentStaffData?.department_ids]
  );
  const emailIdsStr = React.useMemo(
    () => JSON.stringify(currentStaffData?.email_ids ?? []),
    [currentStaffData?.email_ids]
  );
  const cohortIdsStr = React.useMemo(
    () => JSON.stringify(currentStaffData?.cohort_ids ?? []),
    [currentStaffData?.cohort_ids]
  );

  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name_id !== newState.name_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        prev.request_limit_id !== newState.request_limit_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.email_ids) !== JSON.stringify(newState.email_ids) ||
        prev.primary_email_index !== newState.primary_email_index ||
        JSON.stringify(prev.cohort_ids) !==
          JSON.stringify(newState.cohort_ids) ||
        prev.role !== newState.role ||
        prev.primary_department_id !== newState.primary_department_id
      ) {
        lastPatchedFormStateRef.current = newState;
        return newState;
      }
      return prev;
    });
  }, [
    currentStaffData?.name_id,
    currentStaffData?.active_flag_id,
    currentStaffData?.request_limit_id,
    departmentIdsStr,
    emailIdsStr,
    cohortIdsStr,
    currentStaffData?.role,
  ]);

  useEffect(() => {
    setFormState((prev) => {
      const departmentIds = prev.department_ids ?? [];
      const primaryId = prev.primary_department_id ?? null;

      if (departmentIds.length === 0) {
        if (primaryId !== null) {
          return { ...prev, primary_department_id: null };
        }
        return prev;
      }

      if (!primaryId || !departmentIds.includes(primaryId)) {
        return { ...prev, primary_department_id: departmentIds[0] ?? null };
      }

      return prev;
    });
  }, [formState.department_ids, formState.primary_department_id]);

  const orderEmailsByPrimary = useCallback(
    (ids: string[], primaryIndex: number) => {
      if (ids.length === 0) return [];
      if (primaryIndex <= 0 || primaryIndex >= ids.length) return ids;
      const primaryId = ids[primaryIndex];
      return primaryId ? [primaryId, ...ids.filter((_, idx) => idx !== primaryIndex)] : ids;
    },
    []
  );

  const orderDepartmentsByPrimary = useCallback(
    (ids: string[], primaryId: string | null) => {
      if (!primaryId || !ids.includes(primaryId)) return ids;
      return [primaryId, ...ids.filter((id) => id !== primaryId)];
    },
    []
  );

  const patchActionRef = React.useRef<
    | ((
        payload: Record<string, unknown>
      ) => Promise<{ draft_id?: string | null; new_version?: number | null }>)
    | undefined
  >(undefined);
  React.useEffect(() => {
    if (patchProfileDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) =>
        patchProfileDraftAction({ body: payload } as PatchProfileDraftIn);
    } else {
      patchActionRef.current = undefined;
    }
  }, [patchProfileDraftAction]);

  const formStateKey = useMemo(
    () =>
      JSON.stringify({
        name_id: formState.name_id,
        active_flag_id: formState.active_flag_id,
        request_limit_id: formState.request_limit_id,
        department_ids: formState.department_ids,
        primary_department_id: formState.primary_department_id,
        email_ids: formState.email_ids,
        primary_email_index: formState.primary_email_index,
        cohort_ids: formState.cohort_ids,
        role: formState.role || null,
      }),
    [
      formState.name_id,
      formState.active_flag_id,
      formState.request_limit_id,
      formState.department_ids,
      formState.primary_department_id,
      formState.email_ids,
      formState.primary_email_index,
      formState.cohort_ids,
      formState.role,
    ]
  );

  const hasResourceIds = checkHasResourceIds(
    PROFILE_RESOURCES,
    formState as unknown as Record<string, unknown>
  );

  const buildPatchPayload = useCallback(
    (
      draftId: string | null,
      expectedVersion: number,
      flushResults?: Record<string, unknown>
    ): Record<string, unknown> => {
      const current = computeEffectiveFormState(
        PROFILE_RESOURCES,
        formStateRef.current,
        flushResults ?? {}
      ) as ProfileFormState;

      const refState = lastPatchedFormStateRef.current as
        | (ProfileFormState & Record<string, unknown>)
        | null;

      // Build flat draft payload for simple resources (only changed fields)
      const draftFields = buildDraftPayload(PROFILE_RESOURCES, {
        formState: formStateRef.current,
        referenceState: refState,
        flushResults: (flushResults ?? {}) as Record<string, unknown>,
      });

      // Override department_ids/email_ids with ordering if present
      if (draftFields["department_ids"] !== undefined) {
        draftFields["department_ids"] = orderDepartmentsByPrimary(
          (draftFields["department_ids"] as string[]) ?? [],
          current.primary_department_id
        );
        if (
          (draftFields["department_ids"] as string[] | null)?.length === 0
        ) {
          draftFields["department_ids"] = null;
        }
      }
      if (draftFields["email_ids"] !== undefined) {
        draftFields["email_ids"] = orderEmailsByPrimary(
          (draftFields["email_ids"] as string[]) ?? [],
          current.primary_email_index ?? 0
        );
        if ((draftFields["email_ids"] as string[] | null)?.length === 0) {
          draftFields["email_ids"] = null;
        }
      }

      // Add role if changed
      const roleChanged = refState
        ? current.role !== refState["role"]
        : !!current.role;
      if (roleChanged) {
        draftFields["role"] = current.role || null;
      }

      return {
        input_draft_id: draftId || null,
        group_id: currentStaffData?.group_id ?? null,
        ...draftFields,
        expected_version: expectedVersion,
      };
    },
    [currentStaffData, orderDepartmentsByPrimary, orderEmailsByPrimary]
  );

  const onPatchSuccess = useCallback(() => {
    lastPatchedFormStateRef.current = {
      ...(formStateRef.current as unknown as ProfileFormState),
    };
  }, []);

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey,
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    serverDraftVersion: currentStaffData?.draft_version ?? null,
    hasResourceIds,
    flushRegistryRef,
    formStateRef,
    onPatchSuccess,
  });

  // --- useAiGeneration hook ---
  const onAiComplete = useCallback((data: Record<string, unknown>) => {
    return {
      aiUpdates: {} as Record<string, unknown>,
      formStateUpdater: (prev: Record<string, unknown>) => {
        const updates: Record<string, unknown> = {};

        const nameResource = data["name_resource"] as { id?: string } | undefined;
        if (nameResource?.id) updates["name_id"] = nameResource.id;

        const flagResource = data["flag_resource"] as
          | { flag_option_id?: string }
          | undefined;
        if (flagResource?.flag_option_id) {
          updates["active_flag_id"] = flagResource.flag_option_id;
        }

        const requestLimitResource = data["request_limit_resource"] as
          | { id?: string }
          | undefined;
        if (requestLimitResource?.id) {
          updates["request_limit_id"] = requestLimitResource.id;
        }

        const deptResources = data["department_resources"] as
          | Array<{ department_id?: string }>
          | undefined;
        const deptIds = deptResources
          ?.map((d) => d.department_id)
          .filter((id): id is string => !!id);
        if (deptIds && deptIds.length > 0) {
          const prevDeptIds = (prev["department_ids"] as string[]) ?? [];
          const newDeptIds = deptIds.filter(
            (id) => !prevDeptIds.includes(id)
          );
          updates["department_ids"] = [...prevDeptIds, ...newDeptIds];
        }

        const emailResources = data["email_resources"] as
          | Array<{ id?: string }>
          | undefined;
        const emailIds = emailResources
          ?.map((e) => e.id)
          .filter((id): id is string => !!id);
        if (emailIds && emailIds.length > 0) {
          const prevEmailIds = (prev["email_ids"] as string[]) ?? [];
          const newEmailIds = emailIds.filter(
            (id) => !prevEmailIds.includes(id)
          );
          updates["email_ids"] = [...prevEmailIds, ...newEmailIds];
          if (prevEmailIds.length === 0) {
            updates["primary_email_index"] = 0;
          }
        }

        const cohortResources = data["cohort_resources"] as
          | Array<{ cohort_id?: string }>
          | undefined;
        const cohortIds = cohortResources
          ?.map((c) => c.cohort_id)
          .filter((id): id is string => !!id);
        if (cohortIds && cohortIds.length > 0) {
          const prevCohortIds = (prev["cohort_ids"] as string[]) ?? [];
          const newCohortIds = cohortIds.filter(
            (id) => !prevCohortIds.includes(id)
          );
          updates["cohort_ids"] = [...prevCohortIds, ...newCohortIds];
        }

        return { ...prev, ...updates };
      },
    };
  }, []);

  const { isGenerating, setGeneratingResources } = useAiGeneration<
    ProfileResourceType,
    Record<string, unknown>
  >({
    socket,
    isConnected,
    artifactType: "profile",
    groupId: currentStaffData?.group_id,
    eventPrefix: "profile_generation",
    validResourceTypes: [...VALID_RESOURCE_TYPES],
    onComplete: onAiComplete,
    setFormState: setFormState as Dispatch<
      SetStateAction<Record<string, unknown>>
    >,
  });

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ProfileResourceType[],
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt as ProfileResourceType));
        return next;
      });

      const formData = formDataRef.current;
      let draftId = (formData["draftId"] as string | undefined) ?? null;
      if (!draftId) {
        draftId = await flushAllAndSave();
      }
      if (!draftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      socket.emit("profile_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId,
        target_profile_id: staffId || null,
      });
    },
    [
      socket,
      isConnected,
      staffId,
      setGeneratingResources,
      formDataRef,
      flushAllAndSave,
    ]
  );

  const handleGenerateName = useCallback(
    async () => handleGenerateResources(["names"]),
    [handleGenerateResources]
  );

  const handleGenerateDepartments = useCallback(
    async () => handleGenerateResources(["departments"]),
    [handleGenerateResources]
  );

  const handleGenerateFlags = useCallback(
    async () => handleGenerateResources(["flags"]),
    [handleGenerateResources]
  );

  const handleGenerateEmails = useCallback(
    async () => handleGenerateResources(["emails"]),
    [handleGenerateResources]
  );

  const handleGenerateRequestLimits = useCallback(
    async () => handleGenerateResources(["request_limits"]),
    [handleGenerateResources]
  );

  const handleGenerateCohorts = useCallback(
    async () => handleGenerateResources(["cohorts"]),
    [handleGenerateResources]
  );

  const disabled = useMemo(() => {
    if (!currentStaffData) return false;
    return !currentStaffData.can_edit;
  }, [currentStaffData]);

  const resourceLabels: Partial<Record<ProfileResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      flags: "Flags",
      departments: "Departments",
      emails: "Emails",
      request_limits: "Request Limits",
      cohorts: "Cohorts",
    }),
    []
  );

  const stepResources = useMemo<Record<string, ProfileResourceType[]>>(
    () => ({
      basic: [...STEP_RESOURCES.basic],
      contact: [...STEP_RESOURCES.contact],
      roles: [...STEP_RESOURCES.roles],
      cohorts: [...STEP_RESOURCES.cohorts],
      all: [...STEP_RESOURCES.all],
    }),
    []
  );

  // --- useGenerationModal hook ---
  const { handleOpenStepCardModal, modalProps } =
    useGenerationModal<ProfileResourceType>({
      stepResources,
      resourceLabels,
      canRegenerate,
      onGenerate: (selectedResources, instructions) => {
        handleGenerateResources(
          selectedResources as ProfileResourceType[],
          instructions
        );
      },
      isGenerating,
    });

  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      let flushResults: Record<string, unknown> = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      const effectiveFormState = computeEffectiveFormState(
        PROFILE_RESOURCES,
        formStateRef.current,
        flushResults
      ) as ProfileFormState;

      if (currentStaffData?.name_required && !effectiveFormState.name_id) {
        toast.error("Name is required");
        throw new Error("Name is required");
      }

      if (
        currentStaffData?.departments_required &&
        (!effectiveFormState.department_ids ||
          effectiveFormState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        currentStaffData?.departments_required &&
        effectiveFormState.department_ids.length > 0 &&
        !effectiveFormState.primary_department_id
      ) {
        toast.error("Primary department is required");
        throw new Error("Primary department is required");
      }

      if (
        currentStaffData?.emails_required &&
        (!effectiveFormState.email_ids ||
          effectiveFormState.email_ids.length === 0)
      ) {
        toast.error("Emails are required");
        throw new Error("Emails are required");
      }

      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveStaffAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      if (!effectiveFormState.name_id) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        await saveStaffAction({
          body: {
            input_profile_id: isEditMode && staffId ? staffId : null,
            role: effectiveFormState.role || null,
            name_id: effectiveFormState.name_id!,
            flag_id: effectiveFormState.active_flag_id ?? null,
            request_limit_id: effectiveFormState.request_limit_id ?? null,
            email_ids: effectiveFormState.email_ids?.length
              ? effectiveFormState.email_ids
              : null,
            department_ids: effectiveFormState.department_ids?.length
              ? effectiveFormState.department_ids
              : null,
            cohort_ids: effectiveFormState.cohort_ids?.length
              ? effectiveFormState.cohort_ids
              : null,
            expected_version: currentStaffData?.draft_version ?? 0,
          },
        });
        toast.success(
          `Staff ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/management/staff");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} staff: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      isEditMode,
      staffId,
      profile?.id,
      saveStaffAction,
      router,
      isAutosaveEnabled,
      flushAllResources,
      formDataRef,
      getInitialFormState,
      currentStaffData?.name_required,
      currentStaffData?.departments_required,
      currentStaffData?.emails_required,
      currentStaffData?.group_id,
      currentStaffData?.draft_version,
      currentStaffData,
    ]
  );

  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasDepartments = formState.department_ids.length > 0;
      const hasRole = !!formState.role;
      const hasCohorts = formState.cohort_ids.length > 0;
      const hasPrimaryDepartment = !!formState.primary_department_id;
      const hasEmails = formState.email_ids.length > 0;
      const needsDepartments = currentStaffData?.departments_required ?? false;

      switch (stepId) {
        case "basic":
          if (!hasName) return "active";
          if (needsDepartments) {
            return hasDepartments ? "completed" : "active";
          }
          return "completed";
        case "contact":
          if (!hasName) return "pending";
          if (!hasEmails) return "active";
          if (needsDepartments && !hasPrimaryDepartment) return "active";
          return "completed";
        case "roles":
          if (!hasName) return "pending";
          return hasRole ? "completed" : "active";
        case "cohorts":
          if (!hasName) return "pending";
          return hasCohorts ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState, currentStaffData?.departments_required]
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the staff member's name, departments, and active status.",
        resetFields: ["name", "active", "department_ids"],
      },
      {
        id: "contact",
        title: "Contact Information",
        description:
          "Set email addresses, request limits, and primary department.",
        resetFields: ["emails", "request_limit", "primary_department_id"],
      },
      {
        id: "roles",
        title: "Roles",
        description: "Select the staff member's role.",
        resetFields: ["role", "roleSearch", "roleShowSelected"],
      },
      {
        id: "cohorts",
        title: "Cohorts",
        description: "Assign cohorts to this staff member (optional).",
        optional: true,
        resetFields: ["cohort_ids", "cohortSearch", "cohortShowSelected"],
      },
    ],
    []
  );

  const formFieldKeys = useMemo(
    () => [
      "name",
      "active",
      "emails",
      "request_limit",
      "department_ids",
      "cohort_ids",
      "role",
      "primary_department_id",
    ],
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "contact":
        return "Contact information reset";
      case "roles":
        return "Roles reset";
      case "cohorts":
        return "Cohorts reset";
      default:
        return "Reset";
    }
  }, []);

  const handleReset = useCallback((stepId: string) => {
    setFormState((prev) => {
      switch (stepId) {
        case "basic":
          return {
            ...prev,
            name_id: null,
            active_flag_id: null,
            department_ids: [],
            primary_department_id: null,
          };
        case "contact":
          return {
            ...prev,
            email_ids: [],
            primary_email_index: 0,
            request_limit_id: null,
            primary_department_id: null,
          };
        case "roles":
          return {
            ...prev,
            role: "",
          };
        case "cohorts":
          return {
            ...prev,
            cohort_ids: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/management/staff",
      backLabel: "Back",
      createLabel: "Create Staff",
      updateLabel: "Update Staff",
    }),
    []
  );

  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData: stepFormData,
      setFormData: setStepFormData,
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
      filters?: Array<{
        key: string;
        label: string;
        value: boolean;
        onChange: (value: boolean) => void;
      }>;
      onReset?: () => void;
    }) => {
      switch (stepId) {
        case "basic":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              customHeader={
                <div className="flex items-end gap-2">
                  <Names
                    name_id={formState.name_id ?? null}
                    name_resource={currentStaffData?.name_resource ?? null}
                    show_name={currentStaffData?.show_name ?? true}
                    name_suggestions={currentStaffData?.name_suggestions ?? []}
                    names={currentStaffData?.names ?? []}
                    disabled={disabled}
                    onNameIdChange={(nameId) =>
                      setFormState((prev) => ({
                        ...prev,
                        name_id: nameId,
                      }))
                    }
                    onGenerate={handleGenerateName}
                    isGenerating={isGenerating("names")}
                    placeholder="e.g., Jane Doe"
                    defaultName="Name"
                    required={currentStaffData?.name_required ?? false}
                    hideDescription={true}
                    group_id={currentStaffData?.group_id ?? null}
                    createNamesAction={createNamesAction}
                    registerFlush={registerFlushCallbacks["names"]}
                  />
                </div>
              }
              resetFields={["name", "active", "department_ids"]}
              actions={
                STEP_RESOURCES.basic.length > 0 ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={[...STEP_RESOURCES.basic]}
                    canRegenerate={(rt) =>
                      canRegenerate(rt as ProfileResourceType)
                    }
                    isGenerating={(rt) => isGenerating(rt as ProfileResourceType)}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={currentStaffData?.department_resources ?? []}
                  show_departments={currentStaffData?.show_departments ?? false}
                  department_suggestions={
                    currentStaffData?.department_suggestions ?? []
                  }
                  departments={currentStaffData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      department_ids: ids,
                    }))
                  }
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  required={currentStaffData?.departments_required ?? false}
                  group_id={currentStaffData?.group_id ?? null}
                />
                <Flags
                  flags={currentStaffData?.flags ?? []}
                  flag_id={formState.active_flag_id ?? null}
                  show_flags={currentStaffData?.show_flag ?? false}
                  columns={1}
                  label="Active"
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("flags")}
                  group_id={currentStaffData?.group_id ?? null}
                />
              </div>
            </StepCard>
          );

        case "contact":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["emails", "request_limit", "primary_department_id"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                STEP_RESOURCES.contact.length > 0 ? (
                  <StepCardAiButton
                    stepId="contact"
                    resourceTypes={[...STEP_RESOURCES.contact]}
                    canRegenerate={(rt) =>
                      canRegenerate(rt as ProfileResourceType)
                    }
                    isGenerating={(rt) => isGenerating(rt as ProfileResourceType)}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-4">
                <Emails
                  email_ids={formState.email_ids ?? []}
                  email_resources={currentStaffData?.email_resources ?? []}
                  show_emails={currentStaffData?.show_emails ?? true}
                  email_suggestions={currentStaffData?.email_suggestions ?? []}
                  emails={currentStaffData?.emails ?? []}
                  disabled={disabled}
                  onChange={(ids, primaryIndex) =>
                    setFormState((prev) => ({
                      ...prev,
                      email_ids: ids,
                      primary_email_index: primaryIndex,
                    }))
                  }
                  primary_email_index={formState.primary_email_index ?? 0}
                  onGenerate={handleGenerateEmails}
                  isGenerating={isGenerating("emails")}
                  required={currentStaffData?.emails_required ?? false}
                  group_id={currentStaffData?.group_id ?? null}
                  createEmailsAction={createEmailsAction}
                  registerFlush={registerFlushCallbacks["emails"]}
                />

                <RequestLimits
                  request_limit_id={formState.request_limit_id ?? null}
                  request_limit_resource={
                    currentStaffData?.request_limit_resource ?? null
                  }
                  show_request_limit={
                    currentStaffData?.show_request_limit ?? true
                  }
                  request_limit_suggestions={
                    currentStaffData?.request_limit_suggestions ?? []
                  }
                  request_limits={currentStaffData?.request_limits ?? []}
                  disabled={disabled}
                  onRequestLimitIdChange={(requestLimitId) =>
                    setFormState((prev) => ({
                      ...prev,
                      request_limit_id: requestLimitId,
                    }))
                  }
                  onGenerate={handleGenerateRequestLimits}
                  isGenerating={isGenerating("request_limits")}
                  required={currentStaffData?.request_limit_required ?? false}
                  group_id={currentStaffData?.group_id ?? null}
                  createRequestLimitsAction={createRequestLimitsAction}
                  registerFlush={registerFlushCallbacks["request_limits"]}
                />

                {currentStaffData?.departments &&
                currentStaffData.departments.length > 0
                  ? (() => {
                      const departmentList = (currentStaffData.departments ??
                        []) as Array<{
                        department_id?: string;
                        name?: string;
                        description?: string;
                      }>;
                      const allDepartments =
                        departmentList
                          ?.filter((dept) => dept.department_id && dept.name)
                          .map((dept) => ({
                            id: dept.department_id!,
                            name: dept.name!,
                            description: dept.description ?? "",
                          })) ?? [];
                      const departmentMap = new Map(
                        allDepartments.map((dept) => [dept.id, dept])
                      );
                      const availableDepartmentIds = formState.department_ids;
                      const primaryDepartmentItems = availableDepartmentIds
                        .map((id) => departmentMap.get(id))
                        .filter(
                          (
                            dept
                          ): dept is {
                            id: string;
                            name: string;
                            description: string;
                          } => !!dept
                        )
                        .sort((a, b) => a.name.localeCompare(b.name));
                      const primaryDepartmentId =
                        formState.primary_department_id ?? null;
                      const displayedPrimaryDepartments = primaryDepartmentId
                        ? primaryDepartmentItems.filter(
                            (dept) => dept.id === primaryDepartmentId
                          )
                        : [];

                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <Label
                              htmlFor="primary-department"
                              className="flex gap-1"
                            >
                              Primary Department
                              <span className="text-destructive">*</span>
                            </Label>
                            <GenericPicker<{
                              id: string;
                              name: string;
                              description: string;
                            }>
                              items={primaryDepartmentItems}
                              selectedIds={
                                primaryDepartmentId ? [primaryDepartmentId] : []
                              }
                              onSelect={(ids) => {
                                const nextId = ids[0] ?? null;
                                if (!nextId) return;
                                setFormState((prev) => {
                                  const nextDepartmentIds =
                                    prev.department_ids.includes(nextId)
                                      ? prev.department_ids
                                      : [...prev.department_ids, nextId];
                                  return {
                                    ...prev,
                                    department_ids: nextDepartmentIds,
                                    primary_department_id: nextId,
                                  };
                                });
                              }}
                              getId={(item) => item.id}
                              getLabel={(item) => item.name}
                              getSearchText={(item) =>
                                `${item.name} ${item.description}`.trim()
                              }
                              placeholder="Select primary department"
                              disabled={
                                disabled || primaryDepartmentItems.length === 0
                              }
                              multiSelect={false}
                              showLabel={false}
                              compact={true}
                              buttonClassName="h-8"
                              showClearAction={false}
                            />
                          </div>
                          <SelectableGrid
                            items={displayedPrimaryDepartments}
                            selectedId={primaryDepartmentId}
                            onSelect={(departmentId) => {
                              setFormState((prev) => {
                                const nextDepartmentIds =
                                  prev.department_ids.includes(departmentId)
                                    ? prev.department_ids
                                    : [...prev.department_ids, departmentId];
                                return {
                                  ...prev,
                                  department_ids: nextDepartmentIds,
                                  primary_department_id: departmentId,
                                };
                              });
                            }}
                            getId={(item) => item.id}
                            renderItem={(item, isSelected) => (
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
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-sm leading-tight">
                                    {item.name}
                                  </h3>
                                  {item.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                            emptyMessage="No departments available."
                            disabled={disabled}
                          />
                        </div>
                      );
                    })()
                  : null}
              </div>
            </StepCard>
          );

        case "roles": {
          const roleShowSelected =
            (stepFormData["roleShowSelected"] as boolean | null | undefined) ??
            false;
          const roleSearch =
            (stepFormData["roleSearch"] as string | null | undefined) || "";

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={roleSearch}
              onSearchChange={(term: string) =>
                setStepFormData({ roleSearch: term || null })
              }
              searchPlaceholder="Search roles..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: roleShowSelected,
                  onChange: (value) =>
                    setStepFormData({ roleShowSelected: value }),
                },
              ]}
              resetFields={["role", "roleSearch", "roleShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Roles
                role={formState.role ?? ""}
                role_options={currentStaffData?.role_options ?? []}
                roles={currentStaffData?.roles ?? []}
                disabled={disabled}
                editable={false}
                onRoleChange={(roleId) =>
                  setFormState((prev) => ({ ...prev, role: roleId }))
                }
                searchTerm={roleSearch}
                showSelectedFilter={roleShowSelected}
              />
            </StepCard>
          );
        }

        case "cohorts": {
          const cohortShowSelected =
            (stepFormData["cohortShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          const cohortSearch =
            (stepFormData["cohortSearch"] as string | null | undefined) || "";

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={cohortSearch}
              onSearchChange={(term: string) =>
                setStepFormData({ cohortSearch: term || null })
              }
              searchPlaceholder="Search cohorts..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: cohortShowSelected,
                  onChange: (value) =>
                    setStepFormData({ cohortShowSelected: value }),
                },
              ]}
              resetFields={["cohort_ids", "cohortSearch", "cohortShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                STEP_RESOURCES.cohorts.length > 0 ? (
                  <StepCardAiButton
                    stepId="cohorts"
                    resourceTypes={[...STEP_RESOURCES.cohorts]}
                    canRegenerate={(rt) =>
                      canRegenerate(rt as ProfileResourceType)
                    }
                    isGenerating={(rt) => isGenerating(rt as ProfileResourceType)}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Cohorts
                cohort_ids={formState.cohort_ids ?? []}
                cohort_resources={[]}
                show_cohorts={(currentStaffData?.cohorts?.length ?? 0) > 0}
                cohort_suggestions={[]}
                cohorts={
                  (currentStaffData?.cohorts ?? []).map((c) => ({
                    cohort_id: c.cohort_id ?? null,
                    name:
                      ("name" in c
                        ? (c.name as string | null | undefined)
                        : (c.title as string | null | undefined)) ?? null,
                    ...(c.description ? { description: c.description } : {}),
                    generated: false,
                  }))
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, cohort_ids: ids }))
                }
                onGenerate={handleGenerateCohorts}
                isGenerating={isGenerating("cohorts")}
                group_id={currentStaffData?.group_id ?? null}
                searchTerm={cohortSearch}
                showSelectedFilter={cohortShowSelected}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      currentStaffData,
      disabled,
      isEditMode,
      handleGenerateName,
      handleGenerateDepartments,
      handleGenerateFlags,
      handleGenerateEmails,
      handleGenerateRequestLimits,
      handleGenerateCohorts,
      isGenerating,
      formState.name_id,
      formState.active_flag_id,
      formState.request_limit_id,
      formState.email_ids,
      formState.primary_email_index,
      formState.department_ids,
      formState.cohort_ids,
      formState.role,
      formState.primary_department_id,
      createNamesAction,
      createEmailsAction,
      createRequestLimitsAction,
      canRegenerate,
      handleOpenStepCardModal,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`staff-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={currentStaffData?.disabled_reason ?? null}
          entityType="profile"
        />

        <GenericForm
          nuqsParsers={
            staffSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={staffData}
          formFieldKeys={formFieldKeys}
          onReset={(stepId) => handleReset(stepId)}
          resetSuccessMessage={resetSuccessMessage}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={disabled}
          isEditMode={isEditMode}
          renderStep={renderStep}
          onFormDataChange={onFormDataChange}
          registerSetFormData={(setter) => {
            setUrlFormDataRef.current = setter;
          }}
        />

        <GenerateRegenerateModal {...modalProps} />
      </div>
    </TooltipProvider>
  );
}

export default React.memo(ProfileComponent, (prevProps, nextProps) => {
  if (prevProps.staffId !== nextProps.staffId) {
    return false;
  }

  if (JSON.stringify(prevProps.staffData) !== JSON.stringify(nextProps.staffData)) {
    return false;
  }

  if (
    prevProps.saveStaffAction !== nextProps.saveStaffAction ||
    prevProps.patchProfileDraftAction !== nextProps.patchProfileDraftAction ||
    prevProps.createNamesAction !== nextProps.createNamesAction ||
    prevProps.createEmailsAction !== nextProps.createEmailsAction ||
    prevProps.createRequestLimitsAction !==
      nextProps.createRequestLimitsAction
  ) {
    return false;
  }

  return true;
});
