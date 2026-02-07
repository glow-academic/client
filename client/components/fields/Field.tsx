/**
 * Field.tsx
 * Implementation using modular resource components
 * Used to create and manage fields - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */
"use client";

import { useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { Flags } from "@/components/resources/FlagsLegacy";
import { Names } from "@/components/resources/Names";
import { Parameters } from "@/components/resources/Parameters";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { Loader2, Sparkles } from "lucide-react";
import { parseAsBoolean, parseAsString, useQueryStates, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type GetFieldIn = InputOf<"/api/v4/fields/get", "post">;
type GetFieldOut = OutputOf<"/api/v4/fields/get", "post">;
type SaveFieldIn = InputOf<"/api/v4/fields/save", "post">;
type SaveFieldOut = OutputOf<"/api/v4/fields/save", "post">;
type PatchFieldDraftIn = InputOf<"/api/v4/fields/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/api/v4/fields/draft", "patch">;
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
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftParametersIn = InputOf<"/api/v4/resources/parameters", "post">;
type CreateDraftParametersOut = OutputOf<
  "/api/v4/resources/parameters",
  "post"
>;

type FieldData = GetFieldOut;

export interface FieldProps {
  fieldId?: string;
  fieldData?: FieldData;
  saveFieldAction?: (input: SaveFieldIn) => Promise<SaveFieldOut>;
  patchFieldDraftAction?: (
    input: PatchFieldDraftIn
  ) => Promise<PatchFieldDraftOut>;
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createFlagsAction?: (
    input: CreateDraftFlagsIn
  ) => Promise<CreateDraftFlagsOut>;
  createDepartmentsAction?: (
    input: CreateDraftDepartmentsIn
  ) => Promise<CreateDraftDepartmentsOut>;
  createParametersAction?: (
    input: CreateDraftParametersIn
  ) => Promise<CreateDraftParametersOut>;
}

function FieldComponent({
  fieldId,
  fieldData: serverFieldData,
  saveFieldAction,
  patchFieldDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createFlagsAction,
  createDepartmentsAction,
  createParametersAction,
}: FieldProps) {
  const router = useRouter();
  const isEditMode = !!fieldId;
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

  // Stabilize server props to prevent unnecessary re-renders
  const stabilizeServerProp = React.useCallback(
    (data: typeof serverFieldData): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("field_exists" in data && data.field_exists) {
          return `field_exists:${String(data.field_exists)}`;
        }
        // Use resources.current for stability check
        const current = data.resources?.current;
        const keyFields: Record<string, unknown> = {};
        if (current?.names?.[0]?.id) {
          keyFields["name_id"] = current.names[0].id;
        }
        if (current?.descriptions?.[0]?.id) {
          keyFields["description_id"] = current.descriptions[0].id;
        }
        if (current?.flags?.[0]?.flag_option_id) {
          keyFields["active_flag_id"] = current.flags[0].flag_option_id;
        }
        if (current?.departments && current.departments.length > 0) {
          keyFields["department_ids"] = current.departments
            .map((d) => d.department_id)
            .sort()
            .join(",");
        }
        if (current?.parameters && current.parameters.length > 0) {
          keyFields["parameter_ids"] = current.parameters
            .map((p) => p.parameter_id)
            .sort()
            .join(",");
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

  const fieldDataId = React.useMemo(
    () => stabilizeServerProp(serverFieldData),
    [serverFieldData, stabilizeServerProp]
  );

  // Use refs to track latest server props
  const latestServerFieldDataRef = React.useRef(serverFieldData);
  latestServerFieldDataRef.current = serverFieldData;

  // Use refs to track stable server props
  const stableFieldDataRef = React.useRef<{
    data: typeof serverFieldData;
    id: string | null;
  }>({
    data: serverFieldData,
    id: fieldDataId,
  });

  React.useEffect(() => {
    if (stableFieldDataRef.current.id !== fieldDataId) {
      stableFieldDataRef.current = {
        data: latestServerFieldDataRef.current,
        id: fieldDataId,
      };
    }
  }, [fieldDataId]);

  const fieldData = stableFieldDataRef.current.data;

  // Extract resource data from nested structure for component consumption
  const stableFieldDataFields = useMemo(() => {
    if (!fieldData) return null;
    const current = fieldData.resources?.current;
    const resources = fieldData.resources?.resources;
    return {
      // Name resource
      name_id: current?.names?.[0]?.id ?? null,
      name_resource: current?.names?.[0] ?? null,
      show_name: fieldData.show_name ?? true,
      name_show_ai_generate: fieldData.name_show_ai_generate ?? false,
      name_domain_id: fieldData.name_domain_id ?? null,
      name_required: fieldData.name_required ?? false,
      name_suggestions: fieldData.name_suggestions ?? [],
      names: resources?.names ?? [],
      // Description resource
      description_id: current?.descriptions?.[0]?.id ?? null,
      description_resource: current?.descriptions?.[0] ?? null,
      show_description: fieldData.show_description ?? true,
      description_show_ai_generate: fieldData.description_show_ai_generate ?? false,
      description_domain_id: fieldData.description_domain_id ?? null,
      description_required: fieldData.description_required ?? false,
      description_suggestions: fieldData.description_suggestions ?? [],
      descriptions: resources?.descriptions ?? [],
      // Flag resource
      active_flag_id: current?.flags?.[0]?.flag_option_id ?? null,
      active_flag_resource: current?.flags?.[0] ?? null,
      show_active_flag: fieldData.show_flag ?? false,
      flag_show_ai_generate: fieldData.flag_show_ai_generate ?? false,
      flag_domain_id: fieldData.flag_domain_id ?? null,
      active_flag_required: fieldData.flag_required ?? false,
      // Department resources
      department_ids: current?.departments?.map((d) => d.department_id).filter(Boolean) as string[] ?? [],
      department_resources: current?.departments ?? [],
      show_departments: fieldData.show_departments ?? false,
      departments_show_ai_generate: fieldData.departments_show_ai_generate ?? false,
      departments_domain_id: fieldData.departments_domain_id ?? null,
      departments_required: fieldData.departments_required ?? false,
      department_suggestions: fieldData.department_suggestions ?? [],
      departments: resources?.departments ?? [],
      // Parameter resources
      parameter_ids: current?.parameters?.map((p) => p.parameter_id).filter(Boolean) as string[] ?? [],
      parameter_resources: current?.parameters ?? [],
      show_parameters: fieldData.show_parameters ?? false,
      parameters_show_ai_generate: fieldData.parameters_show_ai_generate ?? false,
      parameters_domain_id: fieldData.parameters_domain_id ?? null,
      parameters_required: fieldData.parameters_required ?? false,
      parameter_suggestions: fieldData.parameter_suggestions ?? [],
      parameters: resources?.parameters ?? [],
      // Group
      group_id: fieldData.group_id ?? null,
      // Domain data for generation
      domain_data: fieldData.domain_data ?? [],
      // Tool IDs for resource components
      name_create_tool_id: fieldData.name_create_tool_id ?? null,
      name_link_tool_id: fieldData.name_link_tool_id ?? null,
      description_create_tool_id: fieldData.description_create_tool_id ?? null,
      description_link_tool_id: fieldData.description_link_tool_id ?? null,
      flag_link_tool_id: fieldData.flag_link_tool_id ?? null,
      departments_link_tool_id: fieldData.departments_link_tool_id ?? null,
      parameters_link_tool_id: fieldData.parameters_link_tool_id ?? null,
    };
  }, [fieldData]);

  // nuqs parsers for URL-backed state
  const fieldSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      descriptionSearch: parseAsString,
      parameterSearch: parseAsString,
      parameterShowSelected: parseAsBoolean,
    }),
    []
  );

  // URL-backed state using nuqs
  const [urlParams] = useQueryStates(fieldSearchParamsClient, {
    history: "replace",
    shallow: true,
  });

  // Get draftId from URL
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

  // Form state - stores only resource IDs
  type FieldFormState = {
    name_id: string | null;
    description_id: string | null;
    active_flag_id: string | null;
    department_ids: string[];
    parameter_ids: string[];
  };

  // Initialize form state from server data
  const initialFormState = useMemo((): FieldFormState => {
    if (!stableFieldDataFields) {
      return {
        name_id: null,
        description_id: null,
        active_flag_id: null,
        department_ids: [],
        parameter_ids: [],
      };
    }

    return {
      name_id: stableFieldDataFields.name_id ?? null,
      description_id: stableFieldDataFields.description_id ?? null,
      active_flag_id: stableFieldDataFields.active_flag_id ?? null,
      department_ids: stableFieldDataFields.department_ids ?? [],
      parameter_ids: stableFieldDataFields.parameter_ids ?? [],
    };
  }, [stableFieldDataFields, fieldDataId]);

  const [formState, setFormState] = useState<FieldFormState>(initialFormState);

  // Track previous initialFormState content
  const prevInitialFormStateRef = useRef<string>(
    JSON.stringify(initialFormState)
  );

  // Update form state when server data changes
  useEffect(() => {
    const currentStateStr = prevInitialFormStateRef.current;
    const newStateStr = JSON.stringify(initialFormState);

    if (currentStateStr !== newStateStr) {
      setFormState(initialFormState);
      prevInitialFormStateRef.current = newStateStr;
    }
  }, [initialFormState]);

  // Form data ref for GenericForm
  const formDataRef = useRef<Record<string, unknown>>({});
  const setUrlFormDataRef = useRef<
    ((updates: Partial<Record<string, unknown>>) => void) | null
  >(null);

  // Sync formState to formDataRef
  useEffect(() => {
    formDataRef.current = {
      ...formState,
      draftId: draftId || null,
    };
  }, [formState, draftId]);

  // Callback to handle form data changes from GenericForm
  const onFormDataChange = useCallback(
    (updates: Partial<Record<string, unknown>>) => {
      const formStateUpdates: Partial<FieldFormState> = {};
      if ("name_id" in updates) {
        formStateUpdates.name_id = updates.name_id as string | null;
      }
      if ("description_id" in updates) {
        formStateUpdates.description_id = updates.description_id as
          | string
          | null;
      }
      if ("active_flag_id" in updates) {
        formStateUpdates.active_flag_id = updates.active_flag_id as
          | string
          | null;
      }
      if ("department_ids" in updates) {
        formStateUpdates.department_ids =
          (updates.department_ids as string[]) ?? [];
      }
      if ("parameter_ids" in updates) {
        formStateUpdates.parameter_ids =
          (updates.parameter_ids as string[]) ?? [];
      }
      if (Object.keys(formStateUpdates).length > 0) {
        setFormState((prev) => ({ ...prev, ...formStateUpdates }));
      }
    },
    []
  );

  // WebSocket handlers for AI generation
  useEffect(() => {
    if (!socket || !isConnected) return;

    const currentGroupId = fieldData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_resource?: { id?: string } | null;
      description_resource?: { id?: string } | null;
      flag_resource?: { flag_option_id?: string } | null;
      department_resources?: Array<{ department_id?: string }> | null;
      parameter_resources?: Array<{ parameter_id?: string }> | null;
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "field" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
        "parameters",
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        // Update formState with the resource ID from full resource objects
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (data.name_resource?.id) updates.name_id = data.name_resource.id;
          if (data.description_resource?.id) updates.description_id = data.description_resource.id;
          if (data.flag_resource?.flag_option_id) updates.active_flag_id = data.flag_resource.flag_option_id;
          if (data.department_resources && data.department_resources.length > 0) {
            const newDeptIds = data.department_resources
              .map((d) => d.department_id)
              .filter((id): id is string => !!id && !prev.department_ids.includes(id));
            if (newDeptIds.length > 0) {
              updates.department_ids = [...prev.department_ids, ...newDeptIds];
            }
          }
          if (data.parameter_resources && data.parameter_resources.length > 0) {
            const newParamIds = data.parameter_resources
              .map((p) => p.parameter_id)
              .filter((id): id is string => !!id && !prev.parameter_ids.includes(id));
            if (newParamIds.length > 0) {
              updates.parameter_ids = [...prev.parameter_ids, ...newParamIds];
            }
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
        data.artifact_type !== "field" ||
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
        data.artifact_type !== "field" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
        "parameters",
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

    socket.on("field_generation_progress", handleGenerationProgress);
    socket.on("field_generation_complete", handleGenerationComplete);
    socket.on("field_generation_error", handleGenerationError);

    return () => {
      socket.off("field_generation_progress", handleGenerationProgress);
      socket.off("field_generation_complete", handleGenerationComplete);
      socket.off("field_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, fieldData?.group_id]);

  // Helper to get domain_ids from resource types
  const getDomainIdsForResources = useCallback(
    (resourceTypes: ResourceType[]): string[] => {
      const currentFieldData = stableFieldDataFields;
      if (!currentFieldData) return [];

      const domainMap: Partial<Record<ResourceType, string | null>> = {
        names: currentFieldData.name_domain_id,
        descriptions: currentFieldData.description_domain_id,
        flags: currentFieldData.flag_domain_id,
        departments: currentFieldData.departments_domain_id,
        parameters: currentFieldData.parameters_domain_id,
      };

      return resourceTypes
        .map((rt) => domainMap[rt])
        .filter((id): id is string => !!id);
    },
    [stableFieldDataFields]
  );

  // Multi-generation handler (domain-based API)
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

      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;
      const domainIds = getDomainIdsForResources(resourceTypes);

      if (domainIds.length === 0) {
        toast.error("No AI generation available for selected resources");
        setGeneratingResources((prev) => {
          const next = new Set(prev);
          resourceTypes.forEach((rt) => next.delete(rt));
          return next;
        });
        return;
      }

      socket.emit("field_generate", {
        domain_ids: domainIds,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        field_id: fieldId || null,
      });
    },
    [socket, isConnected, fieldId, getDomainIdsForResources]
  );

  // Helper function to determine agent_type from resource types (kept for modal compatibility)
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
        "departments",
        "parameters",
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
          descriptions: "description",
          flags: "flags",
          departments: "departments",
          parameters: "parameters",
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

  // Individual generation handlers
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

  const handleGenerateDepartments = useCallback(
    async () =>
      handleGenerateResources(
        ["departments"],
        determineAgentType(["departments"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateParameters = useCallback(
    async () =>
      handleGenerateResources(
        ["parameters"],
        determineAgentType(["parameters"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  // Disabled logic based on can_edit flag
  const disabled = useMemo(() => {
    if (!fieldData) return false;
    return !fieldData.can_edit;
  }, [fieldData]);

  // Set breadcrumb context when field data is loaded
  useEffect(() => {
    const fieldName = stableFieldDataFields?.name_resource?.name;
    if (fieldName && fieldId && isEditMode) {
      setEntityMetadata({
        entityId: fieldId,
        entityName: fieldName,
        entityType: "parameter",
      });
    }
    return () => clearEntityMetadata();
  }, [stableFieldDataFields, fieldId, isEditMode, setEntityMetadata, clearEntityMetadata]);

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      parameters: ["parameters"],
      all: ["names", "descriptions", "departments", "flags", "parameters"],
    }),
    []
  );

  // Resource labels for display
  const resourceLabels: Partial<Record<ResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      flags: "Flags",
      departments: "Departments",
      parameters: "Parameters",
    }),
    []
  );

  // Helper to check if resource can be regenerated
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      const currentFieldData = stableFieldDataFields;
      if (!currentFieldData) return false;

      switch (resourceType) {
        case "names":
          return !!currentFieldData.name_resource?.generated;
        case "descriptions":
          return !!currentFieldData.description_resource?.generated;
        case "flags":
          return !!currentFieldData.active_flag_resource?.generated;
        case "departments":
          return currentFieldData.department_resources.some((d: { generated?: boolean | null }) => d.generated);
        case "parameters":
          return currentFieldData.parameter_resources.some((p: { generated?: boolean | null }) => p.generated);
        default:
          return false;
      }
    },
    [stableFieldDataFields]
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
  useEffect(() => {
    const handleFullPageGenerate = (
      event: CustomEvent<{ agentId?: string }>
    ) => {
      const agentId = event.detail?.agentId;
      if (agentId) {
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener(
      "full-page-generate",
      handleFullPageGenerate as EventListener
    );
    return () =>
      window.removeEventListener(
        "full-page-generate",
        handleFullPageGenerate as EventListener
      );
  }, [handleOpenStepCardModal]);

  // Steps configuration
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the field name, description, departments, and active status.",
        resetFields: [
          "name_id",
          "description_id",
          "department_ids",
          "active_flag_id",
        ],
      },
      {
        id: "parameters",
        title: "Conditional Parameters",
        description: "Select parameters to show when this field is selected.",
        resetFields: ["parameter_ids"],
      },
    ],
    []
  );

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "parameters":
          if (!hasName) return "pending";
          return formState.parameter_ids.length > 0 ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // Submit handler
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs
      if (fieldData?.name_required && !formState.name_id) {
        toast.error("Field name is required");
        throw new Error("Field name is required");
      }

      if (
        fieldData?.departments_required &&
        (!formState.department_ids || formState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        fieldData?.parameters_required &&
        (!formState.parameter_ids || formState.parameter_ids.length === 0)
      ) {
        toast.error("Parameters are required");
        throw new Error("Parameters are required");
      }

      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveFieldAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      if (!formState.name_id) {
        toast.error("Name is required");
        throw new Error("Name is required");
      }

      if (!fieldData?.group_id) {
        toast.error("Group ID is missing. Please refresh the page.");
        throw new Error("Group ID is required");
      }

      try {
        await saveFieldAction({
          body: {
            group_id: fieldData.group_id,
            name_id: formState.name_id,
            description_id: formState.description_id || null,
            active_flag_id: formState.active_flag_id || null,
            department_ids: formState.department_ids || [],
            parameter_ids: formState.parameter_ids || [],
            input_field_id: isEditMode && fieldId ? fieldId : null,
          },
        });
        toast.success(
          `Field ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/management/fields");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} field: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      formState,
      isEditMode,
      fieldId,
      profile?.id,
      saveFieldAction,
      router,
      fieldData?.name_required,
      fieldData?.departments_required,
      fieldData?.parameters_required,
      fieldData?.group_id,
    ]
  );

  // Memoize formFieldKeys
  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "description_id",
      "active_flag_id",
      "department_ids",
      "parameter_ids",
    ],
    []
  );

  // Memoize resetSuccessMessage
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "parameters":
        return "Conditional parameters reset";
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
        case "parameters":
          return {
            ...prev,
            parameter_ids: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  // Memoize submitButton
  const submitButton = useMemo(
    () => ({
      backUrl: "/management/fields",
      backLabel: "Back",
      createLabel: "Create Field",
      updateLabel: "Update Field",
    }),
    []
  );

  // Check if any resources have AI generation available for step actions
  const hasAiGenerate = useCallback(
    (resourceTypes: ResourceType[]): boolean => {
      const currentFieldData = stableFieldDataFields;
      if (!currentFieldData) return false;

      const aiMap: Partial<Record<ResourceType, boolean>> = {
        names: currentFieldData.name_show_ai_generate,
        descriptions: currentFieldData.description_show_ai_generate,
        flags: currentFieldData.flag_show_ai_generate,
        departments: currentFieldData.departments_show_ai_generate,
        parameters: currentFieldData.parameters_show_ai_generate,
      };

      return resourceTypes.some((rt) => aiMap[rt]);
    },
    [stableFieldDataFields]
  );

  // Memoize renderStep
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
      const currentFieldData = stableFieldDataFields;
      switch (stepId) {
        case "basic":
          const descriptionSearchTerm =
            (stepFormData["descriptionSearch"] as string | null | undefined) ||
            "";
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
                  name_resource={currentFieldData?.name_resource ?? null}
                  show_name={currentFieldData?.show_name ?? true}
                  name_suggestions={currentFieldData?.name_suggestions ?? []}
                  names={currentFieldData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., Course Level"
                  defaultName="New Field"
                  required={currentFieldData?.name_required ?? false}
                  hideDescription={true}
                  group_id={currentFieldData?.group_id ?? null}
                  create_tool_id={currentFieldData?.name_create_tool_id ?? null}
                  link_tool_id={currentFieldData?.name_link_tool_id ?? null}
                  showAiGenerate={currentFieldData?.name_show_ai_generate ?? false}
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
                "descriptionSearch",
                "department_ids",
                "active_flag_id",
              ]}
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                hasAiGenerate(stepResources["basic"]!) ? (
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
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    currentFieldData?.description_resource ?? null
                  }
                  show_description={currentFieldData?.show_description ?? true}
                  description_suggestions={
                    currentFieldData?.description_suggestions ?? []
                  }
                  descriptions={currentFieldData?.descriptions ?? []}
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
                  required={currentFieldData?.description_required ?? false}
                  rows={3}
                  data-testid="input-field-description"
                  group_id={currentFieldData?.group_id ?? null}
                  create_tool_id={currentFieldData?.description_create_tool_id ?? null}
                  link_tool_id={currentFieldData?.description_link_tool_id ?? null}
                  showAiGenerate={currentFieldData?.description_show_ai_generate ?? false}
                  createDescriptionsAction={createDescriptionsAction}
                  searchTerm={descriptionSearchTerm}
                  onSearchChange={(term: string) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                />

                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    currentFieldData?.department_resources ?? []
                  }
                  show_departments={currentFieldData?.show_departments ?? false}
                  department_suggestions={
                    currentFieldData?.department_suggestions ?? []
                  }
                  departments={currentFieldData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  required={currentFieldData?.departments_required ?? false}
                  group_id={currentFieldData?.group_id ?? null}
                  link_tool_id={currentFieldData?.departments_link_tool_id ?? null}
                  showAiGenerate={currentFieldData?.departments_show_ai_generate ?? false}
                  createDepartmentsAction={createDepartmentsAction}
                />

                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={
                    currentFieldData?.active_flag_resource
                      ? {
                          id: currentFieldData.active_flag_resource.flag_option_id ?? null,
                          name: currentFieldData.active_flag_resource.label ?? null,
                          description: currentFieldData.active_flag_resource.description ?? null,
                          icon: currentFieldData.active_flag_resource.icon_id ?? null,
                          generated: currentFieldData.active_flag_resource.generated ?? null,
                        }
                      : null
                  }
                  show_flag={currentFieldData?.show_active_flag ?? false}
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
                  helpText="Inactive fields will not be available for selection"
                  required={currentFieldData?.active_flag_required ?? false}
                  group_id={currentFieldData?.group_id ?? null}
                  link_tool_id={currentFieldData?.flag_link_tool_id ?? null}
                  showAiGenerate={currentFieldData?.flag_show_ai_generate ?? false}
                />
              </div>
            </StepCard>
          );

        case "parameters":
          const parameterSearchTerm =
            (stepFormData["parameterSearch"] as string | null | undefined) ||
            "";
          const parameterShowSelected =
            (stepFormData["parameterShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={parameterSearchTerm}
              onSearchChange={(term: string) =>
                setStepFormData({ parameterSearch: term || null })
              }
              searchPlaceholder="Search parameters..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: parameterShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({
                      parameterShowSelected: value || null,
                    }),
                },
              ]}
              resetFields={[
                "parameter_ids",
                "parameterSearch",
                "parameterShowSelected",
              ]}
              actions={
                stepResources["parameters"] &&
                stepResources["parameters"].length > 0 &&
                hasAiGenerate(stepResources["parameters"]!) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "parameters"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "parameters",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["parameters"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["parameters"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["parameters"]!.some((rt) =>
                          canRegenerate(rt)
                        )
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
              <Parameters
                parameter_ids={formState.parameter_ids ?? []}
                parameter_resources={
                  currentFieldData?.parameter_resources ?? []
                }
                show_parameters={currentFieldData?.show_parameters ?? false}
                parameter_suggestions={
                  currentFieldData?.parameter_suggestions ?? []
                }
                parameters={currentFieldData?.parameters ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, parameter_ids: ids }))
                }
                label="Conditional Parameters"
                required={currentFieldData?.parameters_required ?? false}
                group_id={currentFieldData?.group_id ?? null}
                link_tool_id={currentFieldData?.parameters_link_tool_id ?? null}
                showAiGenerate={currentFieldData?.parameters_show_ai_generate ?? false}
                createParametersAction={createParametersAction}
                onGenerate={handleGenerateParameters}
                isGenerating={isGenerating("parameters")}
                searchTerm={parameterSearchTerm}
                showSelectedFilter={parameterShowSelected}
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      disabled,
      isEditMode,
      formState,
      stableFieldDataFields,
      stepResources,
      canRegenerate,
      isGenerating,
      hasAiGenerate,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateDepartments,
      handleGenerateFlags,
      handleGenerateParameters,
      handleOpenStepCardModal,
      createNamesAction,
      createDescriptionsAction,
      createDepartmentsAction,
      createFlagsAction,
      createParametersAction,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`field-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={fieldData?.disabled_reason ?? null}
          entityType="field"
        />

        <GenericForm
        nuqsParsers={
          fieldSearchParamsClient as Record<string, Parser<unknown>>
        }
        steps={steps}
        getStepStatus={getStepStatus}
        serverData={fieldData}
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

// Memoize component to prevent re-renders when only prop references change
export default React.memo(FieldComponent, (prevProps, nextProps) => {
  const prevCurrent = prevProps.fieldData?.resources?.current;
  const nextCurrent = nextProps.fieldData?.resources?.current;
  const prevIds = {
    name_id: prevCurrent?.names?.[0]?.id,
    description_id: prevCurrent?.descriptions?.[0]?.id,
    active_flag_id: prevCurrent?.flags?.[0]?.flag_option_id,
    department_ids: prevCurrent?.departments?.map((d) => d.department_id),
    parameter_ids: prevCurrent?.parameters?.map((p) => p.parameter_id),
  };
  const nextIds = {
    name_id: nextCurrent?.names?.[0]?.id,
    description_id: nextCurrent?.descriptions?.[0]?.id,
    active_flag_id: nextCurrent?.flags?.[0]?.flag_option_id,
    department_ids: nextCurrent?.departments?.map((d) => d.department_id),
    parameter_ids: nextCurrent?.parameters?.map((p) => p.parameter_id),
  };

  if (
    prevProps.fieldId !== nextProps.fieldId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false;
  }

  return true;
});
