/**
 * Parameter.tsx
 * Implementation using modular resource components
 * Used to create and manage parameters - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 01/08/2026
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
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Fields } from "@/components/resources/Fields";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveParameterIn = InputOf<"/api/v4/parameters/save", "post">;
type SaveParameterOut = OutputOf<"/api/v4/parameters/save", "post">;
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
type CreateDraftFieldsIn = InputOf<"/api/v4/resources/fields", "post">;
type CreateDraftFieldsOut = OutputOf<"/api/v4/resources/fields", "post">;
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type PatchParameterDraftIn = InputOf<"/api/v4/parameters/draft", "patch">;
type PatchParameterDraftOut = OutputOf<"/api/v4/parameters/draft", "patch">;

type ParameterData = OutputOf<"/api/v4/parameters/get", "post">;

export interface ParameterProps {
  parameterId?: string;
  mode?: "create" | "edit";
  // Server-provided data (for server-side rendering)
  parameterData?: ParameterData;
  // Server actions (replaces useMutation)
  saveParameterAction?: (input: SaveParameterIn) => Promise<SaveParameterOut>;
  patchParameterDraftAction?: (
    input: PatchParameterDraftIn
  ) => Promise<PatchParameterDraftOut>;
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
  createFieldsAction?: (
    input: CreateDraftFieldsIn
  ) => Promise<CreateDraftFieldsOut>;
  createDepartmentsAction?: (
    input: CreateDraftDepartmentsIn
  ) => Promise<CreateDraftDepartmentsOut>;
}

function ParameterComponent({
  parameterId,
  parameterData,
  saveParameterAction,
  patchParameterDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createFlagsAction,
  createFieldsAction,
  createDepartmentsAction,
}: ParameterProps) {
  const router = useRouter();
  const isEditMode = !!parameterId;
  const {
    profile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { setGenerationCapability, clearGenerationCapability } =
    useGenerationContext();

  // Generation state for AI workflows - simplified using ResourceType
  const [generatingResources, setGeneratingResources] = useState<
    Set<ResourceType>
  >(new Set());

  // Modal state for generate/regenerate
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

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  // Memoize to prevent new object reference on every render
  const parameterSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      // Search params (URL-backed, updated via debounced callback in StepCard)
      fieldSearch: parseAsString,
      // Filter params (URL-backed)
      fieldShowSelected: parseAsBoolean,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store parameterData to prevent callback recreation on every render
  const parameterDataRef = React.useRef(parameterData);
  React.useEffect(() => {
    parameterDataRef.current = parameterData;
  }, [parameterData]);

  // Memoize parameterData fields used in renderStep to prevent callback recreation
  // when only object reference changes (but content is same)
  const stableParameterDataFields = React.useMemo(() => {
    if (!parameterData) return null;
    return {
      group_id: parameterData.group_id,
      name_resource: parameterData.name_resource,
      show_name: parameterData.show_name,
      name_suggestions: parameterData.name_suggestions,
      names: parameterData.names,
      name_required: parameterData.name_required,
      name_agent_id: parameterData.name_agent_id,
      description_resource: parameterData.description_resource,
      show_description: parameterData.show_description,
      description_suggestions: parameterData.description_suggestions,
      description_required: parameterData.description_required,
      description_agent_id: parameterData.description_agent_id,
      descriptions: parameterData.descriptions,
      department_resources: parameterData.department_resources,
      show_departments: parameterData.show_departments,
      department_suggestions: parameterData.department_suggestions,
      departments_required: parameterData.departments_required,
      departments_agent_id: parameterData.departments_agent_id,
      departments: parameterData.departments,
      active_flag_resource: parameterData.active_flag_resource,
      show_active_flag: parameterData.show_active_flag,
      active_flag_required: parameterData.active_flag_required,
      active_flag_agent_id: parameterData.active_flag_agent_id,
      field_resources: parameterData.field_resources,
      show_fields: parameterData.show_fields,
      field_suggestions: parameterData.field_suggestions,
      fields_required: parameterData.fields_required,
      fields_agent_id: parameterData.fields_agent_id,
      fields: parameterData.fields,
      simulation_parameter: parameterData.simulation_parameter,
      document_parameter: parameterData.document_parameter,
      persona_parameter: parameterData.persona_parameter,
      scenario_parameter: parameterData.scenario_parameter,
      video_parameter: parameterData.video_parameter,
      active: parameterData.active,
    };
    // Intentionally depend on individual fields, not whole parameterData object
    // to prevent recreation when only object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    parameterData?.group_id,
    parameterData?.name_resource,
    parameterData?.show_name,
    parameterData?.name_suggestions,
    parameterData?.names,
    parameterData?.name_required,
    parameterData?.name_agent_id,
    parameterData?.description_resource,
    parameterData?.show_description,
    parameterData?.description_suggestions,
    parameterData?.description_required,
    parameterData?.description_agent_id,
    parameterData?.descriptions,
    parameterData?.department_resources,
    parameterData?.show_departments,
    parameterData?.department_suggestions,
    parameterData?.departments_required,
    parameterData?.departments_agent_id,
    parameterData?.departments,
    parameterData?.active_flag_resource,
    parameterData?.show_active_flag,
    parameterData?.active_flag_required,
    parameterData?.active_flag_agent_id,
    parameterData?.field_resources,
    parameterData?.show_fields,
    parameterData?.field_suggestions,
    parameterData?.fields_required,
    parameterData?.fields_agent_id,
    parameterData?.fields,
    parameterData?.simulation_parameter,
    parameterData?.document_parameter,
    parameterData?.persona_parameter,
    parameterData?.scenario_parameter,
    parameterData?.video_parameter,
    parameterData?.active,
  ]);

  // Helper to check if a resource type can be regenerated
  // Use stableParameterDataFields to prevent callback recreation when parameterData object reference changes
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!stableParameterDataFields) return false;
      switch (resourceType) {
        case "names":
          return stableParameterDataFields.name_resource?.generated ?? false;
        case "descriptions":
          return (
            stableParameterDataFields.description_resource?.generated ?? false
          );
        case "flags":
          return (
            stableParameterDataFields.active_flag_resource?.generated ?? false
          );
        case "departments":
          return (
            stableParameterDataFields.department_resources?.some(
              (d) => d.generated
            ) ?? false
          );
        case "fields":
          return (
            stableParameterDataFields.field_resources?.some(
              (f) => f.generated
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stableParameterDataFields]
  );

  const getInitialFormState = useCallback(() => {
    const data = parameterDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        active_flag_id: null as string | null,
        department_ids: [] as string[],
        field_ids: [] as string[],
        simulation_parameter: false,
        document_parameter: false,
        persona_parameter: false,
        scenario_parameter: false,
        video_parameter: false,
        active: false,
      };
    }
    // Extract resource IDs from server data
    // Note: Server data may have display values, but we only store IDs here
    return {
      name_id: data.name_id ?? null,
      description_id: data.description_id ?? null,
      active_flag_id: data.active_flag_id ?? null,
      department_ids: data.department_ids ?? [],
      field_ids: data.field_ids ?? [],
      simulation_parameter: data.simulation_parameter ?? false,
      document_parameter: data.document_parameter ?? false,
      persona_parameter: data.persona_parameter ?? false,
      scenario_parameter: data.scenario_parameter ?? false,
      video_parameter: data.video_parameter ?? false,
      active: data.active ?? false,
    };
    // Remove parameterData from dependencies - use ref instead to prevent callback recreation
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies to prevent effect from running when array references change but content is same
  const departmentIdsStr = React.useMemo(
    () => JSON.stringify(parameterData?.department_ids ?? []),
    [parameterData?.department_ids]
  );
  const fieldIdsStr = React.useMemo(
    () => JSON.stringify(parameterData?.field_ids ?? []),
    [parameterData?.field_ids]
  );

  // Memoize stringified formState arrays for draft listener effect dependencies
  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids]
  );
  const formStateFieldIdsStr = React.useMemo(
    () => JSON.stringify(formState.field_ids),
    [formState.field_ids]
  );

  // Update form state when server data changes
  // Use parameterData directly in dependency array, not getInitialFormState
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.field_ids) !== JSON.stringify(newState.field_ids) ||
        prev.simulation_parameter !== newState.simulation_parameter ||
        prev.document_parameter !== newState.document_parameter ||
        prev.persona_parameter !== newState.persona_parameter ||
        prev.scenario_parameter !== newState.scenario_parameter ||
        prev.video_parameter !== newState.video_parameter ||
        prev.active !== newState.active
      ) {
        return newState;
      }
      return prev;
    });
    // Use stringified arrays in dependencies to prevent effect from running when array references change but content is same
    // Intentionally exclude formState and getInitialFormState to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    parameterData?.name_id,
    parameterData?.description_id,
    parameterData?.active_flag_id,
    departmentIdsStr,
    fieldIdsStr,
    parameterData?.simulation_parameter,
    parameterData?.document_parameter,
    parameterData?.persona_parameter,
    parameterData?.scenario_parameter,
    parameterData?.video_parameter,
    parameterData?.active,
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
    parameterData && "draft_version" in parameterData
      ? (parameterData as { draft_version?: number | null }).draft_version
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

  // Use ref to stabilize patchParameterDraftAction to prevent effect recreation when prop reference changes
  const patchParameterDraftActionRef = React.useRef(patchParameterDraftAction);
  React.useEffect(() => {
    patchParameterDraftActionRef.current = patchParameterDraftAction;
  }, [patchParameterDraftAction]);

  // Build a stable key for "what would we patch" - only changes when form data actually changes
  const draftPatchKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftId || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      active_flag_id: formState.active_flag_id,
      simulation_parameter: formState.simulation_parameter,
      document_parameter: formState.document_parameter,
      persona_parameter: formState.persona_parameter,
      scenario_parameter: formState.scenario_parameter,
      video_parameter: formState.video_parameter,
      department_ids: formState.department_ids,
      field_ids: formState.field_ids,
    });
    // Use stringified arrays to prevent recreation when array references change but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formState.active_flag_id,
    formStateDepartmentIdsStr,
    formStateFieldIdsStr,
    formState.simulation_parameter,
    formState.document_parameter,
    formState.persona_parameter,
    formState.scenario_parameter,
    formState.video_parameter,
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
      formState.department_ids.length > 0 ||
      formState.field_ids.length > 0 ||
      formState.simulation_parameter ||
      formState.document_parameter ||
      formState.persona_parameter ||
      formState.scenario_parameter ||
      formState.video_parameter;

    if (!hasResourceIds || !patchParameterDraftActionRef.current) {
      return;
    }

    // ✅ If nothing changed since the last successful patch, do nothing.
    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchParameterDraftActionRef.current) return;
        const result = await patchParameterDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            active_flag_id: formState.active_flag_id,
            simulation_parameter: formState.simulation_parameter,
            document_parameter: formState.document_parameter,
            persona_parameter: formState.persona_parameter,
            scenario_parameter: formState.scenario_parameter,
            video_parameter: formState.video_parameter,
            department_ids: formState.department_ids,
            field_ids: formState.field_ids,
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
    // patchParameterDraftAction and setDraftId are accessed via refs to prevent effect recreation
    // when prop/function references change but functionality is the same
    // We access formState fields and draftId inside the effect, but depend on draftPatchKey
    // to prevent unnecessary effect recreation when individual fields change but payload is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftPatchKey, // ✅ trigger only when payload changes
    // patchParameterDraftAction and setDraftId are accessed via refs
  ]);

  // WebSocket handlers for AI generation - unified handler for all resource types
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Use single group_id from parameterData (no need to track multiple)
    const currentGroupId = parameterData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_id?: string | null;
      description_id?: string | null;
      active_flag_id?: string | null;
      field_ids?: string[];
      department_ids?: string[];
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "parameter" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this parameter or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "fields",
        "departments",
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        // Update formState with the resource ID that was generated
        // Only update the field that matches resource_type (others will be null)
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (data.name_id) updates.name_id = data.name_id;
          if (data.description_id) updates.description_id = data.description_id;
          if (data.active_flag_id) updates.active_flag_id = data.active_flag_id;
          if (data.field_ids && data.field_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newFieldIds = data.field_ids.filter(
              (id) => !prev.field_ids.includes(id)
            );
            updates.field_ids = [...prev.field_ids, ...newFieldIds];
          }
          if (data.department_ids && data.department_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newDeptIds = data.department_ids.filter(
              (id) => !prev.department_ids.includes(id)
            );
            updates.department_ids = [...prev.department_ids, ...newDeptIds];
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
        data.artifact_type !== "parameter" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this parameter or wrong group_id
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
        data.artifact_type !== "parameter" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this parameter or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "fields",
        "departments",
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

    // Listen to parameter-specific events filtered by artifact_type and group_id
    socket.on("parameter_generation_progress", handleGenerationProgress);
    socket.on("parameter_generation_complete", handleGenerationComplete);
    socket.on("parameter_generation_error", handleGenerationError);

    return () => {
      socket.off("parameter_generation_progress", handleGenerationProgress);
      socket.off("parameter_generation_complete", handleGenerationComplete);
      socket.off("parameter_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, parameterData?.group_id]);

  // Multi-generation handler - accepts list of resource types and optional user instructions
  // Helper function to determine agent_type from resource types
  const determineAgentType = useCallback(
    (resourceTypes: ResourceType[]): string | null => {
      const basicResources: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
      ];
      const allResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "fields",
        "departments",
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
        // Single resource type - map to agent_type
        const agentTypeMap: Partial<Record<ResourceType, string>> = {
          names: "name",
          descriptions: "description",
          flags: "flags",
          departments: "departments",
          fields: "fields",
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

      // Set all resources as generating
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      // Read search params from formData
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;
      const fieldSearch =
        (formData["fieldSearch"] as string | undefined) ?? null;
      const fieldShowSelected =
        (formData["fieldShowSelected"] as boolean | undefined) ?? false;

      // Emit parameter_generate event
      socket.emit("parameter_generate", {
        resource_types: resourceTypes, // Simple array of strings
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        // GetParameterApiRequest fields from formData
        draft_id: draftId || null,
        field_search: fieldSearch || null,
        field_show_selected: fieldShowSelected || false,
        mcp: false,
        parameter_id: parameterId || null,
      });
    },
    [socket, isConnected, parameterId]
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

  // GenericForm will manage URL state via nuqs parsers
  // We'll merge formState (resource IDs) with GenericForm's formData (URL params) when needed

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!parameterData) return false;
    return !parameterData.can_edit;
  }, [parameterData]);

  // Set breadcrumb context when parameter data is loaded
  useEffect(() => {
    const parameterName = parameterData?.name_resource?.name;
    if (parameterName && parameterId && isEditMode) {
      setEntityMetadata({
        entityId: parameterId,
        entityName: parameterName,
        entityType: "parameter",
      });
    }
    return () => clearEntityMetadata();
  }, [
    parameterData,
    parameterId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Set generation capability when parameter data is loaded
  // Parameters don't have general_agent_id, so generation is not available
  useEffect(() => {
    setGenerationCapability({
      artifactType: "parameter",
      canGenerate: false,
      agentId: null,
    });
    return () => clearGenerationCapability();
  }, [setGenerationCapability, clearGenerationCapability]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs using {resource}_required flags from parameterData
      if (parameterData?.name_required && !formState.name_id) {
        toast.error("Parameter name is required");
        throw new Error("Parameter name is required");
      }

      if (
        parameterData?.departments_required &&
        (!formState.department_ids || formState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        parameterData?.fields_required &&
        (!formState.field_ids || formState.field_ids.length === 0)
      ) {
        toast.error("Fields are required");
        throw new Error("Fields are required");
      }

      // Ensure profileId exists - required for API calls
      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveParameterAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      // Ensure required fields are present (TypeScript guard)
      if (!formState.name_id) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      // Get name and description text from resources
      // Use ref to get latest parameterData without adding to dependencies
      const currentParameterData = parameterDataRef.current;
      const nameResource =
        currentParameterData?.names?.find(
          (n) => n.name_id === formState.name_id
        ) || currentParameterData?.name_resource;
      const nameText = nameResource?.name || currentParameterData?.name || "";

      const descriptionResource =
        currentParameterData?.descriptions?.find(
          (d) => d.description_id === formState.description_id
        ) || currentParameterData?.description_resource;
      const descriptionText =
        descriptionResource?.description ||
        currentParameterData?.description ||
        "";

      // Build field_connections from field_ids
      // For now, all fields are active and first one is default
      const field_connections = formState.field_ids.map((fieldId, index) => ({
        field_id: fieldId,
        default: index === 0,
        active: true,
      }));

      try {
        await saveParameterAction({
          body: {
            input_parameter_id: isEditMode && parameterId ? parameterId : null,
            name: nameText,
            description: descriptionText,
            active: formState.active,
            simulation_parameter: formState.simulation_parameter,
            document_parameter: formState.document_parameter,
            persona_parameter: formState.persona_parameter,
            scenario_parameter: formState.scenario_parameter,
            video_parameter: formState.video_parameter,
            department_ids: formState.department_ids || [],
            field_connections: field_connections,
          },
        });
        toast.success(
          `Parameter ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/management/parameters");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} parameter: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      formState,
      isEditMode,
      parameterId,
      profile?.id,
      saveParameterAction,
      router,
      parameterData?.name_required,
      parameterData?.departments_required,
      parameterData?.fields_required,
    ]
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName = !!formState.name_id;
      const hasFields = formState.field_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "parameter-config":
          if (!hasName) return "pending";
          return "completed"; // Always completed once basic info is done
        case "fields":
          if (!hasName) return "pending";
          return hasFields ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      fields: ["fields"],
      all: ["names", "descriptions", "departments", "flags", "fields"], // All resources for full-page generation
    }),
    []
  );

  // Resource labels for display
  const resourceLabels: Partial<Record<ResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      flags: "Flags",
      examples: "Examples",
      fields: "Fields",
      departments: "Departments",
    }),
    []
  );

  // Handler to open modal for step card generation
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

  // Handler for modal generate/regenerate action
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

  // Listen for full-page-generate event from layout
  // Parameters don't support full-page generation (no general_agent_id)
  useEffect(() => {
    const handleFullPageGenerate = () => {
      // Parameters don't support full-page generation
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, []);

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the parameter name, description, departments, and active status.",
        resetFields: [
          "name_id",
          "description_id",
          "department_ids",
          "active_flag_id",
        ],
      },
      {
        id: "parameter-config",
        title: "Parameter Configuration",
        description:
          "Configure which parameter types this parameter applies to.",
        resetFields: [
          "simulation_parameter",
          "document_parameter",
          "persona_parameter",
          "scenario_parameter",
          "video_parameter",
        ],
      },
      {
        id: "fields",
        title: "Fields",
        description: "Select fields to include in this parameter.",
        resetFields: ["field_ids", "fieldSearch", "fieldShowSelected"],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "description_id",
      "active_flag_id",
      "department_ids",
      "field_ids",
      "simulation_parameter",
      "document_parameter",
      "persona_parameter",
      "scenario_parameter",
      "video_parameter",
      "active",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "parameter-config":
        return "Parameter configuration reset";
      case "fields":
        return "Fields reset";
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
            department_ids: [],
          };
        case "parameter-config":
          return {
            ...prev,
            simulation_parameter: false,
            document_parameter: false,
            persona_parameter: false,
            scenario_parameter: false,
            video_parameter: false,
          };
        case "fields":
          return {
            ...prev,
            field_ids: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/management/parameters",
      backLabel: "Back",
      createLabel: "Create Parameter",
      updateLabel: "Update Parameter",
    }),
    []
  );

  // Filter onChange callbacks will be created inline in renderStep
  // to have access to setStepFormData

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
      filters?: Array<{
        key: string;
        label: string;
        value: boolean;
        onChange: (value: boolean) => void;
      }>;
      onReset?: () => void;
    }) => {
      // Use memoized fields to avoid dependency on parameterData object reference
      const currentParameterData = stableParameterDataFields;
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
                  name_resource={
                    currentParameterData?.name_resource
                      ? {
                          id: currentParameterData.name_resource.name_id,
                          name: currentParameterData.name_resource.name,
                          generated:
                            currentParameterData.name_resource.generated,
                        }
                      : null
                  }
                  show_name={currentParameterData?.show_name ?? true}
                  name_suggestions={
                    currentParameterData?.name_suggestions ?? []
                  }
                  names={
                    currentParameterData?.names?.map((n) => ({
                      id: n.name_id,
                      name: n.name,
                      generated: n.generated,
                    })) ?? []
                  }
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., Student Age"
                  defaultName="New Parameter"
                  required={currentParameterData?.name_required ?? false}
                  hideDescription={true}
                  group_id={currentParameterData?.group_id ?? null}
                  agent_id={currentParameterData?.name_agent_id ?? null}
                  createNamesAction={
                    createNamesAction as
                      | ((
                          input: CreateDraftNamesIn
                        ) => Promise<CreateDraftNamesOut>)
                      | undefined
                  }
                />
              }
              resetFields={[
                "name_id",
                "description_id",
                "department_ids",
                "active_flag_id",
              ]}
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
                {/* Description field - using Descriptions resource component */}
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    currentParameterData?.description_resource
                      ? {
                          id: currentParameterData.description_resource
                            .description_id,
                          description:
                            currentParameterData.description_resource
                              .description,
                          generated:
                            currentParameterData.description_resource.generated,
                        }
                      : null
                  }
                  show_description={
                    currentParameterData?.show_description ?? true
                  }
                  description_suggestions={
                    currentParameterData?.description_suggestions ?? []
                  }
                  descriptions={
                    currentParameterData?.descriptions?.map((d) => ({
                      id: d.description_id,
                      description: d.description,
                      generated: d.generated,
                    })) ?? []
                  }
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
                  required={currentParameterData?.description_required ?? false}
                  rows={3}
                  data-testid="input-parameter-description"
                  group_id={currentParameterData?.group_id ?? null}
                  agent_id={currentParameterData?.description_agent_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                />

                {/* Department Selection */}
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    currentParameterData?.department_resources ?? []
                  }
                  show_departments={
                    currentParameterData?.show_departments ?? false
                  }
                  department_suggestions={
                    currentParameterData?.department_suggestions ?? []
                  }
                  departments={currentParameterData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  required={currentParameterData?.departments_required ?? false}
                  group_id={currentParameterData?.group_id ?? null}
                  agent_id={currentParameterData?.departments_agent_id ?? null}
                  createDepartmentsAction={createDepartmentsAction}
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={
                    currentParameterData?.active_flag_resource
                      ? {
                          id: currentParameterData.active_flag_resource.flag_id,
                          name: currentParameterData.active_flag_resource.name,
                          description:
                            currentParameterData.active_flag_resource
                              .description,
                          icon_id:
                            currentParameterData.active_flag_resource.icon_id,
                          generated:
                            currentParameterData.active_flag_resource.generated,
                        }
                      : null
                  }
                  show_flag={currentParameterData?.show_active_flag ?? false}
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
                  helpText="Inactive parameters will not be available for selection"
                  required={currentParameterData?.active_flag_required ?? false}
                  group_id={currentParameterData?.group_id ?? null}
                  agent_id={currentParameterData?.active_flag_agent_id ?? null}
                  createFlagsAction={createFlagsAction}
                />
              </div>
            </StepCard>
          );

        case "parameter-config":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={[
                "simulation_parameter",
                "document_parameter",
                "persona_parameter",
                "scenario_parameter",
                "video_parameter",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Simulation Parameter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="simulation_parameter">
                        Simulation Parameter
                      </Label>
                      <Switch
                        id="simulation_parameter"
                        checked={formState.simulation_parameter}
                        onCheckedChange={(checked) => {
                          setFormState((prev) => ({
                            ...prev,
                            simulation_parameter: checked,
                            // Reset child switches when toggling simulation_parameter
                            document_parameter: checked
                              ? false
                              : prev.document_parameter,
                            persona_parameter: checked
                              ? false
                              : prev.persona_parameter,
                            scenario_parameter: checked
                              ? false
                              : prev.scenario_parameter,
                            video_parameter: checked
                              ? false
                              : prev.video_parameter,
                          }));
                        }}
                        disabled={disabled}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable this parameter for simulations
                    </p>
                  </div>

                  {/* Document Parameter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="document_parameter">
                        Document Parameter
                      </Label>
                      <Switch
                        id="document_parameter"
                        checked={formState.document_parameter}
                        onCheckedChange={(checked) =>
                          setFormState((prev) => ({
                            ...prev,
                            document_parameter: checked,
                          }))
                        }
                        disabled={disabled || formState.simulation_parameter}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable this parameter for documents
                    </p>
                  </div>

                  {/* Persona Parameter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="persona_parameter">
                        Persona Parameter
                      </Label>
                      <Switch
                        id="persona_parameter"
                        checked={formState.persona_parameter}
                        onCheckedChange={(checked) =>
                          setFormState((prev) => ({
                            ...prev,
                            persona_parameter: checked,
                          }))
                        }
                        disabled={disabled || formState.simulation_parameter}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable this parameter for personas
                    </p>
                  </div>

                  {/* Scenario Parameter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="scenario_parameter">
                        Scenario Parameter
                      </Label>
                      <Switch
                        id="scenario_parameter"
                        checked={formState.scenario_parameter}
                        onCheckedChange={(checked) =>
                          setFormState((prev) => ({
                            ...prev,
                            scenario_parameter: checked,
                          }))
                        }
                        disabled={disabled || formState.simulation_parameter}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable this parameter for scenarios
                    </p>
                  </div>

                  {/* Video Parameter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="video_parameter">Video Parameter</Label>
                      <Switch
                        id="video_parameter"
                        checked={formState.video_parameter}
                        onCheckedChange={(checked) =>
                          setFormState((prev) => ({
                            ...prev,
                            video_parameter: checked,
                          }))
                        }
                        disabled={disabled || formState.simulation_parameter}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable this parameter for videos
                    </p>
                  </div>
                </div>
              </div>
            </StepCard>
          );

        case "fields": {
          const fieldSearchTerm =
            (stepFormData["fieldSearch"] as string | null | undefined) || "";
          const fieldShowSelected =
            (stepFormData["fieldShowSelected"] as boolean | null | undefined) ??
            false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={fieldSearchTerm}
              onSearchChange={(term: string) =>
                setStepFormData({ fieldSearch: term || null })
              }
              searchPlaceholder="Search fields..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: fieldShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({ fieldShowSelected: value || null }),
                },
              ]}
              resetFields={["field_ids", "fieldSearch", "fieldShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["fields"] &&
                stepResources["fields"].length > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "fields"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "fields",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["fields"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["fields"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["fields"]!.some((rt) =>
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
              <Fields
                field_ids={formState.field_ids ?? []}
                field_resources={currentParameterData?.field_resources ?? []}
                show_fields={currentParameterData?.show_fields ?? false}
                field_suggestions={
                  currentParameterData?.field_suggestions ?? []
                }
                fields={currentParameterData?.fields ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, field_ids: ids }))
                }
                label="Fields"
                required={currentParameterData?.fields_required ?? false}
                group_id={currentParameterData?.group_id ?? null}
                agent_id={currentParameterData?.fields_agent_id ?? null}
                createFieldsAction={createFieldsAction}
                searchTerm={fieldSearchTerm}
                showSelectedFilter={fieldShowSelected}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      stableParameterDataFields,
      formState,
      disabled,
      isEditMode,
      stepResources,
      canRegenerate,
      isGenerating,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateDepartments,
      handleGenerateFlags,
      handleOpenStepCardModal,
      createNamesAction,
      createDescriptionsAction,
      createDepartmentsAction,
      createFlagsAction,
      createFieldsAction,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`parameter-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={parameterData?.disabled_reason ?? null}
          entityType="parameter"
        />

        <GenericForm
          nuqsParsers={
            parameterSearchParamsClient as Record<string, Parser<unknown>>
          }
        steps={steps}
        getStepStatus={getStepStatus}
        serverData={parameterData}
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

        {/* Generate/Regenerate Modal */}
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

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(ParameterComponent, (prevProps, nextProps) => {
  // Compare primitive props
  if (
    prevProps.parameterId !== nextProps.parameterId ||
    prevProps.saveParameterAction !== nextProps.saveParameterAction ||
    prevProps.patchParameterDraftAction !==
      nextProps.patchParameterDraftAction ||
    prevProps.createNamesAction !== nextProps.createNamesAction ||
    prevProps.createDescriptionsAction !== nextProps.createDescriptionsAction ||
    prevProps.createFlagsAction !== nextProps.createFlagsAction ||
    prevProps.createFieldsAction !== nextProps.createFieldsAction ||
    prevProps.createDepartmentsAction !== nextProps.createDepartmentsAction
  ) {
    return false; // Props changed, re-render
  }

  // Compare server props by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.parameterData?.name_id,
    description_id: prevProps.parameterData?.description_id,
    active_flag_id: prevProps.parameterData?.active_flag_id,
    department_ids: prevProps.parameterData?.department_ids,
    field_ids: prevProps.parameterData?.field_ids,
  };
  const nextIds = {
    name_id: nextProps.parameterData?.name_id,
    description_id: nextProps.parameterData?.description_id,
    active_flag_id: nextProps.parameterData?.active_flag_id,
    department_ids: nextProps.parameterData?.department_ids,
    field_ids: nextProps.parameterData?.field_ids,
  };

  if (JSON.stringify(prevIds) !== JSON.stringify(nextIds)) {
    return false; // Content changed, re-render
  }

  // All props are equivalent (same content), skip re-render
  return true;
});
