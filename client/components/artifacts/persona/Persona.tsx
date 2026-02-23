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
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
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
import { Voices } from "@/components/resources/Voices";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useConditionalParameterToggle } from "@/hooks/use-conditional-parameter-toggle";
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
import type { ResourceType } from "@/lib/resources/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

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
type CreateDraftVoicesIn = InputOf<"/api/v4/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v4/resources/voices", "post">;
type PatchPersonaDraftIn = InputOf<"/api/v4/artifacts/personas/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<
  "/api/v4/artifacts/personas/draft",
  "patch"
>;

type PersonaData = OutputOf<"/api/v4/artifacts/personas/get", "post">;

// Type for flush results - each resource returns its created ID(s)
type FlushResult = {
  name_id?: string | null;
  description_id?: string | null;
  color_id?: string | null;
  instructions_id?: string | null;
  example_ids?: string[];
  parameter_field_ids?: string[];
  voice_ids?: string[];
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
  voice_ids: string[];
};

export interface PersonaProps {
  personaId?: string;
  // Server-provided data (for server-side rendering)
  personaData?: PersonaData;
  // Server actions (replaces useMutation)
  savePersonaAction?: (input: SavePersonaIn) => Promise<SavePersonaOut>;
  patchPersonaDraftAction?: (
    input: PatchPersonaDraftIn,
  ) => Promise<PatchPersonaDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn,
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn,
  ) => Promise<CreateDraftDescriptionsOut>;
  createColorsAction?: (
    input: CreateDraftColorsIn,
  ) => Promise<CreateDraftColorsOut>;
  createInstructionsAction?: (
    input: CreateDraftInstructionsIn,
  ) => Promise<CreateDraftInstructionsOut>;
  createExamplesAction?: (
    input: CreateDraftExamplesIn,
  ) => Promise<CreateDraftExamplesOut>;
  createParameterFieldsAction?: (
    input: CreateDraftParameterFieldsIn,
  ) => Promise<CreateDraftParameterFieldsOut>;
  createVoicesAction?: (
    input: CreateDraftVoicesIn,
  ) => Promise<CreateDraftVoicesOut>;
}

const FLUSH_KEYS = [
  "names",
  "descriptions",
  "instructions",
  "examples",
  "colors",
  "parameter_fields",
  "voices",
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
  "voices",
];

const PERSONA_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  { key: "colors", formKey: "color_id", flushKey: "color_id", type: "single" },
  { key: "icons", formKey: "icon_id", flushKey: null, type: "single" },
  {
    key: "instructions",
    formKey: "instructions_id",
    flushKey: "instructions_id",
    type: "single",
  },
  { key: "flags", formKey: "active_flag_id", flushKey: null, type: "single" },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: null,
    type: "multi",
  },
  {
    key: "parameter_fields",
    formKey: "parameter_field_ids",
    flushKey: "parameter_field_ids",
    type: "multi",
  },
  {
    key: "examples",
    formKey: "example_ids",
    flushKey: "example_ids",
    type: "multi",
  },
  {
    key: "parameters",
    formKey: "parameter_ids",
    flushKey: null,
    type: "multi",
  },
  {
    key: "voices",
    formKey: "voice_ids",
    flushKey: "voice_ids",
    type: "multi",
  },
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
  createVoicesAction,
}: PersonaProps) {
  const router = useRouter();
  const isEditMode = !!personaId;
  const { profile } = useProfile();
  const { setSelectedDraftId, isAutosaveEnabled } = useDrafts();

  // --- Flush Registry ---
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<FlushResult>(FLUSH_KEYS);

  // --- AI Generation State ---
  const { isGenerating, makeOnGenerationComplete, generate } =
    useArtifactAi({
      artifactType: "persona",
      groupId: personaData?.group_id,
      validResourceTypes: VALID_RESOURCE_TYPES as string[],
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
    [],
  );

  // --- Form State ---
  const personaDataRef = React.useRef(personaData);
  React.useEffect(() => {
    personaDataRef.current = personaData;
  }, [personaData]);

  const stablePersonaDataFields = React.useMemo(() => {
    if (!personaData) return null;
    return {
      names: personaData.names,
      descriptions: personaData.descriptions,
      colors: personaData.colors,
      icons: personaData.icons,
      instructions: personaData.instructions,
      flags: personaData.flags,
      departments: personaData.departments,
      parameter_fields: personaData.parameter_fields,
      examples: personaData.examples,
      parameters: personaData.parameters,
      voices: personaData.voices,
      group_id: personaData.group_id,
      basic_show_ai_generate: personaData.basic_show_ai_generate,
      content_show_ai_generate: personaData.content_show_ai_generate,
      parameters_step_show_ai_generate:
        personaData.parameters_step_show_ai_generate,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    personaData?.names,
    personaData?.descriptions,
    personaData?.colors,
    personaData?.icons,
    personaData?.instructions,
    personaData?.flags,
    personaData?.departments,
    personaData?.parameter_fields,
    personaData?.examples,
    personaData?.parameters,
    personaData?.voices,
    personaData?.group_id,
    personaData?.basic_show_ai_generate,
    personaData?.content_show_ai_generate,
    personaData?.parameters_step_show_ai_generate,
  ]);

  const canRegenerate = useCallback(
    (resourceType: string): boolean => {
      if (!stablePersonaDataFields) return false;
      switch (resourceType) {
        case "names":
          return stablePersonaDataFields.names?.resource?.generated ?? false;
        case "descriptions":
          return (
            stablePersonaDataFields.descriptions?.resource?.generated ?? false
          );
        case "colors":
          return stablePersonaDataFields.colors?.resource?.generated ?? false;
        case "icons":
          return stablePersonaDataFields.icons?.resource?.generated ?? false;
        case "instructions":
          return (
            stablePersonaDataFields.instructions?.resource?.generated ?? false
          );
        case "flags":
          return (
            stablePersonaDataFields.flags?.resources?.[0]?.generated ?? false
          );
        case "departments":
          return (
            stablePersonaDataFields.departments?.current?.some(
              (d) => d.generated,
            ) ?? false
          );
        case "parameter_fields":
          return (
            stablePersonaDataFields.parameter_fields?.current?.some(
              (f) => f.generated,
            ) ?? false
          );
        case "examples":
          return (
            stablePersonaDataFields.examples?.current?.some(
              (e) => e.generated,
            ) ?? false
          );
        case "voices":
          return (
            stablePersonaDataFields.voices?.current?.some(
              (v) => v.generated,
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stablePersonaDataFields],
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
        voice_ids: [],
      };
    }

    const currentParameterIds = (data.parameters?.current ?? [])
      .map((p) => p.parameter_id)
      .filter(Boolean) as string[];
    const paramIdsSet = new Set<string>(currentParameterIds);
    const availableFields = data.parameter_fields?.resources ?? [];

    if (
      data.parameter_fields?.current &&
      data.parameter_fields.current.length > 0
    ) {
      data.parameter_fields.current.forEach((fieldResource) => {
        if (fieldResource.parameter_id) {
          paramIdsSet.add(fieldResource.parameter_id);
        }
        const availableField = availableFields.find(
          (f) => f.field_id === fieldResource.field_id,
        );
        if (availableField?.conditional_parameter_id) {
          paramIdsSet.add(availableField.conditional_parameter_id);
        }
      });
    }

    return {
      name_id: data.names?.resource?.id ?? null,
      description_id: data.descriptions?.resource?.id ?? null,
      color_id: data.colors?.resource?.id ?? null,
      icon_id: data.icons?.resource?.id ?? null,
      instructions_id: data.instructions?.resource?.id ?? null,
      active_flag_id: data.flags?.current?.flag_option_id ?? null,
      department_ids: (data.departments?.current ?? [])
        .map((d) => d.department_id)
        .filter(Boolean) as string[],
      parameter_field_ids: (data.parameter_fields?.current ?? [])
        .map((f) => f.field_id)
        .filter(Boolean) as string[],
      example_ids: (data.examples?.current ?? [])
        .map((e) => e.id)
        .filter(Boolean) as string[],
      parameter_ids: Array.from(paramIdsSet),
      voice_ids: (data.voices?.current ?? [])
        .map((v) => v.id)
        .filter(Boolean) as string[],
    };
  }, []);

  const [formState, setFormState] =
    useState<PersonaFormState>(getInitialFormState);
  const formStateRef = React.useRef<Record<string, unknown>>(
    formState as unknown as Record<string, unknown>,
  );
  const lastPatchedFormStateRef = useRef<PersonaFormState | null>(
    getInitialFormState(),
  );
  React.useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  // Memoize stringified array dependencies
  const departmentIdsStr = React.useMemo(() => {
    return JSON.stringify(
      (personaData?.departments?.current ?? [])
        .map((d) => d.department_id)
        .filter(Boolean),
    );
  }, [personaData?.departments]);
  const parameterFieldIdsStr = React.useMemo(() => {
    return JSON.stringify(
      (personaData?.parameter_fields?.current ?? [])
        .map((f) => f.field_id)
        .filter(Boolean),
    );
  }, [personaData?.parameter_fields]);
  const exampleIdsStr = React.useMemo(() => {
    return JSON.stringify(
      (personaData?.examples?.current ?? []).map((e) => e.id).filter(Boolean),
    );
  }, [personaData?.examples]);
  const parameterIdsStr = React.useMemo(() => {
    return JSON.stringify(
      (personaData?.parameters?.current ?? [])
        .map((p) => p.parameter_id)
        .filter(Boolean),
    );
  }, [personaData?.parameters]);
  const voiceIdsStr = React.useMemo(() => {
    return JSON.stringify(
      (personaData?.voices?.current ?? []).map((v) => v.id).filter(Boolean),
    );
  }, [personaData?.voices]);

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
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.parameter_field_ids) !==
          JSON.stringify(newState.parameter_field_ids) ||
        JSON.stringify(prev.example_ids) !==
          JSON.stringify(newState.example_ids) ||
        JSON.stringify(prev.parameter_ids) !==
          JSON.stringify(newState.parameter_ids) ||
        JSON.stringify(prev.voice_ids) !==
          JSON.stringify(newState.voice_ids)
      ) {
        serverSyncPendingRef.current = true;
        lastPatchedFormStateRef.current = newState;
        return newState;
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    personaData?.names,
    personaData?.descriptions,
    personaData?.colors,
    personaData?.icons,
    personaData?.instructions,
    personaData?.flags,
    personaData?.departments,
    personaData?.parameter_fields,
    personaData?.examples,
    personaData?.parameters,
    personaData?.voices,
    departmentIdsStr,
    parameterFieldIdsStr,
    exampleIdsStr,
    parameterIdsStr,
    voiceIdsStr,
  ]);

  // --- Draft Lifecycle ---
  const patchPersonaDraftActionRef = React.useRef(patchPersonaDraftAction);
  React.useEffect(() => {
    patchPersonaDraftActionRef.current = patchPersonaDraftAction;
  }, [patchPersonaDraftAction]);

  // Stable ref wrapper for patch action
  const patchActionRef = React.useRef<
    | ((
        payload: Record<string, unknown>,
      ) => Promise<{ draft_id?: string | null; new_version?: number | null }>)
    | undefined
  >(undefined);
  React.useEffect(() => {
    if (patchPersonaDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        return await patchPersonaDraftAction({
          body: payload,
        } as PatchPersonaDraftIn);
      };
    } else {
      patchActionRef.current = undefined;
    }
  }, [patchPersonaDraftAction]);

  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids],
  );
  const formStateParameterFieldIdsStr = React.useMemo(
    () => JSON.stringify(formState.parameter_field_ids),
    [formState.parameter_field_ids],
  );
  const formStateExampleIdsStr = React.useMemo(
    () => JSON.stringify(formState.example_ids),
    [formState.example_ids],
  );
  const formStateParameterIdsStr = React.useMemo(
    () => JSON.stringify(formState.parameter_ids),
    [formState.parameter_ids],
  );
  const formStateVoiceIdsStr = React.useMemo(
    () => JSON.stringify(formState.voice_ids),
    [formState.voice_ids],
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
        voice_ids: formState.voice_ids,
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
      formStateVoiceIdsStr,
    ],
  );

  const hasResourceIds = checkHasResourceIds(
    PERSONA_RESOURCES,
    formState as unknown as Record<string, unknown>,
  );

  const buildPatchPayload = useCallback(
    (
      draftId: string | null,
      expectedVersion: number,
      flushResults?: Record<string, unknown>,
    ): Record<string, unknown> => {
      return {
        input_draft_id: draftId || null,
        ...buildDraftPayload(PERSONA_RESOURCES, {
          formState: formStateRef.current,
          referenceState: lastPatchedFormStateRef.current as unknown as Record<
            string,
            unknown
          > | null,
          flushResults: (flushResults ?? {}) as Record<string, unknown>,
        }),
        expected_version: expectedVersion,
      };
    },
    [],
  );

  const draftVersion =
    personaData && "draft_version" in personaData
      ? (personaData as { draft_version?: number | null }).draft_version
      : null;

  const onPatchSuccess = useCallback(() => {
    lastPatchedFormStateRef.current = {
      ...(formStateRef.current as unknown as PersonaFormState),
    };
  }, []);

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
    onPatchSuccess,
  });

  // --- Conditional Parameter Toggle ---
  const getParameterFields = useCallback(
    () => personaDataRef.current?.parameter_fields?.resources ?? [],
    [],
  );

  const { handleConditionalParameterToggle } = useConditionalParameterToggle({
    setFormState,
    getParameterFields,
  });

  // --- Generation Handlers ---
  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[], userInstructions?: string) => {
      let draftIdToUse =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!draftIdToUse) {
        draftIdToUse = await flushAllAndSave();
      }
      if (!draftIdToUse) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      generate(resourceTypes, {
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftIdToUse,
      });
    },
    [
      flushAllAndSave,
      formDataRef,
      generate,
    ],
  );

  const generateHandlers = useMemo(
    () =>
      Object.fromEntries(
        VALID_RESOURCE_TYPES.map((rt) => [
          rt,
          () => handleGenerateResources([rt]),
        ]),
      ) as Record<ResourceType, () => Promise<void>>,
    [handleGenerateResources],
  );

  // --- Generation Modal ---
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      parameters: ["parameters", "parameter_fields"],
      color: ["colors"],
      icon: ["icons"],
      content: ["instructions", "examples", "voices"],
      all: [
        "names",
        "descriptions",
        "colors",
        "icons",
        "instructions",
        "flags",
        "parameters",
        "parameter_fields",
        "departments",
        "examples",
        "voices",
      ],
    }),
    [],
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
      voices: "Voices",
    }),
    [],
  );

  const onModalGenerate = useCallback(
    (selectedResources: ResourceType[], instructions?: string) => {
      handleGenerateResources(selectedResources, instructions);
    },
    [handleGenerateResources],
  );

  const { handleOpenStepCardModal, modalProps } =
    useGenerationModal<ResourceType>({
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

  // --- Submit ---
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      let flushResults: FlushResult = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      const effectiveFormState = computeEffectiveFormState(
        PERSONA_RESOURCES,
        formStateRef.current,
        flushResults as Record<string, unknown>,
      ) as unknown as PersonaFormState;

      if (personaData?.names?.required && !effectiveFormState.name_id) {
        toast.error("Persona name is required");
        throw new Error("Persona name is required");
      }
      if (personaData?.colors?.required && !effectiveFormState.color_id) {
        toast.error("Persona color is required");
        throw new Error("Persona color is required");
      }
      if (personaData?.icons?.required && !effectiveFormState.icon_id) {
        toast.error("Persona icon is required");
        throw new Error("Persona icon is required");
      }
      if (
        personaData?.instructions?.required &&
        !effectiveFormState.instructions_id
      ) {
        toast.error("Instructions are required");
        throw new Error("Instructions are required");
      }
      if (
        personaData?.departments?.required &&
        (!effectiveFormState.department_ids ||
          effectiveFormState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }
      if (
        personaData?.parameter_fields?.required &&
        (!effectiveFormState.parameter_field_ids ||
          effectiveFormState.parameter_field_ids.length === 0)
      ) {
        toast.error("Parameter fields are required");
        throw new Error("Parameter fields are required");
      }
      if (
        personaData?.examples?.required &&
        (!effectiveFormState.example_ids ||
          effectiveFormState.example_ids.length === 0)
      ) {
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
            input_persona_id: isEditMode && personaId ? personaId : null,
            name_id: effectiveFormState.name_id!,
            color_id: effectiveFormState.color_id!,
            icon_id: effectiveFormState.icon_id!,
            instructions_id: effectiveFormState.instructions_id!,
            description_id: effectiveFormState.description_id ?? null,
            active_flag_id: effectiveFormState.active_flag_id ?? null,
            department_ids: effectiveFormState.department_ids?.length
              ? effectiveFormState.department_ids
              : null,
            parameter_field_ids: effectiveFormState.parameter_field_ids?.length
              ? effectiveFormState.parameter_field_ids
              : null,
            example_ids: effectiveFormState.example_ids?.length
              ? effectiveFormState.example_ids
              : null,
            parameter_ids: effectiveFormState.parameter_ids?.length
              ? effectiveFormState.parameter_ids
              : null,
            voice_ids: effectiveFormState.voice_ids?.length
              ? effectiveFormState.voice_ids
              : null,
          },
        });
        toast.success(
          `Persona ${isEditMode ? "updated" : "created"} successfully!`,
        );
        router.push("/training/personas");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} persona: ${error instanceof Error ? error.message : "Unknown error"}`,
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
      personaData?.names,
      personaData?.descriptions,
      personaData?.colors,
      personaData?.icons,
      personaData?.instructions,
      personaData?.flags,
      personaData?.departments,
      personaData?.parameter_fields,
      personaData?.examples,
      personaData?.parameters,
      router,
    ],
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
    [formState],
  );

  // --- Steps / Form Config ---
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the persona name, description, departments, and active status.",
        resetFields: ["name", "description", "department_ids", "active"],
      },
      {
        id: "parameters",
        title: "Parameters",
        description: "Select parameters and parameter fields for this persona.",
        resetFields: [
          "parameter_ids",
          "parameter_field_ids",
          "parameterSearch",
          "parameterShowSelected",
        ],
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
        description:
          "Define instructions, example messages, and voices for the persona.",
        resetFields: ["instructions", "examples", "voice_ids"],
      },
    ],
    [],
  );

  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "color",
      "icon",
      "instructions",
      "active",
      "department_ids",
      "parameter_field_ids",
      "parameter_ids",
      "examples",
    ],
    [],
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "parameters":
        return "Parameters reset";
      case "color":
        return "Color reset";
      case "icon":
        return "Icon reset";
      case "content":
        return "Content reset";
      default:
        return "Reset";
    }
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/training/personas",
      backLabel: "Back",
      createLabel: "Create Persona",
      updateLabel: "Update Persona",
    }),
    [],
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
      const s = stablePersonaDataFields;
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
                  name_resource={s?.names?.resource ?? null}
                  show_name={s?.names?.show ?? true}
                  name_suggestions={s?.names?.suggestions ?? []}
                  names={s?.names?.resources ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={generateHandlers["names"]}
                  placeholder="e.g., Enthusiastic Student"
                  defaultName="New Persona"
                  required={s?.names?.required ?? false}
                  hideDescription={true}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.names?.show_ai_generate ?? false}
                  createNamesAction={
                    createNamesAction as
                      | ((
                          input: CreateDraftNamesIn,
                        ) => Promise<CreateDraftNamesOut>)
                      | undefined
                  }
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["names"]}
                  create_tool_id={s?.names?.tool_id ?? null}
                />
              }
              resetFields={["name", "description", "department_ids", "active"]}
              actions={
                stepResources["basic"]?.length &&
                (s?.basic_show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]!}
                    canRegenerate={canRegenerate}
                    isGenerating={isGenerating}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={s?.descriptions?.resource ?? null}
                  show_description={s?.descriptions?.show ?? true}
                  description_suggestions={s?.descriptions?.suggestions ?? []}
                  descriptions={s?.descriptions?.resources ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                    }))
                  }
                  searchTerm={
                    (stepFormData["descriptionSearch"] as
                      | string
                      | null
                      | undefined) || ""
                  }
                  onSearchChange={(term: string) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                  onGenerate={generateHandlers["descriptions"]}
                  label="Description"
                  placeholder="Detailed behavior description and personality traits"
                  required={s?.descriptions?.required ?? false}
                  rows={4}
                  data-testid="input-persona-description"
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.descriptions?.show_ai_generate ?? false}
                  createDescriptionsAction={createDescriptionsAction}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["descriptions"]}
                  create_tool_id={s?.descriptions?.tool_id ?? null}
                />
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={s?.departments?.current ?? []}
                  show_departments={s?.departments?.show ?? false}
                  department_suggestions={s?.departments?.suggestions ?? []}
                  departments={s?.departments?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={generateHandlers["departments"]}
                  required={s?.departments?.required ?? false}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.departments?.show_ai_generate ?? false}
                />
                <Flags
                  flags={s?.flags?.resources ?? []}
                  flag_id={formState.active_flag_id}
                  show_flags={s?.flags?.show ?? false}
                  columns={1}
                  label="Flags"
                  disabled={disabled}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.flags?.show_ai_generate ?? false}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  onGenerate={generateHandlers["flags"]}
                />
              </div>
            </StepCard>
          );

        case "parameters": {
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
                    setStepFormData({ parameterShowSelected: value || null }),
                },
              ]}
              resetFields={[
                "parameter_ids",
                "parameter_field_ids",
                "parameterSearch",
                "parameterShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["parameters"]?.length &&
                (s?.parameters_step_show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="parameters"
                    resourceTypes={stepResources["parameters"]!}
                    canRegenerate={canRegenerate}
                    isGenerating={isGenerating}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <Parameters
                  parameter_ids={formState.parameter_ids ?? []}
                  parameter_resources={s?.parameters?.current ?? []}
                  show_parameters={s?.parameters?.show ?? false}
                  parameter_suggestions={s?.parameters?.suggestions ?? []}
                  parameters={s?.parameters?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, parameter_ids: ids }))
                  }
                  onGenerate={generateHandlers["parameters"]}
                  label="Parameters"
                  required={s?.parameters?.required ?? false}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.parameters?.show_ai_generate ?? false}
                  searchTerm={parameterSearchTerm}
                  showSelectedFilter={parameterShowSelected}
                />
                <ParameterFields
                  parameter_field_ids={formState.parameter_field_ids}
                  parameter_field_resources={s?.parameter_fields?.current ?? []}
                  show_parameter_fields={s?.parameter_fields?.show ?? false}
                  parameter_fields={s?.parameter_fields?.resources ?? []}
                  parameter_ids={formState.parameter_ids}
                  parameters={s?.parameters?.resources ?? []}
                  parameter_resources={s?.parameters?.current ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      parameter_field_ids: ids,
                    }))
                  }
                  onConditionalParameterToggle={
                    handleConditionalParameterToggle
                  }
                  group_id={s?.group_id ?? null}
                  showAiGenerate={
                    s?.parameter_fields?.show_ai_generate ?? false
                  }
                  required={s?.parameter_fields?.required ?? false}
                  createParameterFieldsAction={createParameterFieldsAction}
                  onGenerate={generateHandlers["parameter_fields"]}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["parameter_fields"]}
                  create_tool_id={s?.parameter_fields?.tool_id ?? null}
                />
              </div>
            </StepCard>
          );
        }

        case "color": {
          const colorShowSelected =
            (stepFormData["colorShowSelected"] as boolean | null | undefined) ??
            false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={
                (stepFormData["colorSearch"] as string | null | undefined) || ""
              }
              onSearchChange={(term: string) =>
                setStepFormData({ colorSearch: term || null })
              }
              searchPlaceholder="Search colors..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: colorShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({ colorShowSelected: value || null }),
                },
              ]}
              resetFields={["color", "colorSearch", "colorShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["color"]?.length ? (
                  <StepCardAiButton
                    stepId="color"
                    resourceTypes={stepResources["color"]!}
                    canRegenerate={canRegenerate}
                    isGenerating={isGenerating}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Colors
                color_id={formState.color_id ?? null}
                color_resource={s?.colors?.resource ?? null}
                show_color={s?.colors?.show ?? false}
                color_suggestions={s?.colors?.suggestions ?? []}
                colors={s?.colors?.resources ?? []}
                disabled={disabled}
                onColorIdChange={(colorId) =>
                  setFormState((prev) => ({ ...prev, color_id: colorId }))
                }
                onGenerate={generateHandlers["colors"]}
                searchTerm={
                  (stepFormData["colorSearch"] as string | null | undefined) ||
                  ""
                }
                onSearchChange={(term) =>
                  setStepFormData({ colorSearch: term || null })
                }
                showSelectedFilter={colorShowSelected}
                onShowSelectedChange={(value) =>
                  setStepFormData({ colorShowSelected: value || null })
                }
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.colors?.show_ai_generate ?? false}
                createColorsAction={createColorsAction}
                required={s?.colors?.required ?? false}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["colors"]}
                create_tool_id={s?.colors?.tool_id ?? null}
              />
            </StepCard>
          );
        }

        case "icon": {
          const iconShowSelected =
            (stepFormData["iconShowSelected"] as boolean | null | undefined) ??
            false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={
                (stepFormData["iconSearch"] as string | null | undefined) || ""
              }
              onSearchChange={(term: string) =>
                setStepFormData({ iconSearch: term || null })
              }
              searchPlaceholder="Search icons..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: iconShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({ iconShowSelected: value || null }),
                },
              ]}
              resetFields={["icon", "iconSearch", "iconShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["icon"]?.length ? (
                  <StepCardAiButton
                    stepId="icon"
                    resourceTypes={stepResources["icon"]!}
                    canRegenerate={canRegenerate}
                    isGenerating={isGenerating}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Icons
                icon_id={formState.icon_id ?? null}
                icon_resource={s?.icons?.resource ?? null}
                show_icon={s?.icons?.show ?? false}
                icon_suggestions={s?.icons?.suggestions ?? []}
                icons={s?.icons?.resources ?? []}
                disabled={disabled}
                onIconIdChange={(iconId) =>
                  setFormState((prev) => ({ ...prev, icon_id: iconId }))
                }
                onGenerate={generateHandlers["icons"]}
                searchTerm={
                  (stepFormData["iconSearch"] as string | null | undefined) ||
                  ""
                }
                onSearchChange={(term) =>
                  setStepFormData({ iconSearch: term || null })
                }
                showSelectedFilter={iconShowSelected}
                onShowSelectedChange={(value) =>
                  setStepFormData({ iconShowSelected: value || null })
                }
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.icons?.show_ai_generate ?? false}
                required={s?.icons?.required ?? false}
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
              resetFields={["instructions", "examples", "voice_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["content"]?.length &&
                (s?.content_show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="content"
                    resourceTypes={stepResources["content"]!}
                    canRegenerate={canRegenerate}
                    isGenerating={isGenerating}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Instructions
                instructions_id={formState.instructions_id ?? null}
                instructions_resource={
                  formState.instructions_id
                    ? (s?.instructions?.resource ?? null)
                    : null
                }
                show_instructions={s?.instructions?.show ?? true}
                instructions_suggestions={s?.instructions?.suggestions ?? []}
                instructions={s?.instructions?.resources ?? []}
                disabled={disabled}
                onInstructionsIdChange={(instructionsId) =>
                  setFormState((prev) => ({
                    ...prev,
                    instructions_id: instructionsId,
                  }))
                }
                searchTerm={
                  (stepFormData["instructionsSearch"] as
                    | string
                    | null
                    | undefined) || ""
                }
                onSearchChange={(term: string) =>
                  setStepFormData({ instructionsSearch: term || null })
                }
                onGenerate={generateHandlers["instructions"]}
                label="Instructions"
                placeholder="Instructions that define how the persona should behave and respond."
                required={s?.instructions?.required ?? false}
                rows={8}
                helpText="Define the persona's behavior, communication style, and response patterns"
                data-testid="input-instructions"
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.instructions?.show_ai_generate ?? false}
                createInstructionsAction={createInstructionsAction}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["instructions"]}
                create_tool_id={s?.instructions?.tool_id ?? null}
              />
              <Examples
                example_ids={formState.example_ids ?? []}
                example_resources={s?.examples?.current ?? []}
                show_examples={s?.examples?.show ?? false}
                example_suggestions={s?.examples?.suggestions ?? []}
                examples={s?.examples?.resources ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, example_ids: ids }))
                }
                onGenerate={generateHandlers["examples"]}
                maxItems={10}
                addButtonLabel="Add example"
                itemPlaceholder="Message"
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.examples?.show_ai_generate ?? false}
                createExamplesAction={
                  createExamplesAction
                    ? async (input: {
                        body: {
                          group_id: string;
                          example: string;
                          mcp?: boolean;
                        };
                      }) => {
                        return await createExamplesAction({
                          body: { ...input.body, mcp: input.body.mcp ?? false },
                        });
                      }
                    : undefined
                }
                required={s?.examples?.required ?? false}
                exampleMapping={
                  s?.examples?.resources && formState.example_ids
                    ? Object.fromEntries(
                        s.examples.resources
                          .map((ex, idx) => [
                            formState.example_ids?.[idx] || "",
                            ex.example || "",
                          ])
                          .filter(([id]) => id),
                      )
                    : {}
                }
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["examples"]}
                create_tool_id={s?.examples?.tool_id ?? null}
              />
              <Voices
                voice_ids={formState.voice_ids ?? []}
                voice_resources={s?.voices?.current ?? []}
                show_voices={s?.voices?.show ?? false}
                voice_suggestions={s?.voices?.suggestions ?? []}
                voices={s?.voices?.resources ?? []}
                disabled={disabled}
                onVoiceIdsChange={(ids) =>
                  setFormState((prev) => ({ ...prev, voice_ids: ids }))
                }
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.voices?.show_ai_generate ?? false}
                onGenerate={generateHandlers["voices"]}
                create_tool_id={s?.voices?.tool_id ?? null}
                createVoicesAction={createVoicesAction}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["voices"]}
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
      generateHandlers,
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
      formState.voice_ids,
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
      createVoicesAction,
      makeOnGenerationComplete,
    ],
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
          nuqsParsers={
            personaSearchParamsClient as Record<string, Parser<unknown>>
          }
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

        {modalProps.open && <GenerateRegenerateModal {...modalProps} />}
      </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(PersonaComponent, (prevProps, nextProps) => {
  // Compare section-based current resource IDs
  const prevData = prevProps.personaData;
  const nextData = nextProps.personaData;
  const prevIds = {
    name_id: prevData?.names?.resource?.id ?? null,
    description_id: prevData?.descriptions?.resource?.id ?? null,
    color_id: prevData?.colors?.resource?.id ?? null,
    icon_id: prevData?.icons?.resource?.id ?? null,
    instructions_id: prevData?.instructions?.resource?.id ?? null,
    active_flag_id: prevData?.flags?.current?.flag_option_id ?? null,
    department_ids: (prevData?.departments?.current ?? [])
      .map((d) => d.department_id)
      .filter(Boolean),
    parameter_field_ids: (prevData?.parameter_fields?.current ?? [])
      .map((f) => f.field_id)
      .filter(Boolean),
    example_ids: (prevData?.examples?.current ?? [])
      .map((e) => e.id)
      .filter(Boolean),
  };
  const nextIds = {
    name_id: nextData?.names?.resource?.id ?? null,
    description_id: nextData?.descriptions?.resource?.id ?? null,
    color_id: nextData?.colors?.resource?.id ?? null,
    icon_id: nextData?.icons?.resource?.id ?? null,
    instructions_id: nextData?.instructions?.resource?.id ?? null,
    active_flag_id: nextData?.flags?.current?.flag_option_id ?? null,
    department_ids: (nextData?.departments?.current ?? [])
      .map((d) => d.department_id)
      .filter(Boolean),
    parameter_field_ids: (nextData?.parameter_fields?.current ?? [])
      .map((f) => f.field_id)
      .filter(Boolean),
    example_ids: (nextData?.examples?.current ?? [])
      .map((e) => e.id)
      .filter(Boolean),
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
    prevProps.createParameterFieldsAction !==
      nextProps.createParameterFieldsAction ||
    prevProps.createVoicesAction !== nextProps.createVoicesAction
  ) {
    return false;
  }

  return true;
});
