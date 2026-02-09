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
type SaveDepartmentIn = InputOf<"/api/v4/artifacts/departments/save", "post">;
type SaveDepartmentOut = OutputOf<"/api/v4/artifacts/departments/save", "post">;
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
type PatchDepartmentDraftIn = InputOf<"/api/v4/artifacts/departments/draft", "patch">;
type PatchDepartmentDraftOut = OutputOf<"/api/v4/artifacts/departments/draft", "patch">;

type DepartmentData = OutputOf<"/api/v4/artifacts/departments/get", "post">;

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
  createFlagsAction: _createFlagsAction,
  createSettingsAction: _createSettingsAction,
}: DepartmentProps) {
  const router = useRouter();
  const isEditMode = !!departmentId;
  const { profile, selectedDraftId, setSelectedDraftId, socket, isConnected } =
    useProfile();
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
    const current = departmentData.resources?.current;
    const resources = departmentData.resources?.resources;
    // Cast unknown[] types from schema to expected component types
    type NameItem = { id?: string | null; name?: string | null; generated?: boolean | null };
    type DescItem = { id?: string | null; description?: string | null; generated?: boolean | null };
    type SettingsItem = { settings_id: string | null; created_at?: string | null; active?: boolean | null; department_ids?: string[] | null; generated?: boolean | null };
    return {
      group_id: departmentData.group_id,
      // Current selections (single-select: first item, multi-select: full list)
      name_resource: (current?.names?.[0] as NameItem | undefined) ?? null,
      description_resource: (current?.descriptions?.[0] as DescItem | undefined) ?? null,
      flag_resource: current?.flags?.[0]
        ? { id: current.flags[0].flag_option_id ?? null, name: current.flags[0].label ?? null, description: current.flags[0].description ?? null, icon: current.flags[0].icon_id ?? null, generated: current.flags[0].generated ?? null }
        : null,
      settings_resources: (current?.settings ?? []) as SettingsItem[],
      // All available resources (for suggestions/options lists)
      names: (resources?.names ?? []) as NameItem[],
      descriptions: (resources?.descriptions ?? []) as DescItem[],
      flags: (resources?.flags ?? []).map((f) => ({
        id: f.flag_option_id ?? null,
        name: f.label ?? null,
        description: f.description ?? null,
        icon: f.icon_id ?? null,
        generated: f.generated ?? null,
      })),
      settings: (resources?.settings ?? []) as SettingsItem[],
      // Show/required/suggestions from flat fields
      show_name: departmentData.show_name,
      name_suggestions: departmentData.name_suggestions,
      name_required: departmentData.name_required,
      show_description: departmentData.show_description,
      description_suggestions: departmentData.description_suggestions,
      description_required: departmentData.description_required,
      show_flag: departmentData.show_flag,
      flag_required: departmentData.flag_required,
      show_settings: departmentData.show_settings,
      settings_suggestions: departmentData.settings_suggestions,
      settings_required: departmentData.settings_required,
      // Per-resource group IDs (for resource creation actions)
      names_group_id: departmentData.names_group_id,
      descriptions_group_id: departmentData.descriptions_group_id,
      flags_group_id: departmentData.flags_group_id,
      settings_group_id: departmentData.settings_group_id,
      // AI generate flags
      name_show_ai_generate: departmentData.name_show_ai_generate,
      description_show_ai_generate: departmentData.description_show_ai_generate,
      flag_show_ai_generate: departmentData.flag_show_ai_generate,
      settings_show_ai_generate: departmentData.settings_show_ai_generate,
      // Tool IDs for resource creation/linking
      name_create_tool_id: departmentData.name_create_tool_id,
      description_create_tool_id: departmentData.description_create_tool_id,
      name_link_tool_id: departmentData.name_link_tool_id,
      description_link_tool_id: departmentData.description_link_tool_id,
      flag_link_tool_id: departmentData.flag_link_tool_id,
      settings_link_tool_id: departmentData.settings_link_tool_id,
      // Domain data for generation modal
      domain_data: departmentData.domain_data,
    };
    // Intentionally depend on individual fields, not whole departmentData object
    // to prevent recreation when only object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    departmentData?.group_id,
    departmentData?.resources,
    departmentData?.show_name,
    departmentData?.name_suggestions,
    departmentData?.name_required,
    departmentData?.show_description,
    departmentData?.description_suggestions,
    departmentData?.description_required,
    departmentData?.show_flag,
    departmentData?.flag_required,
    departmentData?.show_settings,
    departmentData?.settings_suggestions,
    departmentData?.settings_required,
    departmentData?.names_group_id,
    departmentData?.descriptions_group_id,
    departmentData?.flags_group_id,
    departmentData?.settings_group_id,
    departmentData?.name_show_ai_generate,
    departmentData?.description_show_ai_generate,
    departmentData?.flag_show_ai_generate,
    departmentData?.settings_show_ai_generate,
    departmentData?.name_create_tool_id,
    departmentData?.description_create_tool_id,
    departmentData?.name_link_tool_id,
    departmentData?.description_link_tool_id,
    departmentData?.flag_link_tool_id,
    departmentData?.settings_link_tool_id,
    departmentData?.domain_data,
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
    // Extract resource IDs from resources.current (new three-layer response shape)
    const current = data.resources?.current;
    const nameItem = current?.names?.[0] as { id?: string } | undefined;
    const descItem = current?.descriptions?.[0] as { id?: string } | undefined;
    const settingsItems = (current?.settings ?? []) as Array<{ id?: string }>;
    return {
      name_id: nameItem?.id ?? null,
      description_id: descItem?.id ?? null,
      active_flag_id: current?.flags?.[0]?.flag_option_id ?? null,
      settings_ids: settingsItems
        .map((s) => s.id)
        .filter(Boolean) as string[],
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
  const currentSettingsIds = ((departmentData?.resources?.current?.settings ?? []) as Array<{ id?: string }>)
    .map((s) => s.id)
    .filter(Boolean);
  const settingsIdsStr = React.useMemo(
    () => JSON.stringify(currentSettingsIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(currentSettingsIds)]
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
    departmentData?.resources?.current?.names,
    departmentData?.resources?.current?.descriptions,
    departmentData?.resources?.current?.flags,
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
      // Full resource objects from server (via _internal() functions)
      name_resource?: { id?: string } | null;
      description_resource?: { id?: string } | null;
      flag_resource?: { flag_option_id?: string } | null;
      settings_resources?: Array<{ id?: string }> | null;
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
        // Extract IDs from full resource objects returned by server
        const nameId = data.name_resource?.id ?? null;
        const descriptionId = data.description_resource?.id ?? null;
        const flagId = data.flag_resource?.flag_option_id ?? null;
        const settingsIds = (data.settings_resources ?? [])
          .map((s) => s.id)
          .filter((id): id is string => !!id);

        // Update formState with the resource ID that was generated
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (nameId) updates.name_id = nameId;
          if (descriptionId) updates.description_id = descriptionId;
          if (flagId) updates.active_flag_id = flagId;
          if (settingsIds.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newSettingsIds = settingsIds.filter(
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

  // Map resource types to domain_ids from departmentData
  const getDomainIds = useCallback(
    (resourceTypes: ResourceType[]): string[] => {
      if (!departmentData) return [];
      const domainMap: Partial<Record<ResourceType, string | null | undefined>> = {
        names: departmentData.name_domain_id,
        descriptions: departmentData.description_domain_id,
        flags: departmentData.flag_domain_id,
        settings: departmentData.settings_domain_id,
      };
      return resourceTypes
        .map((rt) => domainMap[rt])
        .filter((id): id is string => !!id);
    },
    [departmentData]
  );

  // Multi-generation handler - accepts list of resource types and optional user instructions
  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      _agentType: string | null,
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      const domainIds = getDomainIds(resourceTypes);
      if (domainIds.length === 0) {
        toast.error("No AI agent configured for the selected resources");
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

      // Emit department_generate event with domain_ids (server derives agent + resource_types)
      socket.emit("department_generate", {
        domain_ids: domainIds,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        department_id: departmentId || null,
      });
    },
    [socket, isConnected, departmentId, getDomainIds]
  );

  // Individual generation handlers - generate directly without modals
  const handleGenerateName = useCallback(
    async () => handleGenerateResources(["names"], null),
    [handleGenerateResources]
  );

  const handleGenerateDescription = useCallback(
    async () => handleGenerateResources(["descriptions"], null),
    [handleGenerateResources]
  );

  const handleGenerateFlags = useCallback(
    async () => handleGenerateResources(["flags"], null),
    [handleGenerateResources]
  );

  const handleGenerateSettings = useCallback(
    async () => handleGenerateResources(["settings"], null),
    [handleGenerateResources]
  );

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!departmentData) return false;
    return !departmentData.can_edit;
  }, [departmentData]);

  // Set breadcrumb context when department data is loaded
  useEffect(() => {
    const nameResource = departmentData?.resources?.current?.names?.[0] as
      | { name?: string }
      | undefined;
    const departmentName = nameResource?.name;
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
            group_id: departmentData?.group_id ?? "",
            input_department_id:
              isEditMode && departmentId ? departmentId : null,
            name_id: formState.name_id,
            description_id: formState.description_id || null,
            active_flag_id: formState.active_flag_id || null,
            settings_ids:
              formState.settings_ids && formState.settings_ids.length > 0
                ? formState.settings_ids
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
      departmentData?.group_id,
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
      formData: _stepFormData,
      setFormData: _setStepFormData,
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
                  group_id={currentDepartmentData?.names_group_id ?? currentDepartmentData?.group_id ?? null}
                  showAiGenerate={currentDepartmentData?.name_show_ai_generate ?? false}
                  createNamesAction={createNamesAction}
                  create_tool_id={currentDepartmentData?.name_create_tool_id ?? null}
                  link_tool_id={currentDepartmentData?.name_link_tool_id ?? null}
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
                  group_id={currentDepartmentData?.descriptions_group_id ?? currentDepartmentData?.group_id ?? null}
                  showAiGenerate={currentDepartmentData?.description_show_ai_generate ?? false}
                  createDescriptionsAction={createDescriptionsAction}
                  create_tool_id={currentDepartmentData?.description_create_tool_id ?? null}
                  link_tool_id={currentDepartmentData?.description_link_tool_id ?? null}
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
                  group_id={currentDepartmentData?.flags_group_id ?? currentDepartmentData?.group_id ?? null}
                  showAiGenerate={currentDepartmentData?.flag_show_ai_generate ?? false}
                  link_tool_id={currentDepartmentData?.flag_link_tool_id ?? null}
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
                  group_id={currentDepartmentData?.settings_group_id ?? currentDepartmentData?.group_id ?? null}
                  showAiGenerate={currentDepartmentData?.settings_show_ai_generate ?? false}
                  link_tool_id={currentDepartmentData?.settings_link_tool_id ?? null}
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
