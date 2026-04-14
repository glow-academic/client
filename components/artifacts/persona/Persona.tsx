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
import { Voices } from "@/components/resources/Voices";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGenerationPanelContext } from "@/contexts/generation-panel-context";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { useGenerate } from "@/hooks/use-generate";
import { useGenerationDraft } from "@/hooks/use-generation-draft";
import { usePersonaGeneration } from "@/hooks/use-persona-generation";

import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";

import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  type ResourceConfig,
  buildDraftPayload,
  checkHasResourceIds,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsArrayOf, parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type CreatePersonaIn = InputOf<"/personas/create", "post">;
type CreatePersonaOut = OutputOf<"/personas/create", "post">;
type UpdatePersonaIn = InputOf<"/personas/update", "post">;
type UpdatePersonaOut = OutputOf<"/personas/update", "post">;
type PatchPersonaDraftIn = InputOf<"/personas/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<
  "/personas/draft",
  "patch"
>;

type PersonaData = OutputOf<"/personas/get", "post">;

type PersonaFormState = {
  // ID fields
  name_id: string | null;
  description_id: string | null;
  color_id: string | null;
  icon_id: string | null;
  instructions_id: string | null;
  active_flag_id: string | null;
  department_ids: string[];
  parameter_field_ids: string[];
  example_ids: string[];
  voice_ids: string[];
  // Value fields for creatables (sent to draft endpoint when set)
  name: string | null;
  description: string | null;
  instructions: string | null;
  examples: string[];
  // Pending resource IDs (connections with active=false, awaiting acceptance)
  pending_ids: string[];
};

export interface PersonaProps {
  personaId?: string;
  // Server-provided group ID (SSR-hydrated from /personas/group)
  groupId?: string | null;
  // Server-provided data (for server-side rendering)
  personaData?: PersonaData;
  // Server actions — separate create/update for explicit intent
  createPersonaAction?: (input: CreatePersonaIn) => Promise<CreatePersonaOut>;
  updatePersonaAction?: (input: UpdatePersonaIn) => Promise<UpdatePersonaOut>;
  patchPersonaDraftAction?: (
    input: PatchPersonaDraftIn,
  ) => Promise<PatchPersonaDraftOut>;
  // Generation action (artifact-specific)
  generateAction?: (input: any) => Promise<any>;
}

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
  { key: "icons", formKey: "icon_id", flushKey: "icon_id", type: "single" },
  {
    key: "instructions",
    formKey: "instructions_id",
    flushKey: "instructions_id",
    type: "single",
  },
  { key: "flags", formKey: "active_flag_id", flushKey: "active_flag_id", type: "single" },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: "department_ids",
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
    key: "voices",
    formKey: "voice_ids",
    flushKey: "voice_ids",
    type: "multi",
  },
];

function PersonaComponent({
  personaId,
  groupId: groupIdProp,
  personaData,
  createPersonaAction,
  updatePersonaAction,
  patchPersonaDraftAction,
  generateAction,
}: PersonaProps) {
  const router = useRouter();
  const isEditMode = !!personaId;
  const { profile } = useProfile();
  const { setSelectedDraftId, isAutosaveEnabled } = useDrafts();
  const groupId = groupIdProp ?? null;

  // Register groupId + onGenerate in the generation panel context
  const panelContext = useGenerationPanelContext();
  useEffect(() => {
    if (panelContext && groupId) {
      panelContext.setGroupId(groupId);
      panelContext.setGroupCompletedEvent("persona.group.completed");
    }
    return () => {
      if (panelContext) {
        panelContext.setGroupId(null);
        panelContext.setGroupCompletedEvent(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    if (panelContext && generateAction && groupId) {
      panelContext.setOnGenerate(async (params) => {
        await generateAction({
          body: {
            group_id: groupId,
            resource_types: params.resource_types,
            user_instructions: params.instructions ? [params.instructions] : [],
            dangerous: params.dangerous ?? false,
          },
        });
      });
    }
    return () => {
      if (panelContext) panelContext.setOnGenerate(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateAction, groupId]);

  // Empty flush registry — resource creation is handled by the unified draft endpoint
  const emptyFlushRegistryRef = useRef<
    Map<string, () => Promise<Record<string, unknown> | void>>
  >(new Map());

  // --- AI Generation State ---
  const { isGenerating: isGeneratingBool, generate } =
    useGenerate({
      permissions: [
        { artifact: "persona", operation: "draft" },
        { artifact: "persona", operation: "get" },
        { artifact: "persona", operation: "docs" },
        { artifact: "persona", operation: "group" },
      ],
      resources: [],
      groupId: groupId,
    });

  // Wrap boolean into function for StepCardAiButton compatibility
  const isGenerating = useCallback(
    (_resourceType?: string) => isGeneratingBool,
    [isGeneratingBool],
  );

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  const personaSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      colorSearch: parseAsString,
      iconSearch: parseAsString,
      descriptionSearch: parseAsString,
      instructionsSearch: parseAsString,
      parameterFieldSearch: parseAsString,
      colorShowSelected: parseAsBoolean,
      iconShowSelected: parseAsBoolean,
      parameterFieldShowSelected: parseAsBoolean,
      parameterIds: parseAsArrayOf(parseAsString),
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
      show_ai_generate: personaData.show_ai_generate,
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
    personaData?.show_ai_generate,
  ]);

  const canRegenerate = useCallback(
    (resourceType: string): boolean => {
      if (!stablePersonaDataFields) return false;
      switch (resourceType) {
        case "names":
          return stablePersonaDataFields.names?.find((n: any) => n.selected)?.generated ?? false;
        case "descriptions":
          return (
            stablePersonaDataFields.descriptions?.find((d: any) => d.selected)?.generated ?? false
          );
        case "colors":
          return stablePersonaDataFields.colors?.find((c: any) => c.selected)?.generated ?? false;
        case "icons":
          return stablePersonaDataFields.icons?.find((i: any) => i.selected)?.generated ?? false;
        case "instructions":
          return (
            stablePersonaDataFields.instructions?.find((i: any) => i.selected)?.generated ?? false
          );
        case "flags":
          return (
            stablePersonaDataFields.flags?.[0]?.generated ?? false
          );
        case "departments":
          return (
            stablePersonaDataFields.departments?.filter((d: any) => d.selected)?.some(
              (d) => d.generated,
            ) ?? false
          );
        case "parameter_fields":
          return (
            stablePersonaDataFields.parameter_fields?.filter((p: any) => p.selected)?.some(
              (f) => f.generated,
            ) ?? false
          );
        case "examples":
          return (
            stablePersonaDataFields.examples?.filter((e: any) => e.selected)?.some(
              (e) => e.generated,
            ) ?? false
          );
        case "voices":
          return (
            stablePersonaDataFields.voices?.filter((v: any) => v.selected)?.some(
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
        voice_ids: [],
        name: null,
        description: null,
        instructions: null,
        examples: [],
        pending_ids: [],
      };
    }

    return {
      name_id: data.names?.find((n: any) => n.selected)?.id ?? null,
      description_id: data.descriptions?.find((d: any) => d.selected)?.id ?? null,
      color_id: data.colors?.find((c: any) => c.selected)?.id ?? null,
      icon_id: data.icons?.find((i: any) => i.selected)?.id ?? null,
      instructions_id: data.instructions?.find((i: any) => i.selected)?.id ?? null,
      active_flag_id: data.flags?.find((f: any) => f.selected)?.flag_option_id ?? null,
      department_ids: (data.departments?.filter((d: any) => d.selected) ?? [])
        .map((d) => d.department_id)
        .filter(Boolean) as string[],
      parameter_field_ids: (data.parameter_fields?.filter((p: any) => p.selected) ?? [])
        .map((f) => f.field_id)
        .filter(Boolean) as string[],
      example_ids: (data.examples?.filter((e: any) => e.selected) ?? [])
        .map((e) => e.id)
        .filter(Boolean) as string[],
      voice_ids: (data.voices?.filter((v: any) => v.selected) ?? [])
        .map((v) => v.id)
        .filter(Boolean) as string[],
      // Value fields start null — IDs from server are the source of truth on load
      name: null,
      description: null,
      instructions: null,
      examples: [],
      // Collect all pending resource IDs from the API response
      pending_ids: [
        ...((data.names ?? []).filter((n: any) => n.pending).map((n: any) => n.id).filter(Boolean)),
        ...((data.descriptions ?? []).filter((d: any) => d.pending).map((d: any) => d.id).filter(Boolean)),
        ...((data.colors ?? []).filter((c: any) => c.pending).map((c: any) => c.id).filter(Boolean)),
        ...((data.icons ?? []).filter((i: any) => i.pending).map((i: any) => i.id).filter(Boolean)),
        ...((data.instructions ?? []).filter((i: any) => i.pending).map((i: any) => i.id).filter(Boolean)),
        ...((data.flags ?? []).filter((f: any) => f.pending).map((f: any) => f.flag_option_id).filter(Boolean)),
        ...((data.departments ?? []).filter((d: any) => d.pending).map((d: any) => d.department_id).filter(Boolean)),
        ...((data.parameter_fields ?? []).filter((p: any) => p.pending).map((p: any) => p.id).filter(Boolean)),
        ...((data.examples ?? []).filter((e: any) => e.pending).map((e: any) => e.id).filter(Boolean)),
        ...((data.voices ?? []).filter((v: any) => v.pending).map((v: any) => v.id).filter(Boolean)),
      ],
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
      (personaData?.departments?.filter((d: any) => d.selected) ?? [])
        .map((d) => d.department_id)
        .filter(Boolean),
    );
  }, [personaData?.departments]);
  const parameterFieldIdsStr = React.useMemo(() => {
    return JSON.stringify(
      (personaData?.parameter_fields?.filter((p: any) => p.selected) ?? [])
        .map((f) => f.field_id)
        .filter(Boolean),
    );
  }, [personaData?.parameter_fields]);
  const exampleIdsStr = React.useMemo(() => {
    return JSON.stringify(
      (personaData?.examples?.filter((e: any) => e.selected) ?? []).map((e) => e.id).filter(Boolean),
    );
  }, [personaData?.examples]);
  const voiceIdsStr = React.useMemo(() => {
    return JSON.stringify(
      (personaData?.voices?.filter((v: any) => v.selected) ?? []).map((v) => v.id).filter(Boolean),
    );
  }, [personaData?.voices]);

  // --- Draft Lifecycle ---
  const patchPersonaDraftActionRef = React.useRef(patchPersonaDraftAction);
  React.useEffect(() => {
    patchPersonaDraftActionRef.current = patchPersonaDraftAction;
  }, [patchPersonaDraftAction]);

  // Stable ref wrapper for patch action — handles form_state sync from response
  const patchActionRef = React.useRef<
    | ((
        payload: Record<string, unknown>,
      ) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);

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
  const formStateVoiceIdsStr = React.useMemo(
    () => JSON.stringify(formState.voice_ids),
    [formState.voice_ids],
  );

  // Memoize stringified value fields
  const formStateExamplesStr = React.useMemo(
    () => JSON.stringify(formState.examples),
    [formState.examples],
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
        voice_ids: formState.voice_ids,
        // Value fields for creatables — trigger autosave when text changes
        name: formState.name,
        description: formState.description,
        instructions: formState.instructions,
        examples: formState.examples,
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
      formStateVoiceIdsStr,
      formState.name,
      formState.description,
      formState.instructions,
      formStateExamplesStr,
    ],
  );

  const hasResourceIds =
    checkHasResourceIds(
      PERSONA_RESOURCES,
      formState as unknown as Record<string, unknown>,
    ) ||
    !!formState.name ||
    !!formState.description ||
    !!formState.instructions ||
    formState.examples.length > 0;

  const buildPatchPayload = useCallback(
    (
      draftId: string | null,
      flushResults?: Record<string, unknown>,
    ): Record<string, unknown> => {
      const current = formStateRef.current as unknown as PersonaFormState;
      const ref = lastPatchedFormStateRef.current;

      // Build ID-only payload for non-creatable resources
      const idPayload = buildDraftPayload(PERSONA_RESOURCES, {
        formState: formStateRef.current,
        referenceState: lastPatchedFormStateRef.current as unknown as Record<
          string,
          unknown
        > | null,
        flushResults: (flushResults ?? {}) as Record<string, unknown>,
      });

      // Add value fields for creatables (value takes precedence over ID)
      if (current.name != null) {
        if (!ref || current.name !== ref.name) {
          idPayload["name"] = current.name;
          delete idPayload["name_id"];
        }
      }
      if (current.description != null) {
        if (!ref || current.description !== ref.description) {
          idPayload["description"] = current.description;
          delete idPayload["description_id"];
        }
      }
      if (current.instructions != null) {
        if (!ref || current.instructions !== ref.instructions) {
          idPayload["instructions"] = current.instructions;
          delete idPayload["instructions_id"];
        }
      }
      if (current.examples.length > 0) {
        if (
          !ref ||
          JSON.stringify(current.examples) !== JSON.stringify(ref.examples)
        ) {
          idPayload["examples"] = current.examples;
          delete idPayload["example_ids"];
        }
      }

      // Include pending_ids if any resources are still pending
      const currentPendingIds = (formStateRef.current as unknown as PersonaFormState).pending_ids;
      return {
        input_draft_id: draftId || null,
        ...idPayload,
        ...(currentPendingIds?.length ? { pending_ids: currentPendingIds } : {}),
      };
    },
    [],
  );

  const onPatchSuccess = useCallback(() => {
    lastPatchedFormStateRef.current = {
      ...(formStateRef.current as unknown as PersonaFormState),
    };
  }, []);

  // --- Value Change Handlers (creatables report values upward) ---
  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({ ...prev, name: name || null, name_id: null }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setFormState((prev) => ({
      ...prev,
      description: description || null,
      description_id: null,
    }));
  }, []);

  const handleInstructionsChange = useCallback((instructions: string) => {
    setFormState((prev) => ({
      ...prev,
      instructions: instructions || null,
      instructions_id: null,
    }));
  }, []);

  const handleExamplesChange = useCallback((examples: string[]) => {
    setFormState((prev) => ({
      ...prev,
      examples: examples.filter(Boolean),
      example_ids: [],
    }));
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
    hasResourceIds,
    flushRegistryRef: emptyFlushRegistryRef,
    formStateRef,
    onPatchSuccess,
  });

  // --- AI Draft Sync (generic: update draftId when AI saves) ---
  useGenerationDraft({
    artifactType: "persona",
    groupId: groupId,
    onDraftCompleted: (draftId) => {
      setUrlFormDataRef.current?.({ draftId });
      router.refresh();
    },
    onDraftFailed: (message) => {
      toast.error("AI draft failed", { description: message });
    },
  });

  // --- AI Persona Streaming (persona-specific: live field updates) ---
  usePersonaGeneration({
    groupId: groupId,
    onFieldsStreaming: (fields) => {
      setFormState((prev) => {
        const next = { ...prev };
        if (fields.color_id) next.color_id = fields.color_id as string;
        if (fields.name) next.name = fields.name as string;
        if (fields.name_id) next.name_id = fields.name_id as string;
        if (fields.description) next.description = fields.description as string;
        if (fields.description_id) next.description_id = fields.description_id as string;
        if (fields.icon_id) next.icon_id = fields.icon_id as string;
        if (fields.instructions) next.instructions = fields.instructions as string;
        if (fields.instructions_id) next.instructions_id = fields.instructions_id as string;
        return next;
      });
    },
  });

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
    personaData?.voices,
    departmentIdsStr,
    parameterFieldIdsStr,
    exampleIdsStr,
    voiceIdsStr,
  ]);

  React.useEffect(() => {
    if (patchPersonaDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        const result = await patchPersonaDraftAction({
          body: payload,
        } as PatchPersonaDraftIn);

        // Sync resolved IDs from server form_state (server is source of truth)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fs = (result as any)?.form_state as Record<string, unknown> | undefined;
        if (fs) {
          serverSyncPendingRef.current = true;
          setFormState((prev) => ({
            ...prev,
            name_id: (fs["name_id"] as string) ?? prev.name_id,
            description_id: (fs["description_id"] as string) ?? prev.description_id,
            instructions_id: (fs["instructions_id"] as string) ?? prev.instructions_id,
            color_id: (fs["color_id"] as string) ?? prev.color_id,
            icon_id: (fs["icon_id"] as string) ?? prev.icon_id,
            active_flag_id: (fs["active_flag_id"] as string) ?? prev.active_flag_id,
            department_ids: (fs["department_ids"] as string[]) ?? prev.department_ids,
            parameter_field_ids: (fs["parameter_field_ids"] as string[]) ?? prev.parameter_field_ids,
            example_ids: (fs["example_ids"] as string[]) ?? prev.example_ids,
            voice_ids: (fs["voice_ids"] as string[]) ?? prev.voice_ids,
          }));
        }

        return result;
      };
    } else {
      patchActionRef.current = undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patchPersonaDraftAction]);

  // --- Initialize URL parameterIds from server resolved_parameter_ids ---
  const hasInitializedParameterIds = useRef(false);
  useEffect(() => {
    const resolvedIds = (personaData as PersonaData & { resolved_parameter_ids?: string[] | null })?.resolved_parameter_ids;
    if (!hasInitializedParameterIds.current) {
      hasInitializedParameterIds.current = true;
      if (setUrlFormDataRef.current) {
        // Set resolved IDs, or null to remove empty ?parameterIds= from URL
        setUrlFormDataRef.current({
          parameterIds: resolvedIds && resolvedIds.length > 0 ? resolvedIds : null,
        });
      }
    }
  }, [personaData, setUrlFormDataRef]);

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

      generate(
        userInstructions || `Generate ${resourceTypes.join(", ")}`,
        {
          resources: resourceTypes,
          artifactId: personaId ?? undefined,
          params: { draft_id: draftIdToUse },
        },
      );
    },
    [
      flushAllAndSave,
      formDataRef,
      generate,
      personaId,
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

  // Direct step generation — bypasses modal, generates all resources for the step
  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources) {
        handleGenerateResources(resources);
      }
    },
    [stepResources, handleGenerateResources],
  );


  // --- Pending state helpers per step ---
  const stepHasPending = useCallback(
    (stepId: string): boolean => {
      const pendingSet = new Set(formState.pending_ids);
      if (pendingSet.size === 0) return false;
      const data = personaDataRef.current;
      if (!data) return false;
      const resources = stepResources[stepId] ?? [];
      for (const rt of resources) {
        const items = (data as any)[rt] ?? [];
        for (const item of items) {
          const itemId = item.id ?? item.department_id ?? item.flag_option_id;
          if (itemId && pendingSet.has(itemId)) return true;
        }
      }
      return false;
    },
    [formState.pending_ids, stepResources],
  );

  const handleAcceptAllForStep = useCallback(
    (stepId: string) => {
      const data = personaDataRef.current;
      if (!data) return;
      const resources = stepResources[stepId] ?? [];
      const idsToAccept: string[] = [];
      for (const rt of resources) {
        const items = (data as any)[rt] ?? [];
        for (const item of items) {
          if (item.pending) {
            const itemId = item.id ?? item.department_id ?? item.flag_option_id;
            if (itemId) idsToAccept.push(itemId);
          }
        }
      }
      // Remove accepted IDs from pending_ids (keep in form state = confirmed)
      setFormState((prev) => ({
        ...prev,
        pending_ids: prev.pending_ids.filter((id) => !idsToAccept.includes(id)),
      }));
    },
    [stepResources],
  );

  const handleRejectAllForStep = useCallback(
    (stepId: string) => {
      const data = personaDataRef.current;
      if (!data) return;
      const resources = stepResources[stepId] ?? [];
      const idsToReject: string[] = [];
      for (const rt of resources) {
        const items = (data as any)[rt] ?? [];
        for (const item of items) {
          if (item.pending) {
            const itemId = item.id ?? item.department_id ?? item.flag_option_id;
            if (itemId) idsToReject.push(itemId);
          }
        }
      }
      const rejectSet = new Set(idsToReject);
      // Remove from both form state and pending_ids
      setFormState((prev) => ({
        ...prev,
        name_id: rejectSet.has(prev.name_id ?? "") ? null : prev.name_id,
        description_id: rejectSet.has(prev.description_id ?? "") ? null : prev.description_id,
        color_id: rejectSet.has(prev.color_id ?? "") ? null : prev.color_id,
        icon_id: rejectSet.has(prev.icon_id ?? "") ? null : prev.icon_id,
        instructions_id: rejectSet.has(prev.instructions_id ?? "") ? null : prev.instructions_id,
        active_flag_id: rejectSet.has(prev.active_flag_id ?? "") ? null : prev.active_flag_id,
        department_ids: prev.department_ids.filter((id) => !rejectSet.has(id)),
        parameter_field_ids: prev.parameter_field_ids.filter((id) => !rejectSet.has(id)),
        example_ids: prev.example_ids.filter((id) => !rejectSet.has(id)),
        voice_ids: prev.voice_ids.filter((id) => !rejectSet.has(id)),
        pending_ids: prev.pending_ids.filter((id) => !rejectSet.has(id)),
      }));
    },
    [stepResources],
  );

  // --- Disabled / Breadcrumb ---
  const disabled = useMemo(() => {
    if (!personaData) return false;
    return !personaData.can_edit;
  }, [personaData]);

  // --- Submit ---
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      const fs = formStateRef.current as unknown as PersonaFormState;

      // Validate required fields (check value OR ID for creatables)
      if (!fs.name_id && !fs.name) {
        toast.error("Persona name is required");
        throw new Error("Persona name is required");
      }
      if (!fs.color_id) {
        toast.error("Persona color is required");
        throw new Error("Persona color is required");
      }
      if (!fs.icon_id) {
        toast.error("Persona icon is required");
        throw new Error("Persona icon is required");
      }
      if (!fs.instructions_id && !fs.instructions) {
        toast.error("Instructions are required");
        throw new Error("Instructions are required");
      }

      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      // Build common fields (dual-mode: ID or value for creatables)
      const commonFields = {
        name_id: fs.name_id ?? undefined,
        name: !fs.name_id ? (fs.name ?? undefined) : undefined,
        color_id: fs.color_id ?? undefined,
        icon_id: fs.icon_id ?? undefined,
        instructions_id: fs.instructions_id ?? undefined,
        instructions: !fs.instructions_id ? (fs.instructions ?? undefined) : undefined,
        description_id: fs.description_id ?? undefined,
        description: !fs.description_id ? (fs.description ?? undefined) : undefined,
        active_flag_id: fs.active_flag_id ?? undefined,
        department_ids: fs.department_ids?.length ? fs.department_ids : undefined,
        parameter_field_ids: fs.parameter_field_ids?.length ? fs.parameter_field_ids : undefined,
        example_ids: fs.example_ids?.length ? fs.example_ids : undefined,
        examples: !fs.example_ids?.length && fs.examples?.length ? fs.examples : undefined,
        voice_ids: fs.voice_ids?.length ? fs.voice_ids : undefined,
      };

      try {
        if (isEditMode && personaId && updatePersonaAction) {
          await updatePersonaAction({
            body: {
              personas: [{ persona_id: personaId, ...commonFields }],
            },
          } as UpdatePersonaIn);
        } else if (createPersonaAction) {
          await createPersonaAction({
            body: {
              personas: [commonFields],
            },
          } as CreatePersonaIn);
        } else {
          toast.error("Action not available");
          throw new Error("No create or update action available");
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isEditMode,
      personaId,
      profile?.id,
      createPersonaAction,
      updatePersonaAction,
      router,
    ],
  );

  // --- Step Status ---
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id || !!formState.name;
      const hasDescription = !!formState.description_id || !!formState.description;
      const hasColor = !!formState.color_id;
      const hasIcon = !!formState.icon_id;
      const hasInstructions = !!formState.instructions_id || !!formState.instructions;
      const hasParameters = formState.parameter_field_ids.length > 0;

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
          "parameter_field_ids",
          "parameterFieldSearch",
          "parameterFieldShowSelected",
          "parameterIds",
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
                  name_resource={s?.names?.find((n: any) => n.selected) ?? null}
                  show_name={true}
                  names={s?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({
                      ...prev,
                      name_id: nameId,
                      name: null,
                      // If accepting, remove from pending; if rejecting (null), also remove
                      pending_ids: prev.pending_ids.filter((id) => {
                        const prevNameId = prev.name_id;
                        return id !== prevNameId;
                      }),
                    }))
                  }
                  onNameChange={handleNameChange}
                  onGenerate={generateHandlers["names"]}
                  placeholder="e.g., Enthusiastic Student"
                  defaultName="New Persona"
                  required={true}
                  hideDescription={true}

                  showAiGenerate={false}
                  isAutosaveEnabled={isAutosaveEnabled}
                />
              }
              resetFields={["name", "description", "department_ids", "active"]}
              actions={
                stepResources["basic"]?.length &&
                (s?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]!}
                    canRegenerate={canRegenerate}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                    hasPending={stepHasPending("basic")}
                    onAcceptAll={() => handleAcceptAllForStep("basic")}
                    onRejectAll={() => handleRejectAllForStep("basic")}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={s?.descriptions?.find((d: any) => d.selected) ?? null}
                  show_description={true}
                  descriptions={s?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                      description: null,
                      pending_ids: prev.pending_ids.filter((id) => id !== prev.description_id),
                    }))
                  }
                  onDescriptionChange={handleDescriptionChange}
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
                  required={false}
                  rows={4}
                  data-testid="input-persona-description"

                  showAiGenerate={false}
                  isAutosaveEnabled={isAutosaveEnabled}
                />
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={s?.departments?.filter((d: any) => d.selected) ?? []}
                  show_departments={true}
                  departments={s?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => {
                      // Remove accepted/rejected department IDs from pending
                      const removedIds = prev.department_ids.filter((id) => !ids.includes(id));
                      return {
                        ...prev,
                        department_ids: ids,
                        pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                      };
                    })
                  }
                  required={false}

                  showAiGenerate={false}
                  isAutosaveEnabled={isAutosaveEnabled}
                />
                <Flags
                  flags={s?.flags ?? []}
                  flag_id={formState.active_flag_id}
                  show_flags={true}
                  columns={1}
                  label="Flags"
                  disabled={disabled}

                  showAiGenerate={false}
                  isAutosaveEnabled={isAutosaveEnabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                      pending_ids: prev.pending_ids.filter((id) => id !== prev.active_flag_id),
                    }))
                  }
                  onGenerate={generateHandlers["flags"]}
                />
              </div>
            </StepCard>
          );

        case "parameters": {
          const urlParameterIds =
            ((stepFormData["parameterIds"] as string[] | null | undefined) ??
              []);
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={[
                "parameter_field_ids",
                "parameterFieldSearch",
                "parameterFieldShowSelected",
                "parameterIds",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["parameters"]?.length &&
                (s?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="parameters"
                    resourceTypes={stepResources["parameters"]!}
                    canRegenerate={canRegenerate}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                    hasPending={stepHasPending("parameters")}
                    onAcceptAll={() => handleAcceptAllForStep("parameters")}
                    onRejectAll={() => handleRejectAllForStep("parameters")}
                  />
                ) : undefined
              }
            >
              <ParameterFields
                parameterIds={urlParameterIds}
                parameterFieldIds={formState.parameter_field_ids}
                parameterFieldResources={s?.parameter_fields?.filter((p: any) => p.selected) ?? []}
                allParameters={s?.parameters ?? []}
                availableFields={s?.parameter_fields ?? []}
                onToggleParameter={(parameterId, open) => {
                  const current = urlParameterIds;
                  if (open) {
                    setStepFormData({
                      parameterIds: [...current, parameterId],
                    });
                  } else {
                    setStepFormData({
                      parameterIds: current.filter(
                        (id: string) => id !== parameterId
                      ),
                    });
                  }
                }}
                onChange={(ids) =>
                  setFormState((prev) => {
                    const removedIds = prev.parameter_field_ids.filter((id) => !ids.includes(id));
                    return {
                      ...prev,
                      parameter_field_ids: ids,
                      pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                    };
                  })
                }
                disabled={disabled}

                showAiGenerate={false}
                required={false}
                onGenerate={generateHandlers["parameter_fields"]}
                isAutosaveEnabled={isAutosaveEnabled}
              />
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
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                    hasPending={stepHasPending("color")}
                    onAcceptAll={() => handleAcceptAllForStep("color")}
                    onRejectAll={() => handleRejectAllForStep("color")}
                  />
                ) : undefined
              }
            >
              <Colors
                color_id={formState.color_id ?? null}
                color_resource={s?.colors?.find((c: any) => c.selected) ?? null}
                show_color={true}
                colors={s?.colors ?? []}
                disabled={disabled}
                onColorIdChange={(colorId) =>
                  setFormState((prev) => ({
                    ...prev,
                    color_id: colorId,
                    pending_ids: prev.pending_ids.filter((id) => id !== prev.color_id),
                  }))
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

                showAiGenerate={false}
                required={true}
                isAutosaveEnabled={isAutosaveEnabled}
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
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                    hasPending={stepHasPending("icon")}
                    onAcceptAll={() => handleAcceptAllForStep("icon")}
                    onRejectAll={() => handleRejectAllForStep("icon")}
                  />
                ) : undefined
              }
            >
              <Icons
                icon_id={formState.icon_id ?? null}
                icon_resource={s?.icons?.find((i: any) => i.selected) ?? null}
                show_icon={true}
                icons={s?.icons ?? []}
                disabled={disabled}
                onIconIdChange={(iconId) =>
                  setFormState((prev) => ({
                    ...prev,
                    icon_id: iconId,
                    pending_ids: prev.pending_ids.filter((id) => id !== prev.icon_id),
                  }))
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

                showAiGenerate={false}
                required={true}
                isAutosaveEnabled={isAutosaveEnabled}
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
                (s?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="content"
                    resourceTypes={stepResources["content"]!}
                    canRegenerate={canRegenerate}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                    hasPending={stepHasPending("content")}
                    onAcceptAll={() => handleAcceptAllForStep("content")}
                    onRejectAll={() => handleRejectAllForStep("content")}
                  />
                ) : undefined
              }
            >
              <Instructions
                instructions_id={formState.instructions_id ?? null}
                instructions_resource={
                  formState.instructions_id
                    ? (s?.instructions?.find((i: any) => i.selected) ?? null)
                    : null
                }
                show_instructions={true}
                instructions={s?.instructions ?? []}
                disabled={disabled}
                onInstructionsIdChange={(instructionsId) =>
                  setFormState((prev) => ({
                    ...prev,
                    instructions_id: instructionsId,
                    instructions: null,
                    pending_ids: prev.pending_ids.filter((id) => id !== prev.instructions_id),
                  }))
                }
                onInstructionsChange={handleInstructionsChange}
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
                required={true}
                rows={8}
                data-testid="input-instructions"

                showAiGenerate={false}
                isAutosaveEnabled={isAutosaveEnabled}
              />
              <Examples
                example_ids={formState.example_ids ?? []}
                example_resources={s?.examples?.filter((e: any) => e.selected) ?? []}
                show_examples={true}
                examples={s?.examples ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => {
                    const removedIds = prev.example_ids.filter((id) => !ids.includes(id));
                    return {
                      ...prev,
                      example_ids: ids,
                      examples: [],
                      pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                    };
                  })
                }
                onExamplesChange={handleExamplesChange}
                onGenerate={generateHandlers["examples"]}
                maxItems={10}
                addButtonLabel="Add example"
                itemPlaceholder="Message"

                showAiGenerate={false}
                required={false}
                exampleMapping={
                  s?.examples && formState.example_ids
                    ? Object.fromEntries(
                        s.examples
                          .map((ex, idx) => [
                            formState.example_ids?.[idx] || "",
                            ex.example || "",
                          ])
                          .filter(([id]) => id),
                      )
                    : {}
                }
              />
              <Voices
                voice_ids={formState.voice_ids ?? []}
                voice_resources={s?.voices?.filter((v: any) => v.selected) ?? []}
                show_voices={true}
                voices={s?.voices ?? []}
                disabled={disabled}
                onVoiceIdsChange={(ids) =>
                  setFormState((prev) => {
                    const removedIds = prev.voice_ids.filter((id) => !ids.includes(id));
                    return {
                      ...prev,
                      voice_ids: ids,
                      pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                    };
                  })
                }

                showAiGenerate={false}
                onGenerate={generateHandlers["voices"]}
                isAutosaveEnabled={isAutosaveEnabled}
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      stablePersonaDataFields,
      disabled,
      isEditMode,
      generateHandlers,
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
      formState.voice_ids,
      canRegenerate,
      handleDirectStepGenerate,
      isAutosaveEnabled,
      handleNameChange,
      handleDescriptionChange,
      handleInstructionsChange,
      handleExamplesChange,
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
    name_id: prevData?.names?.find((n: any) => n.selected)?.id ?? null,
    description_id: prevData?.descriptions?.find((d: any) => d.selected)?.id ?? null,
    color_id: prevData?.colors?.find((c: any) => c.selected)?.id ?? null,
    icon_id: prevData?.icons?.find((i: any) => i.selected)?.id ?? null,
    instructions_id: prevData?.instructions?.find((i: any) => i.selected)?.id ?? null,
    active_flag_id: prevData?.flags?.find((f: any) => f.selected)?.flag_option_id ?? null,
    department_ids: (prevData?.departments?.filter((d: any) => d.selected) ?? [])
      .map((d) => d.department_id)
      .filter(Boolean),
    parameter_field_ids: (prevData?.parameter_fields?.filter((p: any) => p.selected) ?? [])
      .map((f) => f.field_id)
      .filter(Boolean),
    example_ids: (prevData?.examples?.filter((e: any) => e.selected) ?? [])
      .map((e) => e.id)
      .filter(Boolean),
  };
  const nextIds = {
    name_id: nextData?.names?.find((n: any) => n.selected)?.id ?? null,
    description_id: nextData?.descriptions?.find((d: any) => d.selected)?.id ?? null,
    color_id: nextData?.colors?.find((c: any) => c.selected)?.id ?? null,
    icon_id: nextData?.icons?.find((i: any) => i.selected)?.id ?? null,
    instructions_id: nextData?.instructions?.find((i: any) => i.selected)?.id ?? null,
    active_flag_id: nextData?.flags?.find((f: any) => f.selected)?.flag_option_id ?? null,
    department_ids: (nextData?.departments?.filter((d: any) => d.selected) ?? [])
      .map((d) => d.department_id)
      .filter(Boolean),
    parameter_field_ids: (nextData?.parameter_fields?.filter((p: any) => p.selected) ?? [])
      .map((f) => f.field_id)
      .filter(Boolean),
    example_ids: (nextData?.examples?.filter((e: any) => e.selected) ?? [])
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
    prevProps.createPersonaAction !== nextProps.createPersonaAction ||
    prevProps.updatePersonaAction !== nextProps.updatePersonaAction ||
    prevProps.patchPersonaDraftAction !== nextProps.patchPersonaDraftAction
  ) {
    return false;
  }

  return true;
});
