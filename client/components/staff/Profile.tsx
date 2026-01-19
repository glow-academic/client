/**
 * Profile.tsx
 * Implementation using modular resource components
 * Used to create and manage profiles - supports both creation and editing
 * Follows Persona.tsx pattern exactly
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { StepCard } from "@/components/common/forms/StepCard";
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Cohorts } from "@/components/resources/Cohorts";
import { Departments } from "@/components/resources/Departments";
import { Emails } from "@/components/resources/Emails";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { RequestLimits } from "@/components/resources/RequestLimits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useGenerationContext } from "@/contexts/generation-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { Loader2, Sparkles } from "lucide-react";
import { parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveStaffIn = InputOf<"/api/v4/profiles/save", "post">;
type SaveStaffOut = OutputOf<"/api/v4/profiles/save", "post">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftEmailsIn = InputOf<"/api/v4/resources/emails", "post">;
type CreateDraftEmailsOut = OutputOf<"/api/v4/resources/emails", "post">;
type CreateDraftRequestLimitsIn = InputOf<
  "/api/v4/resources/request_limits",
  "post"
>;
type CreateDraftRequestLimitsOut = OutputOf<
  "/api/v4/resources/request_limits",
  "post"
>;
type CreateDraftCohortsIn = InputOf<"/api/v4/resources/cohorts", "post">;
type CreateDraftCohortsOut = OutputOf<"/api/v4/resources/cohorts", "post">;

type StaffData = OutputOf<"/api/v4/staff/get", "post">;

export interface ProfileProps {
  staffId?: string;
  staffData?: StaffData;
  saveStaffAction?: (input: SaveStaffIn) => Promise<SaveStaffOut>;
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createFlagsAction?: (
    input: CreateDraftFlagsIn
  ) => Promise<CreateDraftFlagsOut>;
  createDepartmentsAction?: (
    input: CreateDraftDepartmentsIn
  ) => Promise<CreateDraftDepartmentsOut>;
  createEmailsAction?: (
    input: CreateDraftEmailsIn
  ) => Promise<CreateDraftEmailsOut>;
  createRequestLimitsAction?: (
    input: CreateDraftRequestLimitsIn
  ) => Promise<CreateDraftRequestLimitsOut>;
  createCohortsAction?: (
    input: CreateDraftCohortsIn
  ) => Promise<CreateDraftCohortsOut>;
}

function ProfileComponent({
  staffId,
  staffData,
  saveStaffAction,
  createNamesAction,
  createFlagsAction,
  createDepartmentsAction,
  createEmailsAction,
  createRequestLimitsAction,
  createCohortsAction,
}: ProfileProps) {
  const router = useRouter();
  const isEditMode = !!staffId;
  const {
    effectiveProfile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { setGenerationCapability, clearGenerationCapability } =
    useGenerationContext();

  const [generatingResources, setGeneratingResources] = useState<
    Set<ResourceType>
  >(new Set());

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalMode, setModalMode] = useState<"generate" | "regenerate" | null>(
    null
  );
  const [modalResources, setModalResources] = useState<
    GenerateRegenerateModalResource[]
  >([]);
  const [modalInstructions, setModalInstructions] = useState("");

  const isGenerating = useCallback(
    (resourceType: ResourceType) => generatingResources.has(resourceType),
    [generatingResources]
  );

  const staffSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
    }),
    []
  );

  const staffDataRef = React.useRef(staffData);
  React.useEffect(() => {
    staffDataRef.current = staffData;
  }, [staffData]);

  const stableStaffDataFields = React.useMemo(() => {
    if (!staffData) return null;
    return {
      group_id: staffData.group_id,
      first_name_resource: staffData.first_name_resource,
      show_first_name: staffData.show_first_name,
      first_name_suggestions: staffData.first_name_suggestions,
      first_names: staffData.first_names,
      first_name_required: staffData.first_name_required,
      first_name_agent_id: staffData.first_name_agent_id,
      last_name_resource: staffData.last_name_resource,
      show_last_name: staffData.show_last_name,
      last_name_suggestions: staffData.last_name_suggestions,
      last_names: staffData.last_names,
      last_name_required: staffData.last_name_required,
      last_name_agent_id: staffData.last_name_agent_id,
      flag_resource: staffData.flag_resource,
      show_flag: staffData.show_flag,
      flag_required: staffData.flag_required,
      flag_agent_id: staffData.flag_agent_id,
      flags: staffData.flags,
      request_limit_resource: staffData.request_limit_resource,
      show_request_limit: staffData.show_request_limit,
      request_limit_required: staffData.request_limit_required,
      request_limit_agent_id: staffData.request_limit_agent_id,
      request_limit_suggestions: staffData.request_limit_suggestions,
      request_limits: staffData.request_limits,
      department_resources: staffData.department_resources,
      show_departments: staffData.show_departments,
      department_suggestions: staffData.department_suggestions,
      departments_required: staffData.departments_required,
      departments_agent_id: staffData.departments_agent_id,
      departments: staffData.departments,
      email_resources: staffData.email_resources,
      show_emails: staffData.show_emails,
      email_suggestions: staffData.email_suggestions,
      emails_required: staffData.emails_required,
      emails_agent_id: staffData.emails_agent_id,
      emails: staffData.emails,
      cohorts: staffData.cohorts,
      role_options: staffData.role_options,
    };
  }, [
    staffData?.group_id,
    staffData?.first_name_resource,
    staffData?.show_first_name,
    staffData?.first_name_suggestions,
    staffData?.first_names,
    staffData?.first_name_required,
    staffData?.first_name_agent_id,
    staffData?.last_name_resource,
    staffData?.show_last_name,
    staffData?.last_name_suggestions,
    staffData?.last_names,
    staffData?.last_name_required,
    staffData?.last_name_agent_id,
    staffData?.flag_resource,
    staffData?.show_flag,
    staffData?.flag_required,
    staffData?.flag_agent_id,
    staffData?.flags,
    staffData?.request_limit_resource,
    staffData?.show_request_limit,
    staffData?.request_limit_required,
    staffData?.request_limit_agent_id,
    staffData?.request_limit_suggestions,
    staffData?.request_limits,
    staffData?.department_resources,
    staffData?.show_departments,
    staffData?.department_suggestions,
    staffData?.departments_required,
    staffData?.departments_agent_id,
    staffData?.departments,
    staffData?.email_resources,
    staffData?.show_emails,
    staffData?.email_suggestions,
    staffData?.emails_required,
    staffData?.emails_agent_id,
    staffData?.emails,
    staffData?.cohorts,
    staffData?.role_options,
  ]);

  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!stableStaffDataFields) return false;
      switch (resourceType) {
        case "names":
          return (
            (stableStaffDataFields.first_name_resource?.generated ?? false) ||
            (stableStaffDataFields.last_name_resource?.generated ?? false)
          );
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

  const getInitialFormState = useCallback(() => {
    const data = staffDataRef.current;
    if (!data) {
      return {
        first_name_id: null as string | null,
        last_name_id: null as string | null,
        active_flag_id: null as string | null,
        request_limit_id: null as string | null,
        department_ids: [] as string[],
        email_ids: [] as string[],
        primary_email_index: 0 as number,
        cohort_ids: [] as string[],
        role: "instructional" as string,
      };
    }
    return {
      first_name_id: data.first_name_id ?? null,
      last_name_id: data.last_name_id ?? null,
      active_flag_id: data.active_flag_id ?? null,
      request_limit_id: data.request_limit_id ?? null,
      department_ids: data.department_ids ?? [],
      email_ids: data.email_ids ?? [],
      primary_email_index: data.primary_email_index ?? 0,
      cohort_ids: data.cohort_ids ?? [],
      role: data.role ?? "instructional",
    };
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  const departmentIdsStr = React.useMemo(
    () => JSON.stringify(staffData?.department_ids ?? []),
    [staffData?.department_ids]
  );
  const emailIdsStr = React.useMemo(
    () => JSON.stringify(staffData?.email_ids ?? []),
    [staffData?.email_ids]
  );
  const cohortIdsStr = React.useMemo(
    () => JSON.stringify(staffData?.cohort_ids ?? []),
    [staffData?.cohort_ids]
  );

  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.first_name_id !== newState.first_name_id ||
        prev.last_name_id !== newState.last_name_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        prev.request_limit_id !== newState.request_limit_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.email_ids) !== JSON.stringify(newState.email_ids) ||
        prev.primary_email_index !== newState.primary_email_index ||
        JSON.stringify(prev.cohort_ids) !==
          JSON.stringify(newState.cohort_ids) ||
        prev.role !== newState.role
      ) {
        return newState;
      }
      return prev;
    });
  }, [
    staffData?.first_name_id,
    staffData?.last_name_id,
    staffData?.active_flag_id,
    staffData?.request_limit_id,
    departmentIdsStr,
    emailIdsStr,
    cohortIdsStr,
    staffData?.primary_email_index,
    staffData?.role,
  ]);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [createdRequestLimits, setCreatedRequestLimits] = useState<
    Record<string, number>
  >({});
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  const formDataRef = React.useRef<Record<string, unknown>>({});

  const onFormDataChange = React.useCallback((fd: Record<string, unknown>) => {
    formDataRef.current = fd;
    const next = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const currentGroupId = staffData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      first_name_id?: string | null;
      last_name_id?: string | null;
      active_flag_id?: string | null;
      request_limit_id?: string | null;
      department_ids?: string[];
      email_ids?: string[];
      cohort_ids?: string[];
      primary_email_index?: number;
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      if (
        data.artifact_type !== "profile" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "flags",
        "request_limits",
        "departments",
        "emails",
        "cohorts",
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (data.first_name_id) updates.first_name_id = data.first_name_id;
          if (data.last_name_id) updates.last_name_id = data.last_name_id;
          if (data.active_flag_id) updates.active_flag_id = data.active_flag_id;
          if (data.request_limit_id)
            updates.request_limit_id = data.request_limit_id;
          if (data.department_ids && data.department_ids.length > 0) {
            const newDeptIds = data.department_ids.filter(
              (id) => !prev.department_ids.includes(id)
            );
            updates.department_ids = [...prev.department_ids, ...newDeptIds];
          }
          if (data.email_ids && data.email_ids.length > 0) {
            const newEmailIds = data.email_ids.filter(
              (id) => !prev.email_ids.includes(id)
            );
            updates.email_ids = [...prev.email_ids, ...newEmailIds];
            if (data.primary_email_index !== undefined) {
              updates.primary_email_index = data.primary_email_index;
            }
          }
          if (data.cohort_ids && data.cohort_ids.length > 0) {
            const newCohortIds = data.cohort_ids.filter(
              (id) => !prev.cohort_ids.includes(id)
            );
            updates.cohort_ids = [...prev.cohort_ids, ...newCohortIds];
          }

          return { ...prev, ...updates };
        });

        setGeneratingResources((prev) => {
          const next = new Set(prev);
          next.delete(data.resource_type as ResourceType);
          return next;
        });
        if (data.success) {
          toast.success(
            data.message || `${data.resource_type} generated successfully`
          );
        } else {
          toast.error(
            data.message || `Failed to generate ${data.resource_type}`
          );
        }
      }
    };

    const handleGenerationProgress = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      [key: string]: unknown;
    }) => {
      if (
        data.artifact_type !== "profile" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
      if (
        data.artifact_type !== "profile" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "flags",
        "request_limits",
        "departments",
        "emails",
        "cohorts",
      ];
      const resourceTypes =
        data.resource_types || (data.resource_type ? [data.resource_type] : []);
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt as ResourceType)) {
            next.delete(rt as ResourceType);
          }
        });
        return next;
      });
      toast.error(data.message || "Generation failed");
    };

    socket.on("profile_generation_progress", handleGenerationProgress);
    socket.on("profile_generation_complete", handleGenerationComplete);
    socket.on("profile_generation_error", handleGenerationError);

    return () => {
      socket.off("profile_generation_progress", handleGenerationProgress);
      socket.off("profile_generation_complete", handleGenerationComplete);
      socket.off("profile_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, staffData?.group_id]);

  const determineAgentType = useCallback(
    (resourceTypes: ResourceType[]): string | null => {
      const basicResources: ResourceType[] = [
        "names",
        "flags",
        "departments",
        "emails",
      ];
      const allResourceTypes: ResourceType[] = [
        "names",
        "flags",
        "request_limits",
        "departments",
        "emails",
        "cohorts",
      ];

      const isBasicCombo =
        resourceTypes.length === basicResources.length &&
        resourceTypes.every((rt) => basicResources.includes(rt));
      const isAllResources =
        resourceTypes.length === allResourceTypes.length &&
        resourceTypes.every((rt) => allResourceTypes.includes(rt));

      if (isAllResources) {
        return "general";
      } else if (isBasicCombo) {
        return "basic";
      } else if (resourceTypes.length === 1) {
        const agentTypeMap: Partial<Record<ResourceType, string>> = {
          names: "name",
          flags: "flags",
          departments: "departments",
          emails: "emails",
          request_limits: "request_limits",
          cohorts: "cohorts",
        };
        const firstType = resourceTypes[0];
        if (firstType && firstType in agentTypeMap) {
          return agentTypeMap[firstType] ?? null;
        }
      }
      return null;
    },
    []
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      agentType: string | null,
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;

      socket.emit("profile_generate", {
        resource_types: resourceTypes,
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        mcp: false,
        staff_id: staffId || null,
      });
    },
    [socket, isConnected, staffId]
  );

  const handleGenerateFirstName = useCallback(
    async () =>
      handleGenerateResources(["names"], determineAgentType(["names"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateLastName = useCallback(
    async () =>
      handleGenerateResources(["names"], determineAgentType(["names"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDepartments = useCallback(
    async () =>
      handleGenerateResources(
        ["departments"],
        determineAgentType(["departments"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateFlags = useCallback(
    async () =>
      handleGenerateResources(["flags"], determineAgentType(["flags"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateEmails = useCallback(
    async () =>
      handleGenerateResources(["emails"], determineAgentType(["emails"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateRequestLimits = useCallback(
    async () =>
      handleGenerateResources(
        ["request_limits"],
        determineAgentType(["request_limits"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateCohorts = useCallback(
    async () =>
      handleGenerateResources(["cohorts"], determineAgentType(["cohorts"])),
    [handleGenerateResources, determineAgentType]
  );

  const disabled = useMemo(() => {
    if (!staffData) return false;
    return !staffData.can_edit;
  }, [staffData]);

  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "flags"],
      contact: ["emails", "request_limits"],
      organization: ["departments", "cohorts"],
      all: [
        "names",
        "flags",
        "request_limits",
        "departments",
        "emails",
        "cohorts",
      ],
    }),
    []
  );

  const resourceLabels: Partial<Record<ResourceType, string>> = useMemo(
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

  const handleOpenStepCardModal = useCallback(
    (stepId: string, mode: "generate" | "regenerate") => {
      const resourceTypes = stepResources[stepId] || [];
      const resources: GenerateRegenerateModalResource[] = resourceTypes.map(
        (rt) => ({
          id: rt,
          label: resourceLabels[rt] ?? "",
          active: mode === "regenerate" ? canRegenerate(rt) : true,
        })
      );

      setModalResources(resources);
      setModalMode(mode);
      setModalInstructions("");
      setShowGenerateModal(true);
    },
    [stepResources, resourceLabels, canRegenerate]
  );

  useEffect(() => {
    const staffName =
      staffData?.first_name && staffData?.last_name
        ? `${staffData.first_name} ${staffData.last_name}`
        : staffData?.name;
    if (staffName && staffId && isEditMode) {
      setEntityMetadata({
        entityId: staffId,
        entityName: staffName,
        entityType: "staff",
      });
    }
    return () => clearEntityMetadata();
  }, [staffData, staffId, isEditMode, setEntityMetadata, clearEntityMetadata]);

  useEffect(() => {
    const handleFullPageGenerate = () => {
      if (staffData?.general_agent_id || staffId) {
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [staffData?.general_agent_id, staffId, handleOpenStepCardModal]);

  useEffect(() => {
    setGenerationCapability({
      artifactType: "profile",
      canGenerate: false,
      agentId: null,
    });
    return () => clearGenerationCapability();
  }, [setGenerationCapability, clearGenerationCapability]);

  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (staffData?.first_name_required && !formState.first_name_id) {
        toast.error("First name is required");
        throw new Error("First name is required");
      }

      if (staffData?.last_name_required && !formState.last_name_id) {
        toast.error("Last name is required");
        throw new Error("Last name is required");
      }

      if (
        staffData?.departments_required &&
        (!formState.department_ids || formState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        staffData?.emails_required &&
        (!formState.email_ids || formState.email_ids.length === 0)
      ) {
        toast.error("Emails are required");
        throw new Error("Emails are required");
      }

      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveStaffAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      if (!formState.first_name_id || !formState.last_name_id) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        const emailTexts =
          formState.email_ids.length > 0 && staffData?.email_resources
            ? formState.email_ids
                .map((id) => {
                  const emailResource = staffData.email_resources?.find(
                    (e) => e.id === id
                  );
                  return emailResource?.email ?? null;
                })
                .filter((e): e is string => e !== null)
            : [];

        await saveStaffAction({
          body: {
            input_staff_id: isEditMode && staffId ? staffId : null,
            first_name_id: formState.first_name_id,
            last_name_id: formState.last_name_id,
            active_flag_id: formState.active_flag_id || null,
            requests_per_day:
              formState.request_limit_id && formState.request_limit_id !== ""
                ? createdRequestLimits[formState.request_limit_id] ??
                  currentStaffData?.request_limits?.find(
                    (limit) => limit.id === formState.request_limit_id
                  )?.requests_per_day ??
                  currentStaffData?.request_limit_resource?.requests_per_day ??
                  null
                : null,
            department_ids: formState.department_ids || [],
            cohort_ids: formState.cohort_ids || [],
            role: formState.role || "instructional",
            emails: emailTexts,
            primary_email_index: formState.primary_email_index ?? 0,
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
      formState,
      isEditMode,
      staffId,
      effectiveProfile?.id,
      saveStaffAction,
      router,
      staffData?.first_name_required,
      staffData?.last_name_required,
      staffData?.departments_required,
      staffData?.emails_required,
      staffData?.email_resources,
      currentStaffData?.request_limits,
      currentStaffData?.request_limit_resource,
      createdRequestLimits,
    ]
  );

  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasFirstName = !!formState.first_name_id;
      const hasLastName = !!formState.last_name_id;
      const hasDepartments = formState.department_ids.length > 0;
      const hasEmails = formState.email_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasFirstName && hasLastName ? "completed" : "active";
        case "contact":
          if (!hasFirstName || !hasLastName) return "pending";
          return hasEmails ? "completed" : "active";
        case "organization":
          if (!hasFirstName || !hasLastName) return "pending";
          return hasDepartments ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  const handleModalGenerate = useCallback(
    async (selectedResources: string[], instructions: string) => {
      const resourceTypes = selectedResources as ResourceType[];
      const agentType = determineAgentType(resourceTypes);
      await handleGenerateResources(
        resourceTypes,
        agentType,
        instructions.trim() || undefined
      );
      setShowGenerateModal(false);
      setModalInstructions("");
    },
    [handleGenerateResources, determineAgentType]
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the staff member's name and active status.",
        resetFields: ["first_name", "last_name", "active"],
      },
      {
        id: "contact",
        title: "Contact Information",
        description: "Set email addresses and request limits.",
        resetFields: ["emails", "request_limit"],
      },
      {
        id: "organization",
        title: "Organization",
        description: "Assign departments and cohorts.",
        resetFields: ["department_ids", "cohort_ids", "role"],
      },
    ],
    []
  );

  const formFieldKeys = useMemo(
    () => [
      "first_name",
      "last_name",
      "active",
      "emails",
      "request_limit",
      "department_ids",
      "cohort_ids",
      "role",
    ],
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "contact":
        return "Contact information reset";
      case "organization":
        return "Organization reset";
      default:
        return "Reset";
    }
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
      const currentStaffData = stableStaffDataFields;
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
                    name_id={formState.first_name_id ?? null}
                    name_resource={
                      currentStaffData?.first_name_resource ?? null
                    }
                    show_name={currentStaffData?.show_first_name ?? true}
                    name_suggestions={
                      currentStaffData?.first_name_suggestions ?? []
                    }
                    names={currentStaffData?.first_names ?? []}
                    disabled={disabled}
                    onNameIdChange={(nameId) =>
                      setFormState((prev) => ({
                        ...prev,
                        first_name_id: nameId,
                      }))
                    }
                    onGenerate={handleGenerateFirstName}
                    isGenerating={isGenerating("names")}
                    placeholder="e.g., John"
                    defaultName="First Name"
                    required={currentStaffData?.first_name_required ?? false}
                    hideDescription={true}
                    group_id={currentStaffData?.group_id ?? null}
                    agent_id={currentStaffData?.first_name_agent_id ?? null}
                    createNamesAction={createNamesAction}
                  />
                  <Names
                    name_id={formState.last_name_id ?? null}
                    name_resource={currentStaffData?.last_name_resource ?? null}
                    show_name={currentStaffData?.show_last_name ?? true}
                    name_suggestions={
                      currentStaffData?.last_name_suggestions ?? []
                    }
                    names={currentStaffData?.last_names ?? []}
                    disabled={disabled}
                    onNameIdChange={(nameId) =>
                      setFormState((prev) => ({
                        ...prev,
                        last_name_id: nameId,
                      }))
                    }
                    onGenerate={handleGenerateLastName}
                    isGenerating={isGenerating("names")}
                    placeholder="e.g., Doe"
                    defaultName="Last Name"
                    required={currentStaffData?.last_name_required ?? false}
                    hideDescription={true}
                    group_id={currentStaffData?.group_id ?? null}
                    agent_id={currentStaffData?.last_name_agent_id ?? null}
                    createNamesAction={createNamesAction}
                  />
                </div>
              }
              resetFields={["first_name", "last_name", "active"]}
              actions={
                stepResources["basic"] && stepResources["basic"].length > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "basic"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "basic",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["basic"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["basic"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["basic"]!.some((rt) => canRegenerate(rt))
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={currentStaffData?.flag_resource ?? null}
                  show_flag={currentStaffData?.show_flag ?? false}
                  disabled={disabled}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("flags")}
                  label="Active"
                  helpText="Inactive staff members will not be able to access the system"
                  required={currentStaffData?.flag_required ?? false}
                  group_id={currentStaffData?.group_id ?? null}
                  agent_id={currentStaffData?.flag_agent_id ?? null}
                  createFlagsAction={createFlagsAction}
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
              resetFields={["emails", "request_limit"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["contact"] &&
                stepResources["contact"].length > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "contact"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "contact",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["contact"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["contact"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["contact"]!.some((rt) =>
                          canRegenerate(rt)
                        )
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                  agent_id={currentStaffData?.emails_agent_id ?? null}
                  createEmailsAction={createEmailsAction}
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
                  onRequestLimitResourceCreated={(resource) =>
                    setCreatedRequestLimits((prev) => ({
                      ...prev,
                      [resource.id]: resource.requests_per_day,
                    }))
                  }
                  onGenerate={handleGenerateRequestLimits}
                  isGenerating={isGenerating("request_limits")}
                  required={currentStaffData?.request_limit_required ?? false}
                  group_id={currentStaffData?.group_id ?? null}
                  agent_id={currentStaffData?.request_limit_agent_id ?? null}
                  createRequestLimitsAction={createRequestLimitsAction}
                />
              </div>
            </StepCard>
          );

        case "organization":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["department_ids", "cohort_ids", "role"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["organization"] &&
                stepResources["organization"].length > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "organization"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "organization",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["organization"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["organization"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["organization"]!.some((rt) =>
                          canRegenerate(rt)
                        )
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <div className="space-y-4">
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    currentStaffData?.department_resources ?? []
                  }
                  show_departments={currentStaffData?.show_departments ?? false}
                  department_suggestions={
                    currentStaffData?.department_suggestions ?? []
                  }
                  departments={currentStaffData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  required={currentStaffData?.departments_required ?? false}
                  group_id={currentStaffData?.group_id ?? null}
                  agent_id={currentStaffData?.departments_agent_id ?? null}
                  createDepartmentsAction={createDepartmentsAction}
                />

                <div className="space-y-2">
                  <Label htmlFor="role">
                    Role
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <GenericPicker<string>
                    items={currentStaffData?.role_options ?? []}
                    selectedIds={formState.role ? [formState.role] : []}
                    onSelect={(ids) => {
                      const nextRole =
                        ids[0] ?? currentStaffData?.role_options?.[0] ?? "";
                      setFormState((prev) => ({ ...prev, role: nextRole }));
                    }}
                    getId={(item) => item}
                    getLabel={(item) =>
                      item.charAt(0).toUpperCase() + item.slice(1)
                    }
                    placeholder="Select role"
                    disabled={disabled}
                    multiSelect={false}
                    showLabel={false}
                    compact={true}
                    buttonClassName="h-8"
                  />
                </div>

                <Cohorts
                  cohort_ids={formState.cohort_ids ?? []}
                  cohort_resources={[]}
                  show_cohorts={(currentStaffData?.cohorts?.length ?? 0) > 0}
                  cohort_suggestions={[]}
                  cohorts={
                    currentStaffData?.cohorts?.map((c) => ({
                      cohort_id: c.cohort_id,
                      name: c.name,
                      description: c.description,
                      generated: false,
                    })) ?? []
                  }
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, cohort_ids: ids }))
                  }
                  onGenerate={handleGenerateCohorts}
                  isGenerating={isGenerating("cohorts")}
                  group_id={currentStaffData?.group_id ?? null}
                  agent_id={null}
                  createCohortsAction={createCohortsAction}
                />
              </div>
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      stableStaffDataFields,
      disabled,
      isEditMode,
      handleGenerateFirstName,
      handleGenerateLastName,
      handleGenerateDepartments,
      handleGenerateFlags,
      handleGenerateEmails,
      handleGenerateRequestLimits,
      handleGenerateCohorts,
      isGenerating,
      stepResources,
      formState.first_name_id,
      formState.last_name_id,
      formState.active_flag_id,
      formState.request_limit_id,
      formState.email_ids,
      formState.primary_email_index,
      formState.department_ids,
      formState.cohort_ids,
      formState.role,
      createNamesAction,
      createFlagsAction,
      createDepartmentsAction,
      createEmailsAction,
      createRequestLimitsAction,
      createCohortsAction,
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
          disabledReason={staffData?.disabled_reason ?? null}
          entityType="staff"
        />

        <GenericForm
          nuqsParsers={
            staffSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={staffData}
          formFieldKeys={formFieldKeys}
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

        {modalMode && (
          <GenerateRegenerateModal
            open={showGenerateModal}
            onOpenChange={setShowGenerateModal}
            resources={modalResources}
            onResourcesChange={setModalResources}
            instructions={modalInstructions}
            onInstructionsChange={setModalInstructions}
            onGenerate={handleModalGenerate}
            isGenerating={modalResources.some((r) =>
              isGenerating(r.id as ResourceType)
            )}
            mode={modalMode}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

export default React.memo(ProfileComponent, (prevProps, nextProps) => {
  const prevIds = {
    first_name_id: prevProps.staffData?.first_name_id,
    last_name_id: prevProps.staffData?.last_name_id,
    active_flag_id: prevProps.staffData?.active_flag_id,
    request_limit_id: prevProps.staffData?.request_limit_id,
    department_ids: prevProps.staffData?.department_ids,
    email_ids: prevProps.staffData?.email_ids,
    cohort_ids: prevProps.staffData?.cohort_ids,
    role: prevProps.staffData?.role,
  };
  const nextIds = {
    first_name_id: nextProps.staffData?.first_name_id,
    last_name_id: nextProps.staffData?.last_name_id,
    active_flag_id: nextProps.staffData?.active_flag_id,
    request_limit_id: nextProps.staffData?.request_limit_id,
    department_ids: nextProps.staffData?.department_ids,
    email_ids: nextProps.staffData?.email_ids,
    cohort_ids: nextProps.staffData?.cohort_ids,
    role: nextProps.staffData?.role,
  };

  if (
    prevProps.staffId !== nextProps.staffId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false;
  }

  if (
    prevProps.saveStaffAction !== nextProps.saveStaffAction ||
    prevProps.createNamesAction !== nextProps.createNamesAction ||
    prevProps.createFlagsAction !== nextProps.createFlagsAction ||
    prevProps.createDepartmentsAction !== nextProps.createDepartmentsAction ||
    prevProps.createEmailsAction !== nextProps.createEmailsAction ||
    prevProps.createRequestLimitsAction !==
      nextProps.createRequestLimitsAction ||
    prevProps.createCohortsAction !== nextProps.createCohortsAction
  ) {
    return false;
  }

  return true;
});
