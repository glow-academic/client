/**
 * Department.tsx
 * Implementation using modular resource components
 * Used to create and manage departments - supports both creation and editing
 * Follows Persona.tsx patterns exactly
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/FlagsLegacy";
import { Names } from "@/components/resources/Names";
import { Settings } from "@/components/resources/Settings";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveDepartmentIn = InputOf<"/api/v4/departments/save", "post">;
type SaveDepartmentOut = OutputOf<"/api/v4/departments/save", "post">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftSettingsIn = InputOf<"/api/v4/resources/settings", "post">;
type CreateDraftSettingsOut = OutputOf<"/api/v4/resources/settings", "post">;
type PatchDepartmentDraftIn = InputOf<"/api/v4/departments/draft", "patch">;
type PatchDepartmentDraftOut = OutputOf<"/api/v4/departments/draft", "patch">;

type DepartmentData = OutputOf<"/api/v4/departments/get", "post">;

export interface DepartmentProps {
  departmentId?: string;
  // Server-provided data (for server-side rendering)
  departmentData?: DepartmentData;
  // Server actions (replaces useMutation)
  saveDepartmentAction?: (
    input: SaveDepartmentIn
  ) => Promise<SaveDepartmentOut>;
  patchDepartmentDraftAction?: (
    input: PatchDepartmentDraftIn
  ) => Promise<PatchDepartmentDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createFlagsAction?: (
    input: CreateDraftFlagsIn
  ) => Promise<CreateDraftFlagsOut>;
  createSettingsAction?: (
    input: CreateDraftSettingsIn
  ) => Promise<CreateDraftSettingsOut>;
}

function DepartmentComponent({
  departmentId,
  departmentData,
  saveDepartmentAction,
  patchDepartmentDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createFlagsAction,
  createSettingsAction,
}: DepartmentProps) {
  const router = useRouter();
  const isEditMode = !!departmentId;
  const {
    profile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Generation state for AI workflows
  const [generatingResources, setGeneratingResources] = useState<
    Set<ResourceType>
  >(new Set());

  const isGenerating = useCallback(
    (resourceType: ResourceType) => generatingResources.has(resourceType),
    [generatingResources]
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store departmentData to prevent callback recreation on every render
  const departmentDataRef = React.useRef(departmentData);
  React.useEffect(() => {
    departmentDataRef.current = departmentData;
  }, [departmentData]);

  // Memoize departmentData fields used in renderStep to prevent callback recreation
  // when only object reference changes (but content is same)
  const stableDepartmentDataFields = React.useMemo(() => {
    if (!departmentData) return null;
    return {
      group_id: departmentData.group_id,
      name_resource: departmentData.name_resource,
      show_name: departmentData.show_name,
      name_suggestions: departmentData.name_suggestions,
      names: departmentData.names,
      name_required: departmentData.name_required,
      name_agent_id: departmentData.name_agent_id,
      description_resource: departmentData.description_resource,
      show_description: departmentData.show_description,
      description_suggestions: departmentData.description_suggestions,
      description_required: departmentData.description_required,
      description_agent_id: departmentData.description_agent_id,
      descriptions: departmentData.descriptions,
      flag_resource: departmentData.flag_resource,
      show_flag: departmentData.show_flag,
      flag_required: departmentData.flag_required,
      flag_agent_id: departmentData.flag_agent_id,
      flags: departmentData.flags,
      settings_resources: departmentData.settings_resources,
      show_settings: departmentData.show_settings,
      settings_suggestions: departmentData.settings_suggestions,
      settings_required: departmentData.settings_required,
      settings_agent_id: departmentData.settings_agent_id,
      settings: departmentData.settings,
    };
    // Intentionally depend on individual fields, not whole departmentData object
    // to prevent recreation when only object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    departmentData?.group_id,
    departmentData?.name_resource,
    departmentData?.show_name,
    departmentData?.name_suggestions,
    departmentData?.names,
    departmentData?.name_required,
    departmentData?.name_agent_id,
    departmentData?.description_resource,
    departmentData?.show_description,
    departmentData?.description_suggestions,
    departmentData?.description_required,
    departmentData?.description_agent_id,
    departmentData?.descriptions,
    departmentData?.flag_resource,
    departmentData?.show_flag,
    departmentData?.flag_required,
    departmentData?.flag_agent_id,
    departmentData?.flags,
    departmentData?.settings_resources,
    departmentData?.show_settings,
    departmentData?.settings_suggestions,
    departmentData?.settings_required,
    departmentData?.settings_agent_id,
    departmentData?.settings,
  ]);

  const getInitialFormState = useCallback(() => {
    const data = departmentDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        active_flag_id: null as string | null,
        settings_ids: [] as string[],
      };
    }
    // Extract resource IDs from server data
    // Note: Server data may have display values, but we only store IDs here
    return {
      name_id: data.name_id ?? null,
      description_id: data.description_id ?? null,
      active_flag_id: data.active_flag_id ?? null,
      settings_ids: data.settings_ids ?? [],
    };
    // Remove departmentData from dependencies - use ref instead to prevent callback recreation
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies to prevent effect from running when array references change but content is same
  const settingsIdsStr = React.useMemo(
    () => JSON.stringify(departmentData?.settings_ids ?? []),
    [departmentData?.settings_ids]
  );

  // Memoize stringified formState arrays for draft listener effect dependencies
  const formStateSettingsIdsStr = React.useMemo(
    () => JSON.stringify(formState.settings_ids),
    [formState.settings_ids]
  );

  // Update form state when server data changes
  // Use departmentData directly in dependency array, not getInitialFormState
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        JSON.stringify(prev.settings_ids) !==
          JSON.stringify(newState.settings_ids)
      ) {
        return newState;
      }
      return prev;
    });
    // Use stringified arrays in dependencies to prevent effect from running when array references change but content is same
    // Intentionally exclude formState and getInitialFormState to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    departmentData?.name_id,
    departmentData?.description_id,
    departmentData?.active_flag_id,
    settingsIdsStr,
  ]);

  // Draft version tracking for optimistic concurrency control
  // Keep version in a ref so updating it doesn't retrigger the effect
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion =
    departmentData && "draft_version" in departmentData
      ? (departmentData as { draft_version?: number | null }).draft_version
      : null;
  React.useEffect(() => {
    if (
      typeof draftVersion === "number" &&
      draftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(draftVersion);
      lastSavedVersionRef.current = draftVersion;
    }
  }, [draftVersion]);

  // Get draftId from GenericForm's URL state via bridge (GenericForm is single source of truth)
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  // Store formData from GenericForm to access search params
  const formDataRef = React.useRef<Record<string, unknown>>({});

  // Memoized callback to sync draftId from GenericForm - only update if value changed
  const onFormDataChange = React.useCallback((fd: Record<string, unknown>) => {
    // Store formData for access in handleGenerateResources
    formDataRef.current = fd;
    const next = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === next ? prev : next));
  }, []);

  // Sync URL draftId to profile context
  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  // WebSocket handlers for AI generation - unified handler for all resource types
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Use single group_id from departmentData
    const currentGroupId = departmentData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_id?: string | null;
      description_id?: string | null;
      active_flag_id?: string | null;
      settings_ids?: string[];
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "department" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this department or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "settings",
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        // Update formState with the resource ID that was generated
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (data.name_id) updates.name_id = data.name_id;
          if (data.description_id) updates.description_id = data.description_id;
          if (data.active_flag_id) updates.active_flag_id = data.active_flag_id;
          if (data.settings_ids && data.settings_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newSettingsIds = data.settings_ids.filter(
              (id) => !prev.settings_ids.includes(id)
            );
            updates.settings_ids = [...prev.settings_ids, ...newSettingsIds];
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
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "department" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this department or wrong group_id
      }
      // Handle progress updates if needed
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "department" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this department or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "settings",
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

    // Listen to department-specific events filtered by artifact_type and group_id
    socket.on("department_generation_progress", handleGenerationProgress);
    socket.on("department_generation_complete", handleGenerationComplete);
    socket.on("department_generation_error", handleGenerationError);

    return () => {
      socket.off("department_generation_progress", handleGenerationProgress);
      socket.off("department_generation_complete", handleGenerationComplete);
      socket.off("department_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, departmentData?.group_id]);

  // Use ref to stabilize patchDepartmentDraftAction to prevent effect recreation when prop reference changes
  const patchDepartmentDraftActionRef = React.useRef(
    patchDepartmentDraftAction
  );
  React.useEffect(() => {
    patchDepartmentDraftActionRef.current = patchDepartmentDraftAction;
  }, [patchDepartmentDraftAction]);

  // Build a stable key for "what would we patch" - only changes when form data actually changes
  const draftPatchKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftId || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      active_flag_id: formState.active_flag_id,
      settings_ids: formState.settings_ids,
    });
    // Use stringified arrays to prevent recreation when array references change but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formState.active_flag_id,
    formStateSettingsIdsStr,
  ]);

  // Track last patched payload so we don't repatch identical state
  const lastPatchedKeyRef = React.useRef<string | null>(null);

  // Draft change listener - watches resource IDs and patches draft
  // Only triggers when the payload actually changes, not when version changes
  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.active_flag_id ||
      formState.settings_ids.length > 0;

    if (!hasResourceIds || !patchDepartmentDraftActionRef.current) {
      return;
    }

    // ✅ If nothing changed since the last successful patch, do nothing.
    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchDepartmentDraftActionRef.current) return;
        const result = await patchDepartmentDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            active_flag_id: formState.active_flag_id,
            settings_ids: formState.settings_ids,
            expected_version: lastSavedVersionRef.current, // ✅ ref, not state dep
          },
        });

        // Mark this payload as patched so we don't loop
        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          // Update URL when draft is created via GenericForm bridge (GenericForm owns URL state)
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        // This can stay as state (for UI), but it won't re-trigger patching
        // because the effect is gated by payload changes.
        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }
      } catch {
        // Failed to save draft - error already logged by API
        // Don't update lastPatchedKeyRef on failure so we retry on next change
      }
    }, 1000);

    return () => clearTimeout(timer);
    // ✅ Trigger only when payload changes, not when version changes
    // patchDepartmentDraftAction and setDraftId are accessed via refs to prevent effect recreation
    // when prop/function references change but functionality is the same
    // We access formState fields and draftId inside the effect, but depend on draftPatchKey
    // to prevent unnecessary effect recreation when individual fields change but payload is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftPatchKey, // ✅ trigger only when payload changes
    // patchDepartmentDraftAction and setDraftId are accessed via refs
  ]);

  // Helper function to determine agent_type from resource types
  // Departments don't have basic/content agents, so return individual agent IDs
  const determineAgentType = useCallback(
    (resourceTypes: ResourceType[]): string | null => {
      if (resourceTypes.length === 1) {
        // Single resource type - map to agent_type
        const agentTypeMap: Partial<Record<ResourceType, string>> = {
          names: "name",
          descriptions: "description",
          flags: "flags",
          settings: "settings",
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

  // Multi-generation handler - accepts list of resource types and optional user instructions
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

      // Set all resources as generating
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      // Read draftId from formData
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;

      // Emit department_generate event
      socket.emit("department_generate", {
        resource_types: resourceTypes,
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        mcp: false,
        department_id: departmentId || null,
      });
    },
    [socket, isConnected, departmentId]
  );

  // Individual generation handlers - generate directly without modals
  const handleGenerateName = useCallback(
    async () =>
      handleGenerateResources(["names"], determineAgentType(["names"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDescription = useCallback(
    async () =>
      handleGenerateResources(
        ["descriptions"],
        determineAgentType(["descriptions"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateFlags = useCallback(
    async () =>
      handleGenerateResources(["flags"], determineAgentType(["flags"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateSettings = useCallback(
    async () =>
      handleGenerateResources(["settings"], determineAgentType(["settings"])),
    [handleGenerateResources, determineAgentType]
  );

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!departmentData) return false;
    return !departmentData.can_edit;
  }, [departmentData]);

  // Set breadcrumb context when department data is loaded
  useEffect(() => {
    const departmentName = departmentData?.name_resource?.name;
    if (departmentName && departmentId && isEditMode) {
      setEntityMetadata({
        entityId: departmentId,
        entityName: departmentName,
        entityType: "department",
      });
    }
    return () => clearEntityMetadata();
  }, [
    departmentData,
    departmentId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs using {resource}_required flags from departmentData
      if (departmentData?.name_required && !formState.name_id) {
        toast.error("Department name is required");
        throw new Error("Department name is required");
      }

      // Ensure profileId exists - required for API calls
      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveDepartmentAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      // Ensure required fields are present (TypeScript guard)
      if (!formState.name_id) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        await saveDepartmentAction({
          body: {
            input_department_id:
              isEditMode && departmentId ? departmentId : null,
            name_id: formState.name_id,
            description_id: formState.description_id || null,
            active_flag_id: formState.active_flag_id || null,
            settings_id:
              formState.settings_ids && formState.settings_ids.length > 0
                ? formState.settings_ids[0]
                : null,
          },
        });
        toast.success(
          `Department ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/system/departments");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} department: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      formState,
      isEditMode,
      departmentId,
      profile?.id,
      saveDepartmentAction,
      router,
      departmentData?.name_required,
    ]
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the department name, description, active status, and settings.",
        resetFields: ["name", "description", "active", "settings"],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => ["name", "description", "active", "settings"],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
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
            description_id: null,
            active_flag_id: null,
            settings_ids: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/system/departments",
      backLabel: "Back",
      createLabel: "Create Department",
      updateLabel: "Update Department",
    }),
    []
  );

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  // Memoize to prevent new object reference on every render
  const departmentSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
    }),
    []
  );

  // Memoize renderStep to prevent GenericForm re-renders
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
      onReset?: () => void;
    }) => {
      // Use memoized fields to avoid dependency on departmentData object reference
      const currentDepartmentData = stableDepartmentDataFields;
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
                <Names
                  name_id={formState.name_id ?? null}
                  name_resource={currentDepartmentData?.name_resource ?? null}
                  show_name={currentDepartmentData?.show_name ?? true}
                  name_suggestions={
                    currentDepartmentData?.name_suggestions ?? []
                  }
                  names={currentDepartmentData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., Computer Science"
                  defaultName="New Department"
                  required={currentDepartmentData?.name_required ?? false}
                  hideDescription={true}
                  group_id={currentDepartmentData?.group_id ?? null}
                  agent_id={currentDepartmentData?.name_agent_id ?? null}
                  createNamesAction={createNamesAction}
                />
              }
              resetFields={["name", "description", "active", "settings"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                {/* Description field - using Descriptions resource component */}
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    currentDepartmentData?.description_resource ?? null
                  }
                  show_description={
                    currentDepartmentData?.show_description ?? true
                  }
                  description_suggestions={
                    currentDepartmentData?.description_suggestions ?? []
                  }
                  descriptions={currentDepartmentData?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                    }))
                  }
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  label="Description"
                  placeholder="Enter a brief description (optional)"
                  required={
                    currentDepartmentData?.description_required ?? false
                  }
                  rows={4}
                  data-testid="input-department-description"
                  group_id={currentDepartmentData?.group_id ?? null}
                  agent_id={currentDepartmentData?.description_agent_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={currentDepartmentData?.flag_resource ?? null}
                  show_flag={currentDepartmentData?.show_flag ?? false}
                  flags={currentDepartmentData?.flags ?? []}
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
                  helpText="Inactive departments will not be visible to users"
                  required={currentDepartmentData?.flag_required ?? false}
                  group_id={currentDepartmentData?.group_id ?? null}
                  agent_id={currentDepartmentData?.flag_agent_id ?? null}
                  createFlagsAction={createFlagsAction}
                />

                {/* Settings Selection */}
                <Settings
                  settings_ids={formState.settings_ids ?? []}
                  settings_resources={
                    currentDepartmentData?.settings_resources ?? []
                  }
                  show_settings={currentDepartmentData?.show_settings ?? false}
                  settings_suggestions={
                    currentDepartmentData?.settings_suggestions ?? []
                  }
                  settings={currentDepartmentData?.settings ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, settings_ids: ids }))
                  }
                  onGenerate={handleGenerateSettings}
                  isGenerating={isGenerating("settings")}
                  required={currentDepartmentData?.settings_required ?? false}
                  group_id={currentDepartmentData?.group_id ?? null}
                  agent_id={currentDepartmentData?.settings_agent_id ?? null}
                  createSettingsAction={createSettingsAction}
                />
              </div>
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      // Use stableDepartmentDataFields instead of departmentData to prevent callback recreation
      // when only object reference changes (but content is same)
      stableDepartmentDataFields,
      disabled,
      isEditMode,
      // Depend on individual formState fields instead of whole object to prevent callback recreation
      // when object reference changes but values are same
      formState.name_id,
      formState.description_id,
      formState.active_flag_id,
      formState.settings_ids,
      createNamesAction,
      createDescriptionsAction,
      createFlagsAction,
      createSettingsAction,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateFlags,
      handleGenerateSettings,
      isGenerating,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`department-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={departmentData?.disabled_reason ?? null}
          entityType="department"
        />

        <GenericForm
          nuqsParsers={
            departmentSearchParamsClient as Record<string, Parser<unknown>>
          }
        steps={steps}
        getStepStatus={getStepStatus}
        serverData={departmentData}
        formFieldKeys={formFieldKeys}
        resetSuccessMessage={resetSuccessMessage}
        onReset={(stepId) => handleReset(stepId)}
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
      </div>
    </TooltipProvider>
  );
}

export default React.memo(DepartmentComponent);
