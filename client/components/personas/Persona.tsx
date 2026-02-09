/**
 * Persona.tsx
 * Implementation using modular resource components
 * Used to create and manage personas - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 01/08/2026
 */
"use client";

import { useRouter } from "next/navigation";
import React, {
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
import { StepCard } from "@/components/common/forms/StepCard";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Colors } from "@/components/resources/Colors";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Examples } from "@/components/resources/Examples";
import { Flags } from "@/components/resources/Flags";
import { Icons } from "@/components/resources/Icons";
import { Instructions } from "@/components/resources/Instructions";
import { Names } from "@/components/resources/Names";
import { ParameterFields } from "@/components/resources/ParameterFields";
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
import { useSaveContext } from "@/contexts/save-context";
import { useAiGeneration } from "@/hooks/use-ai-generation";
import { useConditionalParameterToggle } from "@/hooks/use-conditional-parameter-toggle";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import type { ServerToClientEvents } from "@/lib/ws/types";
import { Loader2, Sparkles } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Socket event types (auto-generated from server)
type PersonaGenerationCompletePayload = Parameters<
  ServerToClientEvents["persona_generation_complete"]
>[0];

// Types defined inline using InputOf/OutputOf
type SavePersonaIn = InputOf<"/api/v4/artifacts/personas/save", "post">;
type SavePersonaOut = OutputOf<"/api/v4/artifacts/personas/save", "post">;
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
type CreateDraftColorsIn = InputOf<"/api/v4/resources/colors", "post">;
type CreateDraftColorsOut = OutputOf<"/api/v4/resources/colors", "post">;
type CreateDraftInstructionsIn = InputOf<
  "/api/v4/resources/instructions",
  "post"
>;
type CreateDraftInstructionsOut = OutputOf<
  "/api/v4/resources/instructions",
  "post"
>;
type CreateDraftExamplesIn = InputOf<"/api/v4/resources/examples", "post">;
type CreateDraftExamplesOut = OutputOf<"/api/v4/resources/examples", "post">;
type CreateDraftParameterFieldsIn = InputOf<
  "/api/v4/resources/parameter_fields",
  "post"
>;
type CreateDraftParameterFieldsOut = OutputOf<
  "/api/v4/resources/parameter_fields",
  "post"
>;
type PatchPersonaDraftIn = InputOf<"/api/v4/artifacts/personas/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<"/api/v4/artifacts/personas/draft", "patch">;

type PersonaData = OutputOf<"/api/v4/artifacts/personas/get", "post">;

// Type for flush results - each resource returns its created ID(s)
type FlushResult = {
  name_id?: string | null;
  description_id?: string | null;
  color_id?: string | null;
  instructions_id?: string | null;
  example_ids?: string[];
  parameter_field_ids?: string[];
};

// AI form data shape for persona generation
type PersonaAiFormData = {
  name_resource?: PersonaGenerationCompletePayload["name_resource"];
  description_resource?: PersonaGenerationCompletePayload["description_resource"];
  color_resource?: PersonaGenerationCompletePayload["color_resource"];
  icon_resource?: PersonaGenerationCompletePayload["icon_resource"];
  instructions_resource?: PersonaGenerationCompletePayload["instructions_resource"];
  flag_resource?: PersonaGenerationCompletePayload["flag_resource"];
  department_resources?: PersonaGenerationCompletePayload["department_resources"];
  parameter_field_resources?: PersonaGenerationCompletePayload["parameter_field_resources"];
  example_resources?: PersonaGenerationCompletePayload["example_resources"];
  parameter_resources?: PersonaGenerationCompletePayload["parameter_resources"];
};

type PersonaFormState = {
  name_id: string | null;
  description_id: string | null;
  color_id: string | null;
  icon_id: string | null;
  instructions_id: string | null;
  active_flag_id: string | null;
  department_ids: string[];
  parameter_field_ids: string[];
  example_ids: string[];
  parameter_ids: string[];
};

export interface PersonaProps {
  personaId?: string;
  // Server-provided data (for server-side rendering)
  personaData?: PersonaData;
  // Server actions (replaces useMutation)
  savePersonaAction?: (input: SavePersonaIn) => Promise<SavePersonaOut>;
  patchPersonaDraftAction?: (
    input: PatchPersonaDraftIn
  ) => Promise<PatchPersonaDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createColorsAction?: (
    input: CreateDraftColorsIn
  ) => Promise<CreateDraftColorsOut>;
  createInstructionsAction?: (
    input: CreateDraftInstructionsIn
  ) => Promise<CreateDraftInstructionsOut>;
  createExamplesAction?: (
    input: CreateDraftExamplesIn
  ) => Promise<CreateDraftExamplesOut>;
  createParameterFieldsAction?: (
    input: CreateDraftParameterFieldsIn
  ) => Promise<CreateDraftParameterFieldsOut>;
}

const FLUSH_KEYS = [
  "names",
  "descriptions",
  "instructions",
  "examples",
  "colors",
  "parameter_fields",
] as const;

const VALID_RESOURCE_TYPES: ResourceType[] = [
  "names",
  "descriptions",
  "colors",
  "icons",
  "instructions",
  "flags",
  "examples",
  "parameter_fields",
  "departments",
  "parameters",
];

function PersonaComponent({
  personaId,
  personaData,
  savePersonaAction,
  patchPersonaDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createColorsAction,
  createInstructionsAction,
  createExamplesAction,
  createParameterFieldsAction,
}: PersonaProps) {
  const router = useRouter();
  const isEditMode = !!personaId;
  const { profile, setSelectedDraftId, socket, isConnected } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { isAutosaveEnabled } = useSaveContext();

  // --- Flush Registry ---
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<FlushResult>(FLUSH_KEYS);

  // --- AI Generation ---
  const onAiComplete = useCallback(
    (data: Record<string, unknown>) => {
      const aiUpdates: Partial<PersonaAiFormData> = {};
      if (data["name_resource"]) aiUpdates.name_resource = data["name_resource"] as PersonaAiFormData["name_resource"];
      if (data["description_resource"]) aiUpdates.description_resource = data["description_resource"] as PersonaAiFormData["description_resource"];
      if (data["color_resource"]) aiUpdates.color_resource = data["color_resource"] as PersonaAiFormData["color_resource"];
      if (data["icon_resource"]) aiUpdates.icon_resource = data["icon_resource"] as PersonaAiFormData["icon_resource"];
      if (data["instructions_resource"]) aiUpdates.instructions_resource = data["instructions_resource"] as PersonaAiFormData["instructions_resource"];
      if (data["flag_resource"]) aiUpdates.flag_resource = data["flag_resource"] as PersonaAiFormData["flag_resource"];
      if (data["department_resources"]) aiUpdates.department_resources = data["department_resources"] as PersonaAiFormData["department_resources"];
      if (data["parameter_field_resources"]) aiUpdates.parameter_field_resources = data["parameter_field_resources"] as PersonaAiFormData["parameter_field_resources"];
      if (data["example_resources"]) aiUpdates.example_resources = data["example_resources"] as PersonaAiFormData["example_resources"];
      if (data["parameter_resources"]) aiUpdates.parameter_resources = data["parameter_resources"] as PersonaAiFormData["parameter_resources"];

      // Only name_resource auto-accepts (Names.tsx already implements diff workflow)
      const formStateUpdates: Record<string, unknown> = {};
      const nameRes = data["name_resource"] as { id?: string } | undefined;
      if (nameRes?.id) formStateUpdates["name_id"] = nameRes.id;

      return { aiUpdates, formStateUpdates };
    },
    []
  );

  const {
    setGeneratingResources,
    isGenerating,
    aiFormData,
    clearAiResource,
  } = useAiGeneration<ResourceType, PersonaAiFormData>({
    socket,
    isConnected,
    artifactType: "persona",
    groupId: personaData?.group_id,
    eventPrefix: "persona_generation",
    validResourceTypes: VALID_RESOURCE_TYPES,
    onComplete: onAiComplete,
  });

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  const personaSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      colorSearch: parseAsString,
      iconSearch: parseAsString,
      descriptionSearch: parseAsString,
      instructionsSearch: parseAsString,
      parameterSearch: parseAsString,
      colorShowSelected: parseAsBoolean,
      iconShowSelected: parseAsBoolean,
      parameterShowSelected: parseAsBoolean,
    }),
    []
  );

  // --- Form State ---
  const personaDataRef = React.useRef(personaData);
  React.useEffect(() => {
    personaDataRef.current = personaData;
  }, [personaData]);

  const stablePersonaDataFields = React.useMemo(() => {
    if (!personaData) return null;
    const resources = personaData.resources?.resources;
    const current = personaData.resources?.current;
    return {
      group_id: personaData.group_id,
      name_resource: current?.names?.[0] ?? null,
      show_name: personaData.show_name,
      name_suggestions: personaData.name_suggestions,
      names: resources?.names ?? [],
      name_required: personaData.name_required,
      name_show_ai_generate: personaData.name_show_ai_generate,
      description_resource: current?.descriptions?.[0] ?? null,
      show_description: personaData.show_description,
      description_suggestions: personaData.description_suggestions,
      description_required: personaData.description_required,
      description_show_ai_generate: personaData.description_show_ai_generate,
      descriptions: resources?.descriptions ?? [],
      department_resources: current?.departments ?? [],
      show_departments: personaData.show_departments,
      department_suggestions: personaData.department_suggestions,
      departments_required: personaData.departments_required,
      departments_show_ai_generate: personaData.departments_show_ai_generate,
      departments: resources?.departments ?? [],
      flags: resources?.flags ?? [],
      show_flag: personaData.show_flag,
      flag_show_ai_generate: personaData.flag_show_ai_generate,
      parameter_field_resources: current?.parameter_fields ?? [],
      show_parameter_fields: personaData.show_parameter_fields,
      parameter_field_suggestions: personaData.parameter_field_suggestions,
      parameter_fields_required: personaData.parameter_fields_required,
      parameter_fields_show_ai_generate: personaData.parameter_fields_show_ai_generate,
      parameter_fields: resources?.parameter_fields ?? [],
      color_resource: current?.colors?.[0] ?? null,
      show_color: personaData.show_color,
      color_suggestions: personaData.color_suggestions,
      color_required: personaData.color_required,
      color_show_ai_generate: personaData.color_show_ai_generate,
      colors: resources?.colors ?? [],
      icon_resource: current?.icons?.[0] ?? null,
      show_icon: personaData.show_icon,
      icon_suggestions: personaData.icon_suggestions,
      icon_required: personaData.icon_required,
      icon_show_ai_generate: personaData.icon_show_ai_generate,
      icons: resources?.icons ?? [],
      instructions_resource: current?.instructions?.[0] ?? null,
      show_instructions: personaData.show_instructions,
      instructions_suggestions: personaData.instructions_suggestions,
      instructions_required: personaData.instructions_required,
      instructions_show_ai_generate: personaData.instructions_show_ai_generate,
      instructions: resources?.instructions ?? [],
      example_resources: current?.examples ?? [],
      show_examples: personaData.show_examples,
      example_suggestions: personaData.example_suggestions,
      examples_required: personaData.examples_required,
      examples_show_ai_generate: personaData.examples_show_ai_generate,
      examples: resources?.examples ?? [],
      parameter_resources: current?.parameters ?? [],
      show_parameters: personaData.show_parameters,
      parameter_suggestions: personaData.parameter_suggestions,
      parameters_required: personaData.parameters_required,
      parameters_show_ai_generate: personaData.parameters_show_ai_generate,
      parameters: resources?.parameters ?? [],
      basic_show_ai_generate: personaData.basic_show_ai_generate,
      content_show_ai_generate: personaData.content_show_ai_generate,
      parameters_step_show_ai_generate: personaData.parameters_step_show_ai_generate,
      names_group_id: personaData.names_group_id,
      descriptions_group_id: personaData.descriptions_group_id,
      colors_group_id: personaData.colors_group_id,
      icons_group_id: personaData.icons_group_id,
      instructions_group_id: personaData.instructions_group_id,
      flags_group_id: personaData.flags_group_id,
      departments_group_id: personaData.departments_group_id,
      parameter_fields_group_id: personaData.parameter_fields_group_id,
      examples_group_id: personaData.examples_group_id,
      parameters_group_id: personaData.parameters_group_id,
      name_create_tool_id: personaData.name_create_tool_id,
      description_create_tool_id: personaData.description_create_tool_id,
      color_create_tool_id: personaData.color_create_tool_id,
      instructions_create_tool_id: personaData.instructions_create_tool_id,
      parameter_fields_create_tool_id: personaData.parameter_fields_create_tool_id,
      examples_create_tool_id: personaData.examples_create_tool_id,
      name_link_tool_id: personaData.name_link_tool_id,
      description_link_tool_id: personaData.description_link_tool_id,
      color_link_tool_id: personaData.color_link_tool_id,
      icon_link_tool_id: personaData.icon_link_tool_id,
      instructions_link_tool_id: personaData.instructions_link_tool_id,
      flag_link_tool_id: personaData.flag_link_tool_id,
      departments_link_tool_id: personaData.departments_link_tool_id,
      parameter_fields_link_tool_id: personaData.parameter_fields_link_tool_id,
      examples_link_tool_id: personaData.examples_link_tool_id,
      parameters_link_tool_id: personaData.parameters_link_tool_id,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    personaData?.group_id,
    personaData?.resources,
    personaData?.show_name,
    personaData?.name_suggestions,
    personaData?.name_required,
    personaData?.name_show_ai_generate,
    personaData?.show_description,
    personaData?.description_suggestions,
    personaData?.description_required,
    personaData?.description_show_ai_generate,
    personaData?.show_departments,
    personaData?.department_suggestions,
    personaData?.departments_required,
    personaData?.departments_show_ai_generate,
    personaData?.show_flag,
    personaData?.flag_show_ai_generate,
    personaData?.show_parameter_fields,
    personaData?.parameter_field_suggestions,
    personaData?.parameter_fields_required,
    personaData?.parameter_fields_show_ai_generate,
    personaData?.show_color,
    personaData?.color_suggestions,
    personaData?.color_required,
    personaData?.color_show_ai_generate,
    personaData?.show_icon,
    personaData?.icon_suggestions,
    personaData?.icon_required,
    personaData?.icon_show_ai_generate,
    personaData?.show_instructions,
    personaData?.instructions_suggestions,
    personaData?.instructions_required,
    personaData?.instructions_show_ai_generate,
    personaData?.show_examples,
    personaData?.example_suggestions,
    personaData?.examples_required,
    personaData?.examples_show_ai_generate,
    personaData?.show_parameters,
    personaData?.parameter_suggestions,
    personaData?.parameters_required,
    personaData?.parameters_show_ai_generate,
    personaData?.basic_show_ai_generate,
    personaData?.content_show_ai_generate,
    personaData?.parameters_step_show_ai_generate,
    personaData?.names_group_id,
    personaData?.descriptions_group_id,
    personaData?.colors_group_id,
    personaData?.icons_group_id,
    personaData?.instructions_group_id,
    personaData?.flags_group_id,
    personaData?.departments_group_id,
    personaData?.parameter_fields_group_id,
    personaData?.examples_group_id,
    personaData?.parameters_group_id,
    personaData?.name_create_tool_id,
    personaData?.description_create_tool_id,
    personaData?.color_create_tool_id,
    personaData?.instructions_create_tool_id,
    personaData?.parameter_fields_create_tool_id,
    personaData?.examples_create_tool_id,
    personaData?.name_link_tool_id,
    personaData?.description_link_tool_id,
    personaData?.color_link_tool_id,
    personaData?.icon_link_tool_id,
    personaData?.instructions_link_tool_id,
    personaData?.flag_link_tool_id,
    personaData?.departments_link_tool_id,
    personaData?.parameter_fields_link_tool_id,
    personaData?.examples_link_tool_id,
    personaData?.parameters_link_tool_id,
  ]);

  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!stablePersonaDataFields) return false;
      switch (resourceType) {
        case "names":
          return stablePersonaDataFields.name_resource?.generated ?? false;
        case "descriptions":
          return stablePersonaDataFields.description_resource?.generated ?? false;
        case "colors":
          return stablePersonaDataFields.color_resource?.generated ?? false;
        case "icons":
          return stablePersonaDataFields.icon_resource?.generated ?? false;
        case "instructions":
          return stablePersonaDataFields.instructions_resource?.generated ?? false;
        case "flags":
          return stablePersonaDataFields.flags?.[0]?.generated ?? false;
        case "departments":
          return stablePersonaDataFields.department_resources?.some((d) => d.generated) ?? false;
        case "parameter_fields":
          return stablePersonaDataFields.parameter_field_resources?.some((f) => f.generated) ?? false;
        case "examples":
          return stablePersonaDataFields.example_resources?.some((e) => e.generated) ?? false;
        default:
          return false;
      }
    },
    [stablePersonaDataFields]
  );

  const getInitialFormState = useCallback((): PersonaFormState => {
    const data = personaDataRef.current;
    if (!data) {
      return {
        name_id: null,
        description_id: null,
        color_id: null,
        icon_id: null,
        instructions_id: null,
        active_flag_id: null,
        department_ids: [],
        parameter_field_ids: [],
        example_ids: [],
        parameter_ids: [],
      };
    }

    const resources = data.resources?.resources;
    const current = data.resources?.current;

    const currentParameterIds = (current?.parameters ?? [])
      .map((p) => p.parameter_id)
      .filter(Boolean) as string[];
    const paramIdsSet = new Set<string>(currentParameterIds);
    const availableFields = resources?.parameter_fields ?? [];

    if (current?.parameter_fields && current.parameter_fields.length > 0) {
      current.parameter_fields.forEach((fieldResource) => {
        if (fieldResource.parameter_id) {
          paramIdsSet.add(fieldResource.parameter_id);
        }
        const availableField = availableFields.find(
          (f) => f.field_id === fieldResource.field_id
        );
        if (availableField?.conditional_parameter_id) {
          paramIdsSet.add(availableField.conditional_parameter_id);
        }
      });
    }

    return {
      name_id: current?.names?.[0]?.id ?? null,
      description_id: current?.descriptions?.[0]?.id ?? null,
      color_id: current?.colors?.[0]?.id ?? null,
      icon_id: current?.icons?.[0]?.id ?? null,
      instructions_id: current?.instructions?.[0]?.id ?? null,
      active_flag_id: current?.flags?.[0]?.flag_option_id ?? null,
      department_ids: (current?.departments ?? [])
        .map((d) => d.department_id)
        .filter(Boolean) as string[],
      parameter_field_ids: (current?.parameter_fields ?? [])
        .map((f) => f.field_id)
        .filter(Boolean) as string[],
      example_ids: (current?.examples ?? [])
        .map((e) => e.id)
        .filter(Boolean) as string[],
      parameter_ids: Array.from(paramIdsSet),
    };
  }, []);

  const [formState, setFormState] = useState<PersonaFormState>(getInitialFormState);
  const formStateRef = React.useRef<Record<string, unknown>>(formState as unknown as Record<string, unknown>);
  React.useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  // Auto-accept name from AI generation
  const aiNameResource = aiFormData.name_resource;
  React.useEffect(() => {
    if (aiNameResource?.id) {
      setFormState((prev) => ({
        ...prev,
        name_id: aiNameResource.id!,
      }));
    }
  }, [aiNameResource]);

  // Memoize stringified array dependencies
  const departmentIdsStr = React.useMemo(() => {
    const current = personaData?.resources?.current;
    return JSON.stringify(
      (current?.departments ?? []).map((d) => d.department_id).filter(Boolean)
    );
  }, [personaData?.resources]);
  const parameterFieldIdsStr = React.useMemo(() => {
    const current = personaData?.resources?.current;
    return JSON.stringify(
      (current?.parameter_fields ?? []).map((f) => f.field_id).filter(Boolean)
    );
  }, [personaData?.resources]);
  const exampleIdsStr = React.useMemo(() => {
    const current = personaData?.resources?.current;
    return JSON.stringify(
      (current?.examples ?? []).map((e) => e.id).filter(Boolean)
    );
  }, [personaData?.resources]);
  const parameterIdsStr = React.useMemo(() => {
    const current = personaData?.resources?.current;
    return JSON.stringify(
      (current?.parameters ?? []).map((p) => p.parameter_id).filter(Boolean)
    );
  }, [personaData?.resources]);

  // Update form state when server data changes
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.color_id !== newState.color_id ||
        prev.icon_id !== newState.icon_id ||
        prev.instructions_id !== newState.instructions_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        JSON.stringify(prev.department_ids) !== JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.parameter_field_ids) !== JSON.stringify(newState.parameter_field_ids) ||
        JSON.stringify(prev.example_ids) !== JSON.stringify(newState.example_ids) ||
        JSON.stringify(prev.parameter_ids) !== JSON.stringify(newState.parameter_ids)
      ) {
        serverSyncPendingRef.current = true;
        return newState;
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    personaData?.resources,
    departmentIdsStr,
    parameterFieldIdsStr,
    exampleIdsStr,
    parameterIdsStr,
  ]);

  // --- Draft Lifecycle ---
  const patchPersonaDraftActionRef = React.useRef(patchPersonaDraftAction);
  React.useEffect(() => {
    patchPersonaDraftActionRef.current = patchPersonaDraftAction;
  }, [patchPersonaDraftAction]);

  // Stable ref wrapper for patch action
  const patchActionRef = React.useRef<
    ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null; new_version?: number | null }>) | undefined
  >(undefined);
  React.useEffect(() => {
    if (patchPersonaDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        return await patchPersonaDraftAction({ body: payload } as PatchPersonaDraftIn);
      };
    } else {
      patchActionRef.current = undefined;
    }
  }, [patchPersonaDraftAction]);

  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids]
  );
  const formStateParameterFieldIdsStr = React.useMemo(
    () => JSON.stringify(formState.parameter_field_ids),
    [formState.parameter_field_ids]
  );
  const formStateExampleIdsStr = React.useMemo(
    () => JSON.stringify(formState.example_ids),
    [formState.example_ids]
  );
  const formStateParameterIdsStr = React.useMemo(
    () => JSON.stringify(formState.parameter_ids),
    [formState.parameter_ids]
  );

  // formStateKey excludes draftId — the hook prepends it
  const formStateKey = React.useMemo(
    () =>
      JSON.stringify({
        name_id: formState.name_id,
        description_id: formState.description_id,
        color_id: formState.color_id,
        icon_id: formState.icon_id,
        instructions_id: formState.instructions_id,
        active_flag_id: formState.active_flag_id,
        department_ids: formState.department_ids,
        parameter_field_ids: formState.parameter_field_ids,
        example_ids: formState.example_ids,
        parameter_ids: formState.parameter_ids,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      formState.name_id,
      formState.description_id,
      formState.color_id,
      formState.icon_id,
      formState.instructions_id,
      formState.active_flag_id,
      formStateDepartmentIdsStr,
      formStateParameterFieldIdsStr,
      formStateExampleIdsStr,
      formStateParameterIdsStr,
    ]
  );

  const hasResourceIds = !!(
    formState.name_id ||
    formState.description_id ||
    formState.color_id ||
    formState.icon_id ||
    formState.instructions_id ||
    formState.active_flag_id ||
    formState.department_ids.length > 0 ||
    formState.parameter_field_ids.length > 0 ||
    formState.example_ids.length > 0 ||
    formState.parameter_ids.length > 0
  );

  const buildPatchPayload = useCallback(
    (
      draftId: string | null,
      expectedVersion: number,
      flushResults?: Record<string, unknown>
    ): Record<string, unknown> => {
      const currentFormState = formStateRef.current as unknown as PersonaFormState;
      const fr = (flushResults ?? {}) as Partial<FlushResult>;
      return {
        input_draft_id: draftId || null,
        name_id: fr.name_id !== undefined ? fr.name_id : currentFormState.name_id,
        description_id: fr.description_id !== undefined ? fr.description_id : currentFormState.description_id,
        color_id: fr.color_id !== undefined ? fr.color_id : currentFormState.color_id,
        icon_id: currentFormState.icon_id,
        instructions_id: fr.instructions_id !== undefined ? fr.instructions_id : currentFormState.instructions_id,
        active_flag_id: currentFormState.active_flag_id,
        department_ids: currentFormState.department_ids,
        parameter_field_ids: fr.parameter_field_ids !== undefined ? fr.parameter_field_ids : currentFormState.parameter_field_ids,
        example_ids: fr.example_ids !== undefined ? fr.example_ids : currentFormState.example_ids,
        parameter_ids: currentFormState.parameter_ids,
        expected_version: expectedVersion,
      };
    },
    []
  );

  const draftVersion =
    personaData && "draft_version" in personaData
      ? (personaData as { draft_version?: number | null }).draft_version
      : null;

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    serverSyncPendingRef,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey,
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    serverDraftVersion: draftVersion ?? null,
    hasResourceIds,
    flushRegistryRef,
    formStateRef,
  });

  // --- Conditional Parameter Toggle ---
  const getParameterFields = useCallback(
    () => personaDataRef.current?.resources?.resources?.parameter_fields ?? [],
    []
  );

  const { handleConditionalParameterToggle } = useConditionalParameterToggle({
    setFormState,
    getParameterFields,
  });

  // --- Generation Handlers ---
  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[], userInstructions?: string) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      if (resourceTypes.length === 0) {
        toast.error("No resource types specified for generation");
        return;
      }

      let draftIdToUse =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!draftIdToUse) {
        draftIdToUse = await flushAllAndSave();
      }
      if (!draftIdToUse) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      const formData = formDataRef.current;
      socket.emit("persona_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftIdToUse,
        color_search: (formData["colorSearch"] as string | undefined) ?? null,
        icon_search: (formData["iconSearch"] as string | undefined) ?? null,
        descriptions_search: (formData["descriptionSearch"] as string | undefined) ?? null,
        instructions_search: (formData["instructionsSearch"] as string | undefined) ?? null,
        color_show_selected: (formData["colorShowSelected"] as boolean | undefined) ?? false,
        icon_show_selected: (formData["iconShowSelected"] as boolean | undefined) ?? false,
        mcp: false,
        persona_id: personaId || null,
      });
    },
    [socket, isConnected, personaId, flushAllAndSave, formDataRef, setGeneratingResources]
  );

  const handleGenerateName = useCallback(
    async () => handleGenerateResources(["names"]),
    [handleGenerateResources]
  );
  const handleGenerateDescription = useCallback(
    async () => handleGenerateResources(["descriptions"]),
    [handleGenerateResources]
  );
  const handleGenerateInstructions = useCallback(
    async () => handleGenerateResources(["instructions"]),
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
  const handleGenerateExamples = useCallback(
    async () => handleGenerateResources(["examples"]),
    [handleGenerateResources]
  );
  const handleGenerateColors = useCallback(
    async () => handleGenerateResources(["colors"]),
    [handleGenerateResources]
  );
  const handleGenerateIcons = useCallback(
    async () => handleGenerateResources(["icons"]),
    [handleGenerateResources]
  );
  const handleGenerateParameters = useCallback(
    async () => handleGenerateResources(["parameters"]),
    [handleGenerateResources]
  );
  const handleGenerateParameterFields = useCallback(
    async () => handleGenerateResources(["parameter_fields"]),
    [handleGenerateResources]
  );

  // --- Generation Modal ---
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      parameters: ["parameters", "parameter_fields"],
      color: ["colors"],
      icon: ["icons"],
      content: ["instructions", "examples"],
      all: [
        "names", "descriptions", "colors", "icons", "instructions",
        "flags", "parameters", "parameter_fields", "departments", "examples",
      ],
    }),
    []
  );

  const resourceLabels: Partial<Record<ResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      colors: "Colors",
      icons: "Icons",
      instructions: "Instructions",
      flags: "Flags",
      examples: "Examples",
      parameters: "Parameters",
      parameter_fields: "Parameter Fields",
      departments: "Departments",
    }),
    []
  );

  const onModalGenerate = useCallback(
    (selectedResources: ResourceType[], instructions?: string) => {
      handleGenerateResources(selectedResources, instructions);
    },
    [handleGenerateResources]
  );

  const { handleOpenStepCardModal, modalProps } = useGenerationModal<ResourceType>({
    stepResources,
    resourceLabels,
    canRegenerate,
    onGenerate: onModalGenerate,
    isGenerating,
  });

  // --- Disabled / Breadcrumb ---
  const disabled = useMemo(() => {
    if (!personaData) return false;
    return !personaData.can_edit;
  }, [personaData]);

  const personaNameForBreadcrumb = stablePersonaDataFields?.name_resource?.name;
  useEffect(() => {
    if (personaNameForBreadcrumb && personaId && isEditMode) {
      setEntityMetadata({
        entityId: personaId,
        entityName: personaNameForBreadcrumb,
        entityType: "persona",
      });
    }
    return () => clearEntityMetadata();
  }, [
    personaNameForBreadcrumb,
    personaId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // --- Submit ---
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      let flushResults: FlushResult = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      const baseFormState = formStateRef.current as unknown as PersonaFormState;
      const effectiveFormState = {
        name_id: flushResults.name_id !== undefined ? flushResults.name_id : baseFormState.name_id,
        description_id: flushResults.description_id !== undefined ? flushResults.description_id : baseFormState.description_id,
        color_id: flushResults.color_id !== undefined ? flushResults.color_id : baseFormState.color_id,
        icon_id: baseFormState.icon_id,
        instructions_id: flushResults.instructions_id !== undefined ? flushResults.instructions_id : baseFormState.instructions_id,
        active_flag_id: baseFormState.active_flag_id,
        department_ids: baseFormState.department_ids,
        parameter_field_ids: flushResults.parameter_field_ids !== undefined ? flushResults.parameter_field_ids : baseFormState.parameter_field_ids,
        example_ids: flushResults.example_ids !== undefined ? flushResults.example_ids : baseFormState.example_ids,
        parameter_ids: baseFormState.parameter_ids,
      };

      if (personaData?.name_required && !effectiveFormState.name_id) {
        toast.error("Persona name is required");
        throw new Error("Persona name is required");
      }
      if (personaData?.color_required && !effectiveFormState.color_id) {
        toast.error("Persona color is required");
        throw new Error("Persona color is required");
      }
      if (personaData?.icon_required && !effectiveFormState.icon_id) {
        toast.error("Persona icon is required");
        throw new Error("Persona icon is required");
      }
      if (personaData?.instructions_required && !effectiveFormState.instructions_id) {
        toast.error("Instructions are required");
        throw new Error("Instructions are required");
      }
      if (personaData?.departments_required && (!effectiveFormState.department_ids || effectiveFormState.department_ids.length === 0)) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }
      if (personaData?.parameter_fields_required && (!effectiveFormState.parameter_field_ids || effectiveFormState.parameter_field_ids.length === 0)) {
        toast.error("Parameter fields are required");
        throw new Error("Parameter fields are required");
      }
      if (personaData?.examples_required && (!effectiveFormState.example_ids || effectiveFormState.example_ids.length === 0)) {
        toast.error("Examples are required");
        throw new Error("Examples are required");
      }

      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }
      if (!savePersonaAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }
      if (!personaData?.group_id) {
        toast.error("Group not found. Please try again.");
        throw new Error("Group ID is required for save");
      }
      if (
        !effectiveFormState.name_id ||
        !effectiveFormState.color_id ||
        !effectiveFormState.icon_id ||
        !effectiveFormState.instructions_id
      ) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        await savePersonaAction({
          body: {
            group_id: personaData.group_id,
            input_persona_id: isEditMode && personaId ? personaId : null,
            name_id: effectiveFormState.name_id,
            color_id: effectiveFormState.color_id,
            icon_id: effectiveFormState.icon_id,
            instructions_id: effectiveFormState.instructions_id,
            description_id: effectiveFormState.description_id ?? null,
            active_flag_id: effectiveFormState.active_flag_id ?? null,
            department_ids: effectiveFormState.department_ids.length > 0 ? effectiveFormState.department_ids : null,
            parameter_field_ids: effectiveFormState.parameter_field_ids.length > 0 ? effectiveFormState.parameter_field_ids : null,
            example_ids: effectiveFormState.example_ids.length > 0 ? effectiveFormState.example_ids : null,
            parameter_ids: effectiveFormState.parameter_ids.length > 0 ? effectiveFormState.parameter_ids : null,
          },
        });
        toast.success(`Persona ${isEditMode ? "updated" : "created"} successfully!`);
        router.push("/training/personas");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} persona: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      isAutosaveEnabled,
      flushAllResources,
      isEditMode,
      personaId,
      profile?.id,
      savePersonaAction,
      personaData?.group_id,
      router,
      personaData?.name_required,
      personaData?.color_required,
      personaData?.icon_required,
      personaData?.instructions_required,
      personaData?.departments_required,
      personaData?.parameter_fields_required,
      personaData?.examples_required,
    ]
  );

  // --- Step Status ---
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasColor = !!formState.color_id;
      const hasIcon = !!formState.icon_id;
      const hasInstructions = !!formState.instructions_id;
      const hasParameters = formState.parameter_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "parameters":
          if (!hasName || !hasDescription) return "pending";
          return hasParameters ? "completed" : "active";
        case "color":
          if (!hasName || !hasDescription) return "pending";
          return hasColor ? "completed" : "active";
        case "icon":
          if (!hasName || !hasDescription) return "pending";
          return hasIcon ? "completed" : "active";
        case "content":
          if (!hasName || !hasDescription) return "pending";
          return hasInstructions ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // --- Steps / Form Config ---
  const steps = useMemo(() => [
    {
      id: "basic",
      title: "Basic Information",
      description: "Set the persona name, description, departments, and active status.",
      resetFields: ["name", "description", "department_ids", "active"],
    },
    {
      id: "parameters",
      title: "Parameters",
      description: "Select parameters and parameter fields for this persona.",
      resetFields: ["parameter_ids", "parameter_field_ids", "parameterSearch", "parameterShowSelected"],
    },
    {
      id: "color",
      title: "Color",
      description: "Select a color for the persona.",
      resetFields: ["color", "colorSearch", "colorShowSelected"],
    },
    {
      id: "icon",
      title: "Icon",
      description: "Select an icon for the persona.",
      resetFields: ["icon", "iconSearch", "iconShowSelected"],
    },
    {
      id: "content",
      title: "Personality",
      description: "Define instructions and example messages for the persona.",
      resetFields: ["instructions", "examples"],
    },
  ], []);

  const formFieldKeys = useMemo(
    () => ["name", "description", "color", "icon", "instructions", "active", "department_ids", "parameter_field_ids", "parameter_ids", "examples"],
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic": return "Basic information reset";
      case "parameters": return "Parameters reset";
      case "color": return "Color reset";
      case "icon": return "Icon reset";
      case "content": return "Content reset";
      default: return "Reset";
    }
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/training/personas",
      backLabel: "Back",
      createLabel: "Create Persona",
      updateLabel: "Update Persona",
    }),
    []
  );

  // --- Render Step ---
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
      const currentPersonaData = stablePersonaDataFields;
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
                  name_resource={currentPersonaData?.name_resource ?? null}
                  show_name={currentPersonaData?.show_name ?? true}
                  name_suggestions={currentPersonaData?.name_suggestions ?? []}
                  names={currentPersonaData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., Enthusiastic Student"
                  defaultName="New Persona"
                  required={currentPersonaData?.name_required ?? false}
                  hideDescription={true}
                  group_id={currentPersonaData?.names_group_id ?? null}
                  showAiGenerate={currentPersonaData?.name_show_ai_generate ?? false}
                  createNamesAction={
                    createNamesAction as
                      | ((input: CreateDraftNamesIn) => Promise<CreateDraftNamesOut>)
                      | undefined
                  }
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["names"]}
                  aiResource={aiFormData.name_resource}
                  onAccept={() => clearAiResource("name_resource")}
                  onReject={() => clearAiResource("name_resource")}
                  create_tool_id={currentPersonaData?.name_create_tool_id ?? null}
                  link_tool_id={currentPersonaData?.name_link_tool_id ?? null}
                />
              }
              resetFields={["name", "description", "department_ids", "active"]}
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                (currentPersonaData?.basic_show_ai_generate ?? false) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources["basic"]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal("basic", hasRegeneratable ? "regenerate" : "generate");
                          }}
                          disabled={disabled || stepResources["basic"]!.some((rt) => isGenerating(rt))}
                        >
                          {stepResources["basic"]!.some((rt) => isGenerating(rt)) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["basic"]!.some((rt) => canRegenerate(rt)) ? "Regenerate" : "Generate"}
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
                  description_resource={currentPersonaData?.description_resource ?? null}
                  show_description={currentPersonaData?.show_description ?? true}
                  description_suggestions={currentPersonaData?.description_suggestions ?? []}
                  descriptions={currentPersonaData?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({ ...prev, description_id: descriptionId }))
                  }
                  searchTerm={(stepFormData["descriptionSearch"] as string | null | undefined) || ""}
                  onSearchChange={(term: string) => setStepFormData({ descriptionSearch: term || null })}
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  label="Description"
                  placeholder="Detailed behavior description and personality traits"
                  required={currentPersonaData?.description_required ?? false}
                  rows={4}
                  data-testid="input-persona-description"
                  group_id={currentPersonaData?.descriptions_group_id ?? null}
                  showAiGenerate={currentPersonaData?.description_show_ai_generate ?? false}
                  createDescriptionsAction={createDescriptionsAction}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["descriptions"]}
                  aiResource={aiFormData.description_resource}
                  onAccept={() => clearAiResource("description_resource")}
                  onReject={() => clearAiResource("description_resource")}
                  create_tool_id={currentPersonaData?.description_create_tool_id ?? null}
                  link_tool_id={currentPersonaData?.description_link_tool_id ?? null}
                />
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={currentPersonaData?.department_resources ?? []}
                  show_departments={currentPersonaData?.show_departments ?? false}
                  department_suggestions={currentPersonaData?.department_suggestions ?? []}
                  departments={currentPersonaData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) => setFormState((prev) => ({ ...prev, department_ids: ids }))}
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  required={currentPersonaData?.departments_required ?? false}
                  group_id={currentPersonaData?.departments_group_id ?? null}
                  showAiGenerate={currentPersonaData?.departments_show_ai_generate ?? false}
                  aiDepartmentResources={aiFormData.department_resources ?? null}
                  onAccept={() => clearAiResource("department_resources")}
                  onReject={() => clearAiResource("department_resources")}
                  link_tool_id={currentPersonaData?.departments_link_tool_id ?? null}
                />
                <Flags
                  flags={currentPersonaData?.flags ?? []}
                  flag_id={formState.active_flag_id}
                  show_flags={currentPersonaData?.show_flag ?? false}
                  columns={1}
                  label="Flags"
                  disabled={disabled}
                  group_id={currentPersonaData?.flags_group_id ?? null}
                  showAiGenerate={currentPersonaData?.flag_show_ai_generate ?? false}
                  onChange={(flagId) => setFormState((prev) => ({ ...prev, active_flag_id: flagId }))}
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("flags")}
                  aiFlagResources={aiFormData.flag_resource ? [aiFormData.flag_resource] : null}
                  onAccept={() => clearAiResource("flag_resource")}
                  onReject={() => clearAiResource("flag_resource")}
                  link_tool_id={currentPersonaData?.flag_link_tool_id ?? null}
                />
              </div>
            </StepCard>
          );

        case "parameters": {
          const parameterSearchTerm = (stepFormData["parameterSearch"] as string | null | undefined) || "";
          const parameterShowSelected = (stepFormData["parameterShowSelected"] as boolean | null | undefined) ?? false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={parameterSearchTerm}
              onSearchChange={(term: string) => setStepFormData({ parameterSearch: term || null })}
              searchPlaceholder="Search parameters..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: parameterShowSelected,
                  onChange: (value: boolean) => setStepFormData({ parameterShowSelected: value || null }),
                },
              ]}
              resetFields={["parameter_ids", "parameter_field_ids", "parameterSearch", "parameterShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["parameters"] &&
                stepResources["parameters"].length > 0 &&
                (currentPersonaData?.parameters_step_show_ai_generate ?? false) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources["parameters"]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal("parameters", hasRegeneratable ? "regenerate" : "generate");
                          }}
                          disabled={disabled || stepResources["parameters"]!.some((rt) => isGenerating(rt))}
                        >
                          {stepResources["parameters"]!.some((rt) => isGenerating(rt)) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["parameters"]!.some((rt) => canRegenerate(rt)) ? "Regenerate" : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <div className="space-y-6">
                <Parameters
                  parameter_ids={formState.parameter_ids ?? []}
                  parameter_resources={currentPersonaData?.parameter_resources ?? []}
                  show_parameters={currentPersonaData?.show_parameters ?? false}
                  parameter_suggestions={currentPersonaData?.parameter_suggestions ?? []}
                  parameters={currentPersonaData?.parameters ?? []}
                  disabled={disabled}
                  onChange={(ids) => setFormState((prev) => ({ ...prev, parameter_ids: ids }))}
                  onGenerate={handleGenerateParameters}
                  isGenerating={isGenerating("parameters")}
                  label="Parameters"
                  required={currentPersonaData?.parameters_required ?? false}
                  group_id={currentPersonaData?.parameters_group_id ?? null}
                  showAiGenerate={currentPersonaData?.parameters_show_ai_generate ?? false}
                  searchTerm={parameterSearchTerm}
                  showSelectedFilter={parameterShowSelected}
                  aiParameterResources={aiFormData.parameter_resources ?? null}
                  onAccept={() => clearAiResource("parameter_resources")}
                  onReject={() => clearAiResource("parameter_resources")}
                  link_tool_id={currentPersonaData?.parameters_link_tool_id ?? null}
                />
                <ParameterFields
                  parameter_field_ids={formState.parameter_field_ids}
                  parameter_field_resources={currentPersonaData?.parameter_field_resources ?? []}
                  show_parameter_fields={currentPersonaData?.show_parameter_fields ?? false}
                  parameter_fields={currentPersonaData?.parameter_fields ?? []}
                  parameter_ids={formState.parameter_ids}
                  parameters={currentPersonaData?.parameters ?? []}
                  parameter_resources={currentPersonaData?.parameter_resources ?? []}
                  disabled={disabled}
                  onChange={(ids) => setFormState((prev) => ({ ...prev, parameter_field_ids: ids }))}
                  onConditionalParameterToggle={handleConditionalParameterToggle}
                  group_id={currentPersonaData?.parameter_fields_group_id ?? null}
                  showAiGenerate={currentPersonaData?.parameter_fields_show_ai_generate ?? false}
                  required={currentPersonaData?.parameter_fields_required ?? false}
                  createParameterFieldsAction={createParameterFieldsAction}
                  onGenerate={handleGenerateParameterFields}
                  isGenerating={isGenerating("parameter_fields")}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["parameter_fields"]}
                  aiParameterFieldResources={aiFormData.parameter_field_resources ?? null}
                  onAccept={() => clearAiResource("parameter_field_resources")}
                  onReject={() => clearAiResource("parameter_field_resources")}
                  create_tool_id={currentPersonaData?.parameter_fields_create_tool_id ?? null}
                  link_tool_id={currentPersonaData?.parameter_fields_link_tool_id ?? null}
                />
              </div>
            </StepCard>
          );
        }

        case "color": {
          const colorShowSelected = (stepFormData["colorShowSelected"] as boolean | null | undefined) ?? false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={(stepFormData["colorSearch"] as string | null | undefined) || ""}
              onSearchChange={(term: string) => setStepFormData({ colorSearch: term || null })}
              searchPlaceholder="Search colors..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: colorShowSelected,
                  onChange: (value: boolean) => setStepFormData({ colorShowSelected: value || null }),
                },
              ]}
              resetFields={["color", "colorSearch", "colorShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["color"] && stepResources["color"].length > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources["color"]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal("color", hasRegeneratable ? "regenerate" : "generate");
                          }}
                          disabled={disabled || stepResources["color"]!.some((rt) => isGenerating(rt))}
                        >
                          {stepResources["color"]!.some((rt) => isGenerating(rt)) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["color"]!.some((rt) => canRegenerate(rt)) ? "Regenerate" : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <Colors
                color_id={formState.color_id ?? null}
                color_resource={currentPersonaData?.color_resource ?? null}
                show_color={currentPersonaData?.show_color ?? false}
                color_suggestions={currentPersonaData?.color_suggestions ?? []}
                colors={currentPersonaData?.colors ?? []}
                disabled={disabled}
                onColorIdChange={(colorId) => setFormState((prev) => ({ ...prev, color_id: colorId }))}
                onGenerate={handleGenerateColors}
                isGenerating={isGenerating("colors")}
                searchTerm={(stepFormData["colorSearch"] as string | null | undefined) || ""}
                onSearchChange={(term) => setStepFormData({ colorSearch: term || null })}
                showSelectedFilter={colorShowSelected}
                onShowSelectedChange={(value) => setStepFormData({ colorShowSelected: value || null })}
                group_id={currentPersonaData?.colors_group_id ?? null}
                showAiGenerate={currentPersonaData?.color_show_ai_generate ?? false}
                createColorsAction={createColorsAction}
                required={currentPersonaData?.color_required ?? false}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["colors"]}
                aiResource={aiFormData.color_resource}
                onAccept={() => clearAiResource("color_resource")}
                onReject={() => clearAiResource("color_resource")}
                create_tool_id={currentPersonaData?.color_create_tool_id ?? null}
                link_tool_id={currentPersonaData?.color_link_tool_id ?? null}
              />
            </StepCard>
          );
        }

        case "icon": {
          const iconShowSelected = (stepFormData["iconShowSelected"] as boolean | null | undefined) ?? false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={(stepFormData["iconSearch"] as string | null | undefined) || ""}
              onSearchChange={(term: string) => setStepFormData({ iconSearch: term || null })}
              searchPlaceholder="Search icons..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: iconShowSelected,
                  onChange: (value: boolean) => setStepFormData({ iconShowSelected: value || null }),
                },
              ]}
              resetFields={["icon", "iconSearch", "iconShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["icon"] && stepResources["icon"].length > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources["icon"]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal("icon", hasRegeneratable ? "regenerate" : "generate");
                          }}
                          disabled={disabled || stepResources["icon"]!.some((rt) => isGenerating(rt))}
                        >
                          {stepResources["icon"]!.some((rt) => isGenerating(rt)) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["icon"]!.some((rt) => canRegenerate(rt)) ? "Regenerate" : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <Icons
                icon_id={formState.icon_id ?? null}
                icon_resource={currentPersonaData?.icon_resource ?? null}
                show_icon={currentPersonaData?.show_icon ?? false}
                icon_suggestions={currentPersonaData?.icon_suggestions ?? []}
                icons={currentPersonaData?.icons ?? []}
                disabled={disabled}
                onIconIdChange={(iconId) => setFormState((prev) => ({ ...prev, icon_id: iconId }))}
                onGenerate={handleGenerateIcons}
                isGenerating={isGenerating("icons")}
                searchTerm={(stepFormData["iconSearch"] as string | null | undefined) || ""}
                onSearchChange={(term) => setStepFormData({ iconSearch: term || null })}
                showSelectedFilter={iconShowSelected}
                onShowSelectedChange={(value) => setStepFormData({ iconShowSelected: value || null })}
                group_id={currentPersonaData?.icons_group_id ?? null}
                showAiGenerate={currentPersonaData?.icon_show_ai_generate ?? false}
                required={currentPersonaData?.icon_required ?? false}
                aiResource={aiFormData.icon_resource}
                onAccept={() => clearAiResource("icon_resource")}
                onReject={() => clearAiResource("icon_resource")}
                link_tool_id={currentPersonaData?.icon_link_tool_id ?? null}
              />
            </StepCard>
          );
        }

        case "content":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["instructions", "examples"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["content"] &&
                stepResources["content"].length > 0 &&
                (currentPersonaData?.content_show_ai_generate ?? false) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources["content"]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal("content", hasRegeneratable ? "regenerate" : "generate");
                          }}
                          disabled={disabled || stepResources["content"]!.some((rt) => isGenerating(rt))}
                        >
                          {stepResources["content"]!.some((rt) => isGenerating(rt)) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["content"]!.some((rt) => canRegenerate(rt)) ? "Regenerate" : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <Instructions
                instructions_id={formState.instructions_id ?? null}
                instructions_resource={
                  formState.instructions_id
                    ? (currentPersonaData?.instructions_resource ?? null)
                    : null
                }
                show_instructions={currentPersonaData?.show_instructions ?? true}
                instructions_suggestions={currentPersonaData?.instructions_suggestions ?? []}
                instructions={currentPersonaData?.instructions ?? []}
                disabled={disabled}
                onInstructionsIdChange={(instructionsId) =>
                  setFormState((prev) => ({ ...prev, instructions_id: instructionsId }))
                }
                searchTerm={(stepFormData["instructionsSearch"] as string | null | undefined) || ""}
                onSearchChange={(term: string) => setStepFormData({ instructionsSearch: term || null })}
                onGenerate={handleGenerateInstructions}
                isGenerating={isGenerating("instructions")}
                label="Instructions"
                placeholder="Instructions that define how the persona should behave and respond."
                required={currentPersonaData?.instructions_required ?? false}
                rows={8}
                helpText="Define the persona's behavior, communication style, and response patterns"
                data-testid="input-instructions"
                group_id={currentPersonaData?.instructions_group_id ?? null}
                showAiGenerate={currentPersonaData?.instructions_show_ai_generate ?? false}
                createInstructionsAction={createInstructionsAction}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["instructions"]}
                aiResource={aiFormData.instructions_resource}
                onAccept={() => clearAiResource("instructions_resource")}
                onReject={() => clearAiResource("instructions_resource")}
                create_tool_id={currentPersonaData?.instructions_create_tool_id ?? null}
                link_tool_id={currentPersonaData?.instructions_link_tool_id ?? null}
              />
              <Examples
                example_ids={formState.example_ids ?? []}
                example_resources={currentPersonaData?.example_resources ?? []}
                show_examples={currentPersonaData?.show_examples ?? false}
                example_suggestions={currentPersonaData?.example_suggestions ?? []}
                examples={currentPersonaData?.examples ?? []}
                disabled={disabled}
                onChange={(ids) => setFormState((prev) => ({ ...prev, example_ids: ids }))}
                onGenerate={handleGenerateExamples}
                isGenerating={isGenerating("examples")}
                maxItems={10}
                addButtonLabel="Add example"
                itemPlaceholder="Message"
                group_id={currentPersonaData?.examples_group_id ?? null}
                showAiGenerate={currentPersonaData?.examples_show_ai_generate ?? false}
                createExamplesAction={
                  createExamplesAction
                    ? async (input: {
                        body: { group_id: string; example: string; mcp?: boolean };
                      }) => {
                        return await createExamplesAction({
                          body: { ...input.body, mcp: input.body.mcp ?? false },
                        });
                      }
                    : undefined
                }
                required={currentPersonaData?.examples_required ?? false}
                exampleMapping={
                  currentPersonaData?.examples && formState.example_ids
                    ? Object.fromEntries(
                        currentPersonaData.examples
                          .map((ex, idx) => [formState.example_ids?.[idx] || "", ex.example || ""])
                          .filter(([id]) => id)
                      )
                    : {}
                }
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["examples"]}
                aiExampleResources={aiFormData.example_resources ?? null}
                onAccept={() => clearAiResource("example_resources")}
                onReject={() => clearAiResource("example_resources")}
                create_tool_id={currentPersonaData?.examples_create_tool_id ?? null}
                link_tool_id={currentPersonaData?.examples_link_tool_id ?? null}
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      stablePersonaDataFields,
      disabled,
      isEditMode,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateInstructions,
      handleGenerateDepartments,
      handleGenerateFlags,
      handleGenerateExamples,
      handleGenerateColors,
      handleGenerateIcons,
      handleGenerateParameters,
      handleGenerateParameterFields,
      handleConditionalParameterToggle,
      isGenerating,
      stepResources,
      formState.name_id,
      formState.description_id,
      formState.color_id,
      formState.icon_id,
      formState.instructions_id,
      formState.active_flag_id,
      formState.department_ids,
      formState.parameter_field_ids,
      formState.example_ids,
      formState.parameter_ids,
      createNamesAction,
      createDescriptionsAction,
      createColorsAction,
      createInstructionsAction,
      createExamplesAction,
      canRegenerate,
      handleOpenStepCardModal,
      isAutosaveEnabled,
      registerFlushCallbacks,
      createParameterFieldsAction,
      aiFormData,
      clearAiResource,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`persona-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={personaData?.disabled_reason ?? null}
          entityType="persona"
        />

        <GenericForm
          nuqsParsers={personaSearchParamsClient as Record<string, Parser<unknown>>}
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={personaData}
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

        {modalProps.open && (
          <GenerateRegenerateModal {...modalProps} />
        )}
      </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(PersonaComponent, (prevProps, nextProps) => {
  const prevCurrent = prevProps.personaData?.resources?.current;
  const nextCurrent = nextProps.personaData?.resources?.current;
  const prevIds = {
    name_id: prevCurrent?.names?.[0]?.id ?? null,
    description_id: prevCurrent?.descriptions?.[0]?.id ?? null,
    color_id: prevCurrent?.colors?.[0]?.id ?? null,
    icon_id: prevCurrent?.icons?.[0]?.id ?? null,
    instructions_id: prevCurrent?.instructions?.[0]?.id ?? null,
    active_flag_id: prevCurrent?.flags?.[0]?.flag_option_id ?? null,
    department_ids: (prevCurrent?.departments ?? []).map((d) => d.department_id).filter(Boolean),
    parameter_field_ids: (prevCurrent?.parameter_fields ?? []).map((f) => f.field_id).filter(Boolean),
    example_ids: (prevCurrent?.examples ?? []).map((e) => e.id).filter(Boolean),
  };
  const nextIds = {
    name_id: nextCurrent?.names?.[0]?.id ?? null,
    description_id: nextCurrent?.descriptions?.[0]?.id ?? null,
    color_id: nextCurrent?.colors?.[0]?.id ?? null,
    icon_id: nextCurrent?.icons?.[0]?.id ?? null,
    instructions_id: nextCurrent?.instructions?.[0]?.id ?? null,
    active_flag_id: nextCurrent?.flags?.[0]?.flag_option_id ?? null,
    department_ids: (nextCurrent?.departments ?? []).map((d) => d.department_id).filter(Boolean),
    parameter_field_ids: (nextCurrent?.parameter_fields ?? []).map((f) => f.field_id).filter(Boolean),
    example_ids: (nextCurrent?.examples ?? []).map((e) => e.id).filter(Boolean),
  };

  if (
    prevProps.personaId !== nextProps.personaId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false;
  }

  if (
    prevProps.savePersonaAction !== nextProps.savePersonaAction ||
    prevProps.patchPersonaDraftAction !== nextProps.patchPersonaDraftAction ||
    prevProps.createNamesAction !== nextProps.createNamesAction ||
    prevProps.createDescriptionsAction !== nextProps.createDescriptionsAction ||
    prevProps.createColorsAction !== nextProps.createColorsAction ||
    prevProps.createInstructionsAction !== nextProps.createInstructionsAction ||
    prevProps.createExamplesAction !== nextProps.createExamplesAction ||
    prevProps.createParameterFieldsAction !== nextProps.createParameterFieldsAction
  ) {
    return false;
  }

  return true;
});
