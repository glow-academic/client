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
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
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
import { Roles } from "@/components/resources/Roles";
import { Routes } from "@/components/resources/Routes";
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
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

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
      roleSearch: parseAsString,
      roleShowSelected: parseAsBoolean,
      cohortSearch: parseAsString,
      cohortShowSelected: parseAsBoolean,
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
      name_resource: staffData.name_resource,
      show_name: staffData.show_name,
      name_suggestions: staffData.name_suggestions,
      names: staffData.names,
      name_required: staffData.name_required,
      name_agent_id: staffData.name_agent_id,
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
      roles: staffData.roles,
      role_routes: staffData.role_routes,
      route_resources: staffData.route_resources,
      show_routes: staffData.show_routes,
      route_suggestions: staffData.route_suggestions,
      routes: staffData.routes,
    };
  }, [
    staffData?.group_id,
    staffData?.name_resource,
    staffData?.show_name,
    staffData?.name_suggestions,
    staffData?.names,
    staffData?.name_required,
    staffData?.name_agent_id,
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
    staffData?.roles,
    staffData?.role_routes,
    staffData?.route_resources,
    staffData?.show_routes,
    staffData?.route_suggestions,
    staffData?.routes,
  ]);

  const currentStaffData = stableStaffDataFields;

  const roleRoutesByRole = useMemo(() => {
    const mapping = new Map<string, string[]>();
    const roleRoutes = currentStaffData?.role_routes ?? [];
    roleRoutes.forEach((entry) => {
      if (!entry || !entry.role || !entry.route_id) return;
      const current = mapping.get(entry.role) ?? [];
      current.push(entry.route_id);
      mapping.set(entry.role, current);
    });
    return mapping;
  }, [currentStaffData?.role_routes]);

  useEffect(() => {
    if (isEditMode) return;
    if (!formState.role || formState.route_ids.length > 0) return;
    const defaults = roleRoutesByRole.get(formState.role);
    if (defaults && defaults.length > 0) {
      setFormState((prev) => ({ ...prev, route_ids: defaults }));
    }
  }, [formState.role, formState.route_ids.length, isEditMode, roleRoutesByRole]);

  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!stableStaffDataFields) return false;
      switch (resourceType) {
        case "names":
          return (
            stableStaffDataFields.name_resource?.generated ?? false
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
        name_id: null as string | null,
        active_flag_id: null as string | null,
        request_limit_id: null as string | null,
        department_ids: [] as string[],
        email_ids: [] as string[],
        primary_email_index: 0 as number,
        cohort_ids: [] as string[],
        role: "instructional" as string,
        route_ids: [] as string[],
        primary_department_id: null as string | null,
      };
    }
    const primaryDepartmentId =
      "primary_department_id" in data && data.primary_department_id
        ? data.primary_department_id
        : data.department_ids?.[0] ?? null;
    return {
      name_id: data.name_id ?? null,
      active_flag_id: data.active_flag_id ?? null,
      request_limit_id: data.request_limit_id ?? null,
      department_ids: data.department_ids ?? [],
      email_ids: data.email_ids ?? [],
      primary_email_index: data.primary_email_index ?? 0,
      cohort_ids: data.cohort_ids ?? [],
      role: data.role ?? "instructional",
      route_ids: data.route_ids ?? [],
      primary_department_id: primaryDepartmentId,
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
  const routeIdsStr = React.useMemo(
    () => JSON.stringify(staffData?.route_ids ?? []),
    [staffData?.route_ids]
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
        JSON.stringify(prev.route_ids) !==
          JSON.stringify(newState.route_ids) ||
        prev.primary_department_id !== newState.primary_department_id
      ) {
        return newState;
      }
      return prev;
    });
  }, [
    staffData?.name_id,
    staffData?.active_flag_id,
    staffData?.request_limit_id,
    departmentIdsStr,
    emailIdsStr,
    cohortIdsStr,
    routeIdsStr,
    staffData?.primary_email_index,
    staffData?.role,
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
        return { ...prev, primary_department_id: departmentIds[0] };
      }

      return prev;
    });
  }, [formState.department_ids, formState.primary_department_id]);

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
      name_id?: string | null;
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

          if (data.name_id) updates.name_id = data.name_id;
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

  const handleGenerateName = useCallback(
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
      basic: ["names", "flags", "departments"],
      contact: ["emails", "request_limits"],
      roles: [],
      cohorts: ["cohorts"],
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
    const staffName = staffData?.name;
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
      if (staffData?.name_required && !formState.name_id) {
        toast.error("Name is required");
        throw new Error("Name is required");
      }

      if (
        staffData?.departments_required &&
        (!formState.department_ids || formState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        staffData?.departments_required &&
        formState.department_ids.length > 0 &&
        !formState.primary_department_id
      ) {
        toast.error("Primary department is required");
        throw new Error("Primary department is required");
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

      if (!formState.name_id) {
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
        const primaryDepartmentIndex = formState.primary_department_id
          ? (formState.department_ids ?? []).indexOf(
              formState.primary_department_id
            )
          : -1;
        const primaryDepartmentIndexValue =
          primaryDepartmentIndex >= 0 ? primaryDepartmentIndex : null;

        await saveStaffAction({
          body: {
            input_staff_id: isEditMode && staffId ? staffId : null,
            name_id: formState.name_id,
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
            route_ids:
              formState.route_ids && formState.route_ids.length > 0
                ? formState.route_ids
                : null,
            emails: emailTexts,
            primary_email_index: formState.primary_email_index ?? 0,
            ...(primaryDepartmentIndexValue !== null && {
              primary_department_index: primaryDepartmentIndexValue,
            }),
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
      staffData?.name_required,
      staffData?.departments_required,
      staffData?.emails_required,
      staffData?.email_resources,
      currentStaffData,
      createdRequestLimits,
    ]
  );

  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasDepartments = formState.department_ids.length > 0;
      const hasRole = !!formState.role;
      const hasRoutes = formState.route_ids.length > 0;
      const hasCohorts = formState.cohort_ids.length > 0;
      const hasPrimaryDepartment = !!formState.primary_department_id;
      const hasEmails = formState.email_ids.length > 0;
      const needsDepartments = staffData?.departments_required ?? false;

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
        case "routes":
          if (!hasName) return "pending";
          if (formState.role === "custom") {
            return hasRoutes ? "completed" : "active";
          }
          return "completed";
        default:
          return "pending";
      }
    },
    [formState, staffData?.departments_required]
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
        description:
          "Set the staff member's name, departments, and active status.",
        resetFields: ["name", "active", "department_ids"],
      },
      {
        id: "contact",
        title: "Contact Information",
        description: "Set email addresses, request limits, and primary department.",
        resetFields: ["emails", "request_limit", "primary_department_id"],
      },
      {
        id: "roles",
        title: "Roles",
        description: "Select the staff member's role.",
        resetFields: ["role", "roleSearch", "roleShowSelected"],
      },
      {
        id: "routes",
        title: "Routes",
        description: "Select the routes this profile can access.",
        optional: true,
        resetFields: ["route_ids", "routeSearch", "routeShowSelected"],
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
      "route_ids",
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
      case "routes":
        return "Routes reset";
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
        case "routes":
          return {
            ...prev,
            route_ids: [],
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
                    agent_id={currentStaffData?.name_agent_id ?? null}
                    createNamesAction={createNamesAction}
                  />
                </div>
              }
              resetFields={["name", "active", "department_ids"]}
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
                    setFormState((prev) => ({
                      ...prev,
                      department_ids: ids,
                    }))
                  }
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  required={currentStaffData?.departments_required ?? false}
                  group_id={currentStaffData?.group_id ?? null}
                  agent_id={currentStaffData?.departments_agent_id ?? null}
                  createDepartmentsAction={createDepartmentsAction}
                />
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
              resetFields={["emails", "request_limit", "primary_department_id"]}
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

                {currentStaffData?.departments &&
                currentStaffData.departments.length > 0 ? (
                  (() => {
                    const allDepartments =
                      currentStaffData.departments
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
                ) : null}
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
                onRoleChange={(roleId) =>
                  setFormState((prev) => ({ ...prev, role: roleId }))
                }
                searchTerm={roleSearch}
                showSelectedFilter={roleShowSelected}
              />
            </StepCard>
          );
        }

        case "routes": {
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["route_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Routes
                route_ids={formState.route_ids ?? []}
                route_resources={currentStaffData?.route_resources ?? []}
                show_routes={currentStaffData?.show_routes ?? true}
                route_suggestions={currentStaffData?.route_suggestions ?? []}
                routes={currentStaffData?.routes ?? []}
                disabled={disabled}
                onChange={(routeIds) =>
                  setFormState((prev) => ({ ...prev, route_ids: routeIds }))
                }
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
                stepResources["cohorts"] && stepResources["cohorts"].length > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "cohorts"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "cohorts",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["cohorts"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["cohorts"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["cohorts"]!.some((rt) =>
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
      stepResources,
      formState.name_id,
      formState.active_flag_id,
      formState.request_limit_id,
      formState.email_ids,
      formState.primary_email_index,
      formState.department_ids,
      formState.route_ids,
      formState.cohort_ids,
      formState.role,
      formState.primary_department_id,
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
    name_id: prevProps.staffData?.name_id,
    active_flag_id: prevProps.staffData?.active_flag_id,
    request_limit_id: prevProps.staffData?.request_limit_id,
    department_ids: prevProps.staffData?.department_ids,
    email_ids: prevProps.staffData?.email_ids,
    cohort_ids: prevProps.staffData?.cohort_ids,
    role: prevProps.staffData?.role,
    primary_department_id: prevProps.staffData?.primary_department_id,
  };
  const nextIds = {
    name_id: nextProps.staffData?.name_id,
    active_flag_id: nextProps.staffData?.active_flag_id,
    request_limit_id: nextProps.staffData?.request_limit_id,
    department_ids: nextProps.staffData?.department_ids,
    email_ids: nextProps.staffData?.email_ids,
    cohort_ids: nextProps.staffData?.cohort_ids,
    role: nextProps.staffData?.role,
    primary_department_id: nextProps.staffData?.primary_department_id,
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
