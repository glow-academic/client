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
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { useSharedGenerationListener } from "@/hooks/use-artifact-generation-context";
import { useGenerationDraft } from "@/hooks/use-generation-draft";
import { useSidebar } from "@/components/ui/sidebar";
import { useTransport } from "@/lib/transport";

import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";

import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  type ResourceConfig,
  checkHasResourceIds,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsArrayOf, parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type CreatePersonaIn = InputOf<"/persona/create", "post">;
type CreatePersonaOut = OutputOf<"/persona/create", "post">;
type UpdatePersonaIn = InputOf<"/persona/update", "post">;
type UpdatePersonaOut = OutputOf<"/persona/update", "post">;
type PatchPersonaDraftIn = InputOf<"/persona/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<
  "/persona/draft",
  "patch"
>;

type PersonaData = OutputOf<"/persona/get", "post">;

type PersonaFormState = {
  // ID fields
  name_id: string | null;
  description_id: string | null;
  color_id: string | null;
  icon_id: string | null;
  instructions_id: string | null;
  // Canonical: ids of the flag-resource rows currently selected.
  flag_ids: string[];
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
  { key: "flags", formKey: "flag_ids", flushKey: null, type: "multi" },
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
}: PersonaProps) {
  const router = useRouter();
  const isEditMode = !!personaId;
  const { profile } = useProfile();
  const { setSelectedDraftId, isAutosaveEnabled } = useDrafts();
  const groupId = groupIdProp ?? null;

  // Empty flush registry — resource creation is handled by the unified draft endpoint
  const emptyFlushRegistryRef = useRef<
    Map<string, () => Promise<Record<string, unknown> | void>>
  >(new Map());

  // --- AI Generation State ---
  // Canonical path: subscribe to generation events via the shared transport
  // listener (same primitive the right-side GenerationPanel uses), and emit
  // requests through `transport.send("/persona/generate", ...)`. This collapses
  // the previous dual-path architecture (panel via transport, StepCard buttons
  // via raw socket) into one path that matches the attempt pattern.
  const transport = useTransport();
  // Shared listener mounted by FullPageLayout's GenerationListenerProvider.
  // One transport subscription serves both this component (for the
  // StepCard `isGenerating` flag) and the right-side GenerationPanel
  // (for message rendering). No double-subscribe.
  const generationListener = useSharedGenerationListener();
  const isGeneratingBool = generationListener.isGenerating;

  // Right-panel sidebar handle — Persona is mounted inside the inner
  // (right-side) SidebarProvider via FullPageLayout, so useSidebar() returns
  // the right panel's context. We auto-open it when a StepCard AI button is
  // clicked so users see the streaming tool calls / text.
  const { state: rightPanelState, setOpen: setRightPanelOpen } = useSidebar();

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
        flag_ids: [],
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
      flag_ids: (data.flags?.filter((f: any) => f.selected) ?? [])
        .map((f: any) => f.id)
        .filter((id: unknown): id is string => !!id),
      department_ids: (data.departments?.filter((d: any) => d.selected) ?? [])
        .map((d) => d.department_id)
        .filter(Boolean) as string[],
      parameter_field_ids: (data.parameter_fields?.filter((p: any) => p.selected) ?? [])
        .map((f) => f.id)
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
        ...((data.flags ?? []).filter((f: any) => f.pending).map((f: any) => f.id).filter(Boolean)),
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
        .map((f) => f.id)
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

  // formStateKey excludes draftId — the hook prepends it
  const formStateKey = React.useMemo(
    () =>
      JSON.stringify({
        name_id: formState.name_id,
        description_id: formState.description_id,
        color_id: formState.color_id,
        icon_id: formState.icon_id,
        instructions_id: formState.instructions_id,
        flag_ids: formState.flag_ids,
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.flag_ids),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.department_ids),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.parameter_field_ids),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.example_ids),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.voice_ids),
      formState.name,
      formState.description,
      formState.instructions,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.examples),
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
    (): Record<string, unknown> => {
      const current = formStateRef.current as unknown as PersonaFormState;

      // Append-only: always send full current state as a complete snapshot
      const payload: Record<string, unknown> = {};

      // For creatables: value takes precedence over ID
      if (current.name != null) {
        payload.name = current.name;
      } else if (current.name_id) {
        payload.name_id = current.name_id;
      }

      if (current.description != null) {
        payload.description = current.description;
      } else if (current.description_id) {
        payload.description_id = current.description_id;
      }

      if (current.instructions != null) {
        payload.instructions = current.instructions;
      } else if (current.instructions_id) {
        payload.instructions_id = current.instructions_id;
      }

      if (current.examples.length > 0) {
        payload.examples = current.examples;
      } else if (current.example_ids.length > 0) {
        payload.example_ids = current.example_ids;
      }

      // Non-creatable resources: always send IDs
      if (current.color_id) payload.color_id = current.color_id;
      if (current.icon_id) payload.icon_id = current.icon_id;
      if (current.flag_ids.length > 0) payload["flag_ids"] = current.flag_ids;
      if (current.department_ids.length > 0) payload.department_ids = current.department_ids;
      if (current.parameter_field_ids.length > 0) payload.parameter_field_ids = current.parameter_field_ids;
      if (current.voice_ids.length > 0) payload.voice_ids = current.voice_ids;

      // Pending state
      if (current.pending_ids.length > 0) payload.pending_ids = current.pending_ids;

      return payload;
    },
    [],
  );

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
    // Resolve text→id against SSR examples. If every text matches an existing
    // example, route via example_ids instead of creating duplicate resources.
    // Why: tab-to-autocomplete fills in a suggestion's exact text; sending it as
    // `examples: [...]` would make the server create a new resource (or churn
    // on dedup) every save, producing the "indefinite saving" loop.
    const textToId = new Map<string, string>();
    for (const ex of stablePersonaDataFields?.examples ?? []) {
      if (ex.id && ex.example) textToId.set(ex.example, ex.id);
    }
    const texts = examples.filter(Boolean);
    const resolvedIds = texts.map((t) => textToId.get(t));
    const allResolved = texts.length > 0 && resolvedIds.every((id) => !!id);

    setFormState((prev) => {
      if (allResolved) {
        return {
          ...prev,
          example_ids: resolvedIds as string[],
          examples: [],
        };
      }
      return {
        ...prev,
        examples: texts,
        example_ids: [],
      };
    });
  }, [stablePersonaDataFields?.examples]);

  const handleParameterFieldIdsChange = useCallback((ids: string[]) => {
    setFormState((prev) => {
      const removedIds = prev.parameter_field_ids.filter((id) => !ids.includes(id));
      return {
        ...prev,
        parameter_field_ids: ids,
        pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
      };
    });
  }, []);

  const handleExampleIdsChange = useCallback((ids: string[]) => {
    setFormState((prev) => {
      const removedIds = prev.example_ids.filter((id) => !ids.includes(id));
      return {
        ...prev,
        example_ids: ids,
        examples: [],
        pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
      };
    });
  }, []);

  // Stable id→text mapping, paired by example id (not index). Only includes examples
  // present in SSR data; newly created examples won't be here, which is the signal
  // for Examples.tsx to leave user-typed text alone instead of overwriting it.
  const exampleMapping = useMemo(() => {
    const mapping: Record<string, string> = {};
    for (const ex of stablePersonaDataFields?.examples ?? []) {
      if (ex.id && ex.example) {
        mapping[ex.id] = ex.example;
      }
    }
    return mapping;
  }, [stablePersonaDataFields?.examples]);

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
        JSON.stringify(prev.flag_ids) !== JSON.stringify(newState.flag_ids) ||
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
          setFormState((prev) => {
            const next = {
              ...prev,
              // Sync resolved IDs and clear value fields — server created the resource,
              // so the ID is now the source of truth. Keeping the value would cause
              // infinite re-saves (value takes precedence → creates new resource → new ID → repeat).
              name_id: (fs["name_id"] as string) ?? prev.name_id,
              name: fs["name_id"] ? null : prev.name,
              description_id: (fs["description_id"] as string) ?? prev.description_id,
              description: fs["description_id"] ? null : prev.description,
              instructions_id: (fs["instructions_id"] as string) ?? prev.instructions_id,
              instructions: fs["instructions_id"] ? null : prev.instructions,
              color_id: (fs["color_id"] as string) ?? prev.color_id,
              icon_id: (fs["icon_id"] as string) ?? prev.icon_id,
              flag_ids: (fs["flag_ids"] as string[] | null) ?? prev.flag_ids,
              department_ids: (fs["department_ids"] as string[]) ?? prev.department_ids,
              parameter_field_ids: (fs["parameter_field_ids"] as string[]) ?? prev.parameter_field_ids,
              example_ids: (fs["example_ids"] as string[]) ?? prev.example_ids,
              examples: (fs["example_ids"] as string[])?.length ? [] : prev.examples,
              voice_ids: (fs["voice_ids"] as string[]) ?? prev.voice_ids,
            };
            // Only set the server-sync "absorb" flag when the state actually changes.
            // If we set it unconditionally, the flag can stick (when server returns the
            // same values the client already has — e.g. after a picker selection) and
            // silently absorb the NEXT user action. Why: the autosave effect only runs
            // when draftPatchKey changes, so an unchanged sync never consumes the flag.
            const changed =
              prev.name_id !== next.name_id ||
              prev.name !== next.name ||
              prev.description_id !== next.description_id ||
              prev.description !== next.description ||
              prev.instructions_id !== next.instructions_id ||
              prev.instructions !== next.instructions ||
              prev.color_id !== next.color_id ||
              prev.icon_id !== next.icon_id ||
              JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
              JSON.stringify(prev.department_ids) !== JSON.stringify(next.department_ids) ||
              JSON.stringify(prev.parameter_field_ids) !== JSON.stringify(next.parameter_field_ids) ||
              JSON.stringify(prev.example_ids) !== JSON.stringify(next.example_ids) ||
              JSON.stringify(prev.examples) !== JSON.stringify(next.examples) ||
              JSON.stringify(prev.voice_ids) !== JSON.stringify(next.voice_ids);
            if (!changed) return prev;
            serverSyncPendingRef.current = true;
            return next;
          });
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

      // Auto-open the right-side generation panel so the user can see the
      // tool-call / text stream that's about to start.
      if (rightPanelState !== "expanded") {
        setRightPanelOpen(true);
      }

      const params: Record<string, string> = {
        draft_id: draftIdToUse,
        ...(personaId ? { artifact_id: personaId } : {}),
      };

      const instructions = userInstructions
        ? [userInstructions]
        : [`Generate ${resourceTypes.join(", ")}`];

      try {
        generationListener.setGenerating(true);
        // Pre-latch the URL to the group we're about to target —
        // mirrors how `draftId` is latched before save. If the user
        // refreshes mid-generate, SSR resolves back to the same
        // group and picks up the in-progress run.
        if (groupId) {
          generationListener.latchGroupId(groupId);
        }
        await transport.send("/persona/generate", {
          instructions,
          config: {
            // resource types ARE the operations in the StepCard flow (matches
            // what the old useGenerate hook emitted as `operations`).
            operations: resourceTypes,
            dangerous: true,
            group_id: groupId,
            params,
          },
        });
      } catch (err) {
        generationListener.setError(
          err instanceof Error ? err.message : "Generate request failed",
        );
      }
    },
    [
      flushAllAndSave,
      formDataRef,
      personaId,
      transport,
      generationListener,
      groupId,
      rightPanelState,
      setRightPanelOpen,
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
          const itemId = item.id ?? item.department_id;
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
            const itemId = item.id ?? item.department_id;
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
            const itemId = item.id ?? item.department_id;
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
        flag_ids: prev.flag_ids.filter((id) => !rejectSet.has(id)),
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
        // Canonical flag_ids — server resolves per-type semantics (incl. persona_active).
        flag_ids: fs.flag_ids?.length ? fs.flag_ids : undefined,
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
              personas: [{ id: personaId, ...commonFields }],
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

  // --- Flag helpers (canonical flag_ids pattern) ---
  const flagValues = useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (stablePersonaDataFields?.flags ?? [])
        .filter((f: any) => f.id)
        .map((f: any) => [f.id as string, f]),
    );
    for (const id of formState.flag_ids) {
      const row: any = byId.get(id);
      if (!row) continue;
      const type = row.type ?? row.name;
      if (type && row.value != null) map[type] = row.value;
    }
    return map;
  }, [formState.flag_ids, stablePersonaDataFields?.flags]);

  const flagRowsByType = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const f of stablePersonaDataFields?.flags ?? []) {
      const t = (f as any).type ?? (f as any).name;
      if (!t) continue;
      const list = map.get(t) ?? [];
      list.push(f);
      map.set(t, list);
    }
    return map;
  }, [stablePersonaDataFields?.flags]);

  const handleFlagToggle = useCallback(
    (type: string, next: boolean | null) => {
      setFormState((prev) => {
        const rows = flagRowsByType.get(type) ?? [];
        const rowIdsForType = new Set(
          rows.map((r) => r.id).filter((id): id is string => !!id),
        );
        const retained = prev.flag_ids.filter((id) => !rowIdsForType.has(id));
        const target =
          next == null ? null : rows.find((r) => r.value === next)?.id ?? null;
        const nextIds = target ? [...retained, target] : retained;
        const removedIds = prev.flag_ids.filter((id) => !nextIds.includes(id));
        return {
          ...prev,
          flag_ids: nextIds,
          pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
        };
      });
    },
    [flagRowsByType],
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
                  values={flagValues}
                  show_flags={true}
                  columns={1}
                  label="Flags"
                  disabled={disabled}
                  onChange={handleFlagToggle}
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
                onChange={handleParameterFieldIdsChange}
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
                onChange={handleExampleIdsChange}
                onExamplesChange={handleExamplesChange}
                onGenerate={generateHandlers["examples"]}
                maxItems={10}
                addButtonLabel="Add example"
                itemPlaceholder="Message"

                showAiGenerate={false}
                required={false}
                exampleMapping={exampleMapping}
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
      formState.flag_ids,
      formState.department_ids,
      formState.parameter_field_ids,
      formState.example_ids,
      formState.voice_ids,
      flagValues,
      handleFlagToggle,
      canRegenerate,
      handleDirectStepGenerate,
      isAutosaveEnabled,
      handleNameChange,
      handleDescriptionChange,
      handleInstructionsChange,
      handleExamplesChange,
      handleParameterFieldIdsChange,
      handleExampleIdsChange,
      exampleMapping,
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
    flag_ids: (prevData?.flags?.filter((f: any) => f.selected) ?? []).map((f: any) => f.id).filter(Boolean),
    department_ids: (prevData?.departments?.filter((d: any) => d.selected) ?? [])
      .map((d) => d.department_id)
      .filter(Boolean),
    parameter_field_ids: (prevData?.parameter_fields?.filter((p: any) => p.selected) ?? [])
      .map((f) => f.id)
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
    flag_ids: (nextData?.flags?.filter((f: any) => f.selected) ?? []).map((f: any) => f.id).filter(Boolean),
    department_ids: (nextData?.departments?.filter((d: any) => d.selected) ?? [])
      .map((d) => d.department_id)
      .filter(Boolean),
    parameter_field_ids: (nextData?.parameter_fields?.filter((p: any) => p.selected) ?? [])
      .map((f) => f.id)
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
