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
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Colors } from "@/components/resources/Colors";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Examples } from "@/components/resources/Examples";
import { Fields } from "@/components/resources/Fields";
import { Flags } from "@/components/resources/Flags";
import { Icons } from "@/components/resources/Icons";
import { Instructions } from "@/components/resources/Instructions";
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
import { useGenerationContext } from "@/contexts/generation-context";
import { useProfile } from "@/contexts/profile-context";
import { useSaveContext } from "@/contexts/save-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { Loader2, Sparkles } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SavePersonaIn = InputOf<"/api/v4/personas/save", "post">;
type SavePersonaOut = OutputOf<"/api/v4/personas/save", "post">;
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
type CreateDraftDocumentsIn = InputOf<"/api/v4/resources/documents", "post">;
type CreateDraftDocumentsOut = OutputOf<"/api/v4/resources/documents", "post">;
type PatchPersonaDraftIn = InputOf<"/api/v4/personas/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<"/api/v4/personas/draft", "patch">;

type PersonaData = OutputOf<"/api/v4/personas/get", "post">;

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
  createDocumentsAction?: (
    input: CreateDraftDocumentsIn
  ) => Promise<CreateDraftDocumentsOut>;
}

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
}: PersonaProps) {
  const router = useRouter();
  const isEditMode = !!personaId;
  const { profile, setSelectedDraftId, socket, isConnected } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { setGenerationCapability, clearGenerationCapability } =
    useGenerationContext();
  const { isAutosaveEnabled } = useSaveContext();

  // Registry of flush callbacks from creatable resource components
  const flushRegistryRef = useRef<Map<string, () => Promise<void>>>(new Map());

  // Create stable registerFlush callback
  const createRegisterFlush = useCallback((key: string) => {
    return (flush: () => Promise<void>) => {
      flushRegistryRef.current.set(key, flush);
    };
  }, []);

  // Memoize registerFlush callbacks to prevent re-renders
  const registerFlushCallbacks = useMemo(
    () => ({
      names: createRegisterFlush("names"),
      descriptions: createRegisterFlush("descriptions"),
      instructions: createRegisterFlush("instructions"),
      examples: createRegisterFlush("examples"),
      colors: createRegisterFlush("colors"),
    }),
    [createRegisterFlush]
  );

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
  const personaSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      // Search params (URL-backed, updated via debounced callback in StepCard)
      colorSearch: parseAsString,
      iconSearch: parseAsString,
      descriptionSearch: parseAsString,
      instructionsSearch: parseAsString,
      fieldSearch: parseAsString,
      parameterSearch: parseAsString,
      // Filter params (URL-backed)
      colorShowSelected: parseAsBoolean,
      iconShowSelected: parseAsBoolean,
      fieldShowSelected: parseAsBoolean,
      parameterShowSelected: parseAsBoolean,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store personaData to prevent callback recreation on every render
  const personaDataRef = React.useRef(personaData);
  React.useEffect(() => {
    personaDataRef.current = personaData;
  }, [personaData]);

  // Memoize personaData fields used in renderStep to prevent callback recreation
  // when only object reference changes (but content is same)
  const stablePersonaDataFields = React.useMemo(() => {
    if (!personaData) return null;
    return {
      group_id: personaData.group_id,
      name_resource: personaData.name_resource,
      show_name: personaData.show_name,
      name_suggestions: personaData.name_suggestions,
      names: personaData.names,
      name_required: personaData.name_required,
      name_agent_id: personaData.name_agent_id,
      description_resource: personaData.description_resource,
      show_description: personaData.show_description,
      description_suggestions: personaData.description_suggestions,
      description_required: personaData.description_required,
      description_agent_id: personaData.description_agent_id,
      descriptions: personaData.descriptions,
      department_resources: personaData.department_resources,
      show_departments: personaData.show_departments,
      department_suggestions: personaData.department_suggestions,
      departments_required: personaData.departments_required,
      departments_agent_id: personaData.departments_agent_id,
      departments: personaData.departments,
      flag_resource: personaData.flag_resource,
      show_flag: personaData.show_flag,
      flag_required: personaData.flag_required,
      flag_agent_id: personaData.flag_agent_id,
      field_resources: personaData.field_resources,
      show_fields: personaData.show_fields,
      field_suggestions: personaData.field_suggestions,
      fields_required: personaData.fields_required,
      fields_agent_id: personaData.fields_agent_id,
      fields: personaData.fields,
      color_resource: personaData.color_resource,
      show_color: personaData.show_color,
      color_suggestions: personaData.color_suggestions,
      color_required: personaData.color_required,
      color_agent_id: personaData.color_agent_id,
      colors: personaData.colors,
      icon_resource: personaData.icon_resource,
      show_icon: personaData.show_icon,
      icon_suggestions: personaData.icon_suggestions,
      icon_required: personaData.icon_required,
      icon_agent_id: personaData.icon_agent_id,
      icons: personaData.icons,
      instructions_resource: personaData.instructions_resource,
      show_instructions: personaData.show_instructions,
      instructions_suggestions: personaData.instructions_suggestions,
      instructions_required: personaData.instructions_required,
      instructions_agent_id: personaData.instructions_agent_id,
      instructions: personaData.instructions,
      example_resources: personaData.example_resources,
      show_examples: personaData.show_examples,
      example_suggestions: personaData.example_suggestions,
      examples_required: personaData.examples_required,
      examples_agent_id: personaData.examples_agent_id,
      examples: personaData.examples,
      parameter_resources: personaData.parameter_resources,
      show_parameters: personaData.show_parameters,
      parameter_suggestions: personaData.parameter_suggestions,
      parameters_required: personaData.parameters_required,
      parameters_agent_id: personaData.parameters_agent_id,
      parameters: personaData.parameters,
      basic_agent_id: personaData.basic_agent_id,
      content_agent_id: personaData.content_agent_id,
    };
    // Intentionally depend on individual fields, not whole personaData object
    // to prevent recreation when only object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    personaData?.group_id,
    personaData?.name_resource,
    personaData?.show_name,
    personaData?.name_suggestions,
    personaData?.names,
    personaData?.name_required,
    personaData?.name_agent_id,
    personaData?.description_resource,
    personaData?.show_description,
    personaData?.description_suggestions,
    personaData?.description_required,
    personaData?.description_agent_id,
    personaData?.descriptions,
    personaData?.department_resources,
    personaData?.show_departments,
    personaData?.department_suggestions,
    personaData?.departments_required,
    personaData?.departments_agent_id,
    personaData?.departments,
    personaData?.flag_resource,
    personaData?.show_flag,
    personaData?.flag_required,
    personaData?.flag_agent_id,
    personaData?.field_resources,
    personaData?.show_fields,
    personaData?.field_suggestions,
    personaData?.fields_required,
    personaData?.fields_agent_id,
    personaData?.fields,
    personaData?.color_resource,
    personaData?.show_color,
    personaData?.color_suggestions,
    personaData?.color_required,
    personaData?.color_agent_id,
    personaData?.colors,
    personaData?.icon_resource,
    personaData?.show_icon,
    personaData?.icon_suggestions,
    personaData?.icon_required,
    personaData?.icon_agent_id,
    personaData?.icons,
    personaData?.instructions_resource,
    personaData?.show_instructions,
    personaData?.instructions_suggestions,
    personaData?.instructions_required,
    personaData?.instructions_agent_id,
    personaData?.instructions,
    personaData?.example_resources,
    personaData?.show_examples,
    personaData?.example_suggestions,
    personaData?.examples_required,
    personaData?.examples_agent_id,
    personaData?.examples,
    personaData?.parameter_resources,
    personaData?.show_parameters,
    personaData?.parameter_suggestions,
    personaData?.parameters_required,
    personaData?.parameters_agent_id,
    personaData?.parameters,
    personaData?.basic_agent_id,
    personaData?.content_agent_id,
  ]);

  // Helper to check if a resource type can be regenerated
  // Use stablePersonaDataFields to prevent callback recreation when personaData object reference changes
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!stablePersonaDataFields) return false;
      switch (resourceType) {
        case "names":
          return stablePersonaDataFields.name_resource?.generated ?? false;
        case "descriptions":
          return (
            stablePersonaDataFields.description_resource?.generated ?? false
          );
        case "colors":
          return stablePersonaDataFields.color_resource?.generated ?? false;
        case "icons":
          return stablePersonaDataFields.icon_resource?.generated ?? false;
        case "instructions":
          return (
            stablePersonaDataFields.instructions_resource?.generated ?? false
          );
        case "flags":
          return stablePersonaDataFields.flag_resource?.generated ?? false;
        case "departments":
          return (
            stablePersonaDataFields.department_resources?.some(
              (d) => d.generated
            ) ?? false
          );
        case "fields":
          return (
            stablePersonaDataFields.field_resources?.some((f) => f.generated) ??
            false
          );
        case "examples":
          return (
            stablePersonaDataFields.example_resources?.some(
              (e) => e.generated
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stablePersonaDataFields]
  );

  const getInitialFormState = useCallback(() => {
    const data = personaDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        color_id: null as string | null,
        icon_id: null as string | null,
        instructions_id: null as string | null,
        active_flag_id: null as string | null,
        department_ids: [] as string[],
        field_ids: [] as string[],
        example_ids: [] as string[],
        parameter_ids: [] as string[],
      };
    }
    // Extract resource IDs from server data
    // Note: Server data may have display values, but we only store IDs here
    return {
      name_id: data.name_id ?? null,
      description_id: data.description_id ?? null,
      color_id: data.color_id ?? null,
      icon_id: data.icon_id ?? null,
      instructions_id: data.instructions_id ?? null,
      active_flag_id: data.active_flag_id ?? null,
      department_ids: data.department_ids ?? [],
      field_ids: data.field_ids ?? [],
      example_ids: data.example_ids ?? [],
      parameter_ids: data.parameter_ids ?? [],
    };
    // Remove personaData from dependencies - use ref instead to prevent callback recreation
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies to prevent effect from running when array references change but content is same
  const departmentIdsStr = React.useMemo(
    () => JSON.stringify(personaData?.department_ids ?? []),
    [personaData?.department_ids]
  );
  const fieldIdsStr = React.useMemo(
    () => JSON.stringify(personaData?.field_ids ?? []),
    [personaData?.field_ids]
  );
  const exampleIdsStr = React.useMemo(
    () => JSON.stringify(personaData?.example_ids ?? []),
    [personaData?.example_ids]
  );
  const parameterIdsStr = React.useMemo(
    () => JSON.stringify(personaData?.parameter_ids ?? []),
    [personaData?.parameter_ids]
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
  const formStateExampleIdsStr = React.useMemo(
    () => JSON.stringify(formState.example_ids),
    [formState.example_ids]
  );
  const formStateParameterIdsStr = React.useMemo(
    () => JSON.stringify(formState.parameter_ids),
    [formState.parameter_ids]
  );

  // Update form state when server data changes
  // Use personaData directly in dependency array, not getInitialFormState
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.color_id !== newState.color_id ||
        prev.icon_id !== newState.icon_id ||
        prev.instructions_id !== newState.instructions_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.field_ids) !== JSON.stringify(newState.field_ids) ||
        JSON.stringify(prev.example_ids) !==
          JSON.stringify(newState.example_ids) ||
        JSON.stringify(prev.parameter_ids) !==
          JSON.stringify(newState.parameter_ids)
      ) {
        return newState;
      }
      return prev;
    });
    // Use stringified arrays in dependencies to prevent effect from running when array references change but content is same
    // Intentionally exclude formState and getInitialFormState to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    personaData?.name_id,
    personaData?.description_id,
    personaData?.color_id,
    personaData?.icon_id,
    personaData?.instructions_id,
    personaData?.active_flag_id,
    departmentIdsStr,
    fieldIdsStr,
    exampleIdsStr,
    parameterIdsStr,
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
    personaData && "draft_version" in personaData
      ? (personaData as { draft_version?: number | null }).draft_version
      : null;
  // Track if version has been synced from server to prevent patching before sync
  const versionSyncedRef = React.useRef(false);
  React.useEffect(() => {
    if (
      typeof draftVersion === "number" &&
      draftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(draftVersion);
      lastSavedVersionRef.current = draftVersion;
    }
    versionSyncedRef.current = true; // Mark as synced
  }, [draftVersion]);

  // Get draftId from GenericForm's URL state via bridge (GenericForm is single source of truth)
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  // Store formData from GenericForm to access search params
  const formDataRef = React.useRef<Record<string, unknown>>({});

  // Track last synced draftId to prevent redundant profile context updates
  const lastSyncedDraftIdRef = React.useRef<string | null>(null);

  // Memoized callback to sync draftId from GenericForm - only update if value changed
  const onFormDataChange = React.useCallback(
    (fd: Record<string, unknown>) => {
      // Store formData for access in handleGenerateResources
      formDataRef.current = fd;
      const next = (fd["draftId"] as string | undefined) ?? null;
      setDraftId((prev) => (prev === next ? prev : next));

      // One-way sync to profile context (no effect dependency on selectedDraftId)
      if (next !== lastSyncedDraftIdRef.current) {
        lastSyncedDraftIdRef.current = next;
        setSelectedDraftId(next);
      }
    },
    [setSelectedDraftId]
  );

  // Use ref to stabilize patchPersonaDraftAction to prevent effect recreation when prop reference changes
  const patchPersonaDraftActionRef = React.useRef(patchPersonaDraftAction);
  React.useEffect(() => {
    patchPersonaDraftActionRef.current = patchPersonaDraftAction;
  }, [patchPersonaDraftAction]);

  // Build a stable key for "what would we patch" - only changes when form data actually changes
  const draftPatchKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftId || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      color_id: formState.color_id,
      icon_id: formState.icon_id,
      instructions_id: formState.instructions_id,
      active_flag_id: formState.active_flag_id,
      department_ids: formState.department_ids,
      field_ids: formState.field_ids,
      example_ids: formState.example_ids,
      parameter_ids: formState.parameter_ids,
    });
    // Use stringified arrays to prevent recreation when array references change but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formState.color_id,
    formState.icon_id,
    formState.instructions_id,
    formState.active_flag_id,
    formStateDepartmentIdsStr,
    formStateFieldIdsStr,
    formStateExampleIdsStr,
    formStateParameterIdsStr,
  ]);

  // Track last patched payload so we don't repatch identical state
  const lastPatchedKeyRef = React.useRef<string | null>(null);
  const isFirstPatchRef = React.useRef(true);

  // Track if there are pending changes for beforeunload warning
  const hasPendingChangesRef = React.useRef(false);

  // Draft change listener - watches resource IDs and patches draft
  // Only triggers when the payload actually changes, not when version changes
  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.color_id ||
      formState.icon_id ||
      formState.instructions_id ||
      formState.active_flag_id ||
      formState.department_ids.length > 0 ||
      formState.field_ids.length > 0 ||
      formState.example_ids.length > 0 ||
      formState.parameter_ids.length > 0;

    // Debug logging at effect start
    console.debug("[Persona Draft] Effect triggered", {
      hasResourceIds,
      isAutosaveEnabled,
      draftPatchKey: draftPatchKey.substring(0, 100) + "...",
      lastPatchedKey: lastPatchedKeyRef.current?.substring(0, 50),
    });

    if (!hasResourceIds || !patchPersonaDraftActionRef.current) {
      return;
    }

    // Wait for version sync before patching to prevent race conditions
    // Only block if there's an actual numeric version to sync (not null for new personas)
    if (
      typeof personaData?.draft_version === "number" &&
      !versionSyncedRef.current
    ) {
      console.debug("[Persona Draft] Waiting for version sync");
      return;
    }

    // Skip the first effect run - treat initial server state as the baseline
    // This prevents creating an unwanted draft on page load when server returns pre-populated IDs
    if (isFirstPatchRef.current) {
      isFirstPatchRef.current = false;
      lastPatchedKeyRef.current = draftPatchKey;
      return;
    }

    // ✅ If nothing changed since the last successful patch, do nothing.
    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    // Mark that we have pending changes (for beforeunload warning)
    hasPendingChangesRef.current = true;

    // Skip autosave if disabled (manual save mode)
    if (!isAutosaveEnabled) {
      console.debug("[Persona Draft] Autosave disabled, skipping auto-patch");
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchPersonaDraftActionRef.current) return;

        // Debug logging before API call
        console.debug("[Persona Draft] Calling patch API", {
          input_draft_id: draftId,
          expected_version: lastSavedVersionRef.current,
          fields: Object.keys(formState).filter(
            (k) => formState[k as keyof typeof formState]
          ),
        });

        const result = await patchPersonaDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            color_id: formState.color_id,
            icon_id: formState.icon_id,
            instructions_id: formState.instructions_id,
            active_flag_id: formState.active_flag_id,
            department_ids: formState.department_ids,
            field_ids: formState.field_ids,
            example_ids: formState.example_ids,
            parameter_ids: formState.parameter_ids,
            expected_version: lastSavedVersionRef.current, // ✅ ref, not state dep
          },
        });

        // Mark this payload as patched so we don't loop
        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          // Update URL when draft is created via GenericForm bridge (GenericForm owns URL state)
          toast.success("Draft created", {
            description: "Your changes are being auto-saved",
          });
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        } else if (result.draft_id && result.draft_id !== draftId) {
          // Sync URL to server-returned draft_id to avoid stale draft mismatch
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        // Debug logging after success
        console.debug("[Persona Draft] Patch succeeded", {
          draft_id: result.draft_id,
          new_version: result.new_version,
        });

        // This can stay as state (for UI), but it won't re-trigger patching
        // because the effect is gated by payload changes.
        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }

        // Clear pending changes flag after successful save
        hasPendingChangesRef.current = false;
      } catch (error) {
        // Log error for debugging
        console.error("[Persona Draft] Patch failed:", error);
        // Show user feedback
        toast.error("Failed to save draft", {
          description:
            "Your changes may not have been saved. Please try again.",
        });
        // Don't update lastPatchedKeyRef on failure so we retry on next change
      }
    }, 1000);

    return () => clearTimeout(timer);
    // ✅ Trigger only when payload changes, not when version changes
    // patchPersonaDraftAction and setDraftId are accessed via refs to prevent effect recreation
    // when prop/function references change but functionality is the same
    // We access formState fields and draftId inside the effect, but depend on draftPatchKey
    // to prevent unnecessary effect recreation when individual fields change but payload is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftPatchKey, // ✅ trigger only when payload changes
    isAutosaveEnabled, // ✅ re-check when autosave mode changes
    // patchPersonaDraftAction and setDraftId are accessed via refs
  ]);

  // Warn users about unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChangesRef.current) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Emit unsaved-changes event when draftPatchKey changes
  useEffect(() => {
    // Only report changes after we've established a baseline (ref is not null)
    const hasChanges =
      lastPatchedKeyRef.current !== null &&
      lastPatchedKeyRef.current !== draftPatchKey;
    window.dispatchEvent(
      new CustomEvent("unsaved-changes", { detail: { hasChanges } })
    );
  }, [draftPatchKey]);

  // Flush all resources and patch draft (for manual save)
  const flushAllAndSave = useCallback(async () => {
    window.dispatchEvent(
      new CustomEvent("save-status-change", { detail: { status: "saving" } })
    );

    try {
      // 1. Flush all creatable resource components
      const flushPromises = Array.from(flushRegistryRef.current.values()).map(
        (flush) => flush()
      );
      await Promise.all(flushPromises);

      // 2. Small delay to allow state updates to propagate
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 3. Patch draft with all resource IDs
      if (patchPersonaDraftActionRef.current) {
        const result = await patchPersonaDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            color_id: formState.color_id,
            icon_id: formState.icon_id,
            instructions_id: formState.instructions_id,
            active_flag_id: formState.active_flag_id,
            department_ids: formState.department_ids,
            field_ids: formState.field_ids,
            example_ids: formState.example_ids,
            parameter_ids: formState.parameter_ids,
            expected_version: lastSavedVersionRef.current,
          },
        });

        // Update refs
        lastPatchedKeyRef.current = draftPatchKey;
        if (result.new_version !== undefined && result.new_version !== null) {
          lastSavedVersionRef.current = result.new_version;
          setLastSavedVersion(result.new_version);
        }

        // Update URL if draft was created
        if (!draftId && result.draft_id) {
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
          toast.success("Draft created");
        }
      }

      window.dispatchEvent(
        new CustomEvent("save-status-change", { detail: { status: "saved" } })
      );
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: false } })
      );

      hasPendingChangesRef.current = false;
    } catch (error) {
      console.error("[Persona] Save failed:", error);
      window.dispatchEvent(
        new CustomEvent("save-status-change", { detail: { status: "error" } })
      );
      toast.error("Failed to save draft");
    }
  }, [draftId, formState, draftPatchKey]);

  // Listen for save trigger from layout
  useEffect(() => {
    const handleTriggerSave = () => flushAllAndSave();
    window.addEventListener("trigger-save", handleTriggerSave);
    return () => window.removeEventListener("trigger-save", handleTriggerSave);
  }, [flushAllAndSave]);

  // WebSocket handlers for AI generation - unified handler for all resource types
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Use single group_id from personaData (no need to track multiple)
    const currentGroupId = personaData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_id?: string | null;
      description_id?: string | null;
      color_id?: string | null;
      icon_id?: string | null;
      instructions_id?: string | null;
      active_flag_id?: string | null;
      field_ids?: string[];
      department_ids?: string[];
      example_ids?: string[];
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "persona" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this persona or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "colors",
        "icons",
        "instructions",
        "flags",
        "examples",
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
          if (data.color_id) updates.color_id = data.color_id;
          if (data.icon_id) updates.icon_id = data.icon_id;
          if (data.instructions_id)
            updates.instructions_id = data.instructions_id;
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
          if (data.example_ids && data.example_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newExampleIds = data.example_ids.filter(
              (id) => !prev.example_ids.includes(id)
            );
            updates.example_ids = [...prev.example_ids, ...newExampleIds];
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
        data.artifact_type !== "persona" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this persona or wrong group_id
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
        data.artifact_type !== "persona" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this persona or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "colors",
        "icons",
        "instructions",
        "flags",
        "examples",
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

    // Listen to persona-specific events filtered by artifact_type and group_id
    socket.on("persona_generation_progress", handleGenerationProgress);
    socket.on("persona_generation_complete", handleGenerationComplete);
    socket.on("persona_generation_error", handleGenerationError);

    return () => {
      socket.off("persona_generation_progress", handleGenerationProgress);
      socket.off("persona_generation_complete", handleGenerationComplete);
      socket.off("persona_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, personaData?.group_id]);

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
      const contentResources: ResourceType[] = ["instructions", "examples"];
      const allResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "colors",
        "icons",
        "instructions",
        "flags",
        "fields",
        "departments",
        "examples",
      ];

      const isBasicCombo =
        resourceTypes.length === basicResources.length &&
        resourceTypes.every((rt) => basicResources.includes(rt));
      const isContentCombo =
        resourceTypes.length === contentResources.length &&
        resourceTypes.every((rt) => contentResources.includes(rt));
      const isAllResources =
        resourceTypes.length === allResourceTypes.length &&
        resourceTypes.every((rt) => allResourceTypes.includes(rt));

      if (isAllResources) {
        return "general";
      } else if (isBasicCombo) {
        return "basic";
      } else if (isContentCombo) {
        return "content";
      } else if (resourceTypes.length === 1) {
        // Single resource type - map to agent_type
        const agentTypeMap: Partial<Record<ResourceType, string>> = {
          names: "name",
          descriptions: "description",
          colors: "color",
          icons: "icon",
          instructions: "instructions",
          flags: "flags",
          departments: "departments",
          fields: "fields",
          examples: "examples",
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
      const colorSearch =
        (formData["colorSearch"] as string | undefined) ?? null;
      const iconSearch = (formData["iconSearch"] as string | undefined) ?? null;
      const descriptionSearch =
        (formData["descriptionSearch"] as string | undefined) ?? null;
      const instructionsSearch =
        (formData["instructionsSearch"] as string | undefined) ?? null;
      const fieldSearch =
        (formData["fieldSearch"] as string | undefined) ?? null;
      const colorShowSelected =
        (formData["colorShowSelected"] as boolean | undefined) ?? false;
      const iconShowSelected =
        (formData["iconShowSelected"] as boolean | undefined) ?? false;
      const fieldShowSelected =
        (formData["fieldShowSelected"] as boolean | undefined) ?? false;

      // Emit persona_generate event with GetPersonaApiRequest fields
      socket.emit("persona_generate", {
        resource_types: resourceTypes, // Simple array of strings
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        // GetPersonaApiRequest fields from formData
        draft_id: draftId || null,
        color_search: colorSearch || null,
        icon_search: iconSearch || null,
        descriptions_search: descriptionSearch || null,
        instructions_search: instructionsSearch || null,
        field_search: fieldSearch || null,
        color_show_selected: colorShowSelected || false,
        icon_show_selected: iconShowSelected || false,
        field_show_selected: fieldShowSelected || false,
        mcp: false,
        persona_id: personaId || null,
      });
    },
    [socket, isConnected, personaId]
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

  const handleGenerateInstructions = useCallback(
    async () =>
      handleGenerateResources(
        ["instructions"],
        determineAgentType(["instructions"])
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

  const handleGenerateExamples = useCallback(
    async () =>
      handleGenerateResources(["examples"], determineAgentType(["examples"])),
    [handleGenerateResources, determineAgentType]
  );

  // GenericForm will manage URL state via nuqs parsers
  // We'll merge formState (resource IDs) with GenericForm's formData (URL params) when needed

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!personaData) return false;
    return !personaData.can_edit;
  }, [personaData]);

  // Set breadcrumb context when persona data is loaded
  // Extract the specific field to use as dependency (not the whole object)
  const personaNameForBreadcrumb = personaData?.name_resource?.name;
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

  // Set generation capability when persona data is loaded
  useEffect(() => {
    if (personaData?.general_agent_id && personaData?.can_edit !== false) {
      setGenerationCapability({
        artifactType: "persona",
        canGenerate: true,
        agentId: personaData.general_agent_id,
      });
    } else {
      setGenerationCapability({
        artifactType: "persona",
        canGenerate: false,
        agentId: null,
      });
    }
    return () => clearGenerationCapability();
  }, [
    personaData?.general_agent_id,
    personaData?.can_edit,
    setGenerationCapability,
    clearGenerationCapability,
  ]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs using {resource}_required flags from personaData
      if (personaData?.name_required && !formState.name_id) {
        toast.error("Persona name is required");
        throw new Error("Persona name is required");
      }

      if (personaData?.color_required && !formState.color_id) {
        toast.error("Persona color is required");
        throw new Error("Persona color is required");
      }

      if (personaData?.icon_required && !formState.icon_id) {
        toast.error("Persona icon is required");
        throw new Error("Persona icon is required");
      }

      if (personaData?.instructions_required && !formState.instructions_id) {
        toast.error("Instructions are required");
        throw new Error("Instructions are required");
      }

      if (
        personaData?.departments_required &&
        (!formState.department_ids || formState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        personaData?.fields_required &&
        (!formState.field_ids || formState.field_ids.length === 0)
      ) {
        toast.error("Fields are required");
        throw new Error("Fields are required");
      }

      if (
        personaData?.examples_required &&
        (!formState.example_ids || formState.example_ids.length === 0)
      ) {
        toast.error("Examples are required");
        throw new Error("Examples are required");
      }

      // Pass department_ids directly - SQL handles validation via validate_department_create_permissions/validate_department_update_permissions

      // Ensure profileId exists - required for API calls
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

      // Ensure required fields are present (TypeScript guard)
      if (
        !formState.name_id ||
        !formState.color_id ||
        !formState.icon_id ||
        !formState.instructions_id
      ) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        await savePersonaAction({
          body: {
            // Context
            group_id: personaData.group_id,
            input_persona_id: isEditMode && personaId ? personaId : null,

            // Required single-select
            name_id: formState.name_id,
            color_id: formState.color_id,
            icon_id: formState.icon_id,
            instructions_id: formState.instructions_id,

            // Optional single-select
            description_id: formState.description_id ?? undefined,
            active_flag_id: formState.active_flag_id ?? undefined,

            // Optional multi-select
            department_ids:
              formState.department_ids.length > 0
                ? formState.department_ids
                : undefined,
            field_ids:
              formState.field_ids.length > 0 ? formState.field_ids : undefined,
            example_ids:
              formState.example_ids.length > 0
                ? formState.example_ids
                : undefined,
            parameter_ids:
              formState.parameter_ids.length > 0
                ? formState.parameter_ids
                : undefined,
          },
        });
        toast.success(
          `Persona ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/create/personas");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} persona: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      formState,
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
      personaData?.fields_required,
      personaData?.examples_required,
    ]
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
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
          // Handle dynamic fields-{parameter_id} steps
          if (stepId.startsWith("fields-")) {
            const parameterId = stepId.replace("fields-", "");
            if (!hasName || !hasDescription) return "pending";
            // Check if any fields for this parameter are selected
            const fieldsForParam =
              personaData?.fields?.filter(
                (f) => f.parameter_id === parameterId
              ) ?? [];
            const hasFieldsForParam = formState.field_ids.some((fid) =>
              fieldsForParam.some((f) => f.field_id === fid)
            );
            return hasFieldsForParam ? "completed" : "active";
          }
          return "pending";
      }
    },
    [formState, personaData?.fields]
  );

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      parameters: ["parameters"],
      fields: ["fields"],
      color: ["colors"],
      icon: ["icons"],
      content: ["instructions", "examples"],
      all: [
        "names",
        "descriptions",
        "colors",
        "icons",
        "instructions",
        "flags",
        "parameters",
        "fields",
        "departments",
        "examples",
      ], // All resources for full-page generation
    }),
    []
  );

  // Resource labels for display
  const resourceLabels: Partial<Record<ResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      colors: "Colors",
      icons: "Icons",
      instructions: "Instructions",
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
  useEffect(() => {
    const handleFullPageGenerate = () => {
      if (personaData?.general_agent_id) {
        // Open modal instead of directly generating
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [personaData?.general_agent_id, handleOpenStepCardModal]);

  // Steps configuration for GenericForm - dynamic based on selected parameters
  const steps = useMemo(() => {
    const baseSteps = [
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
        description: "Select parameters for this persona.",
        resetFields: [
          "parameter_ids",
          "parameterSearch",
          "parameterShowSelected",
        ],
      },
    ];

    // Generate a step for each selected parameter
    const parameterFieldSteps = (formState.parameter_ids ?? []).map(
      (parameterId) => {
        const param = personaData?.parameters?.find(
          (p) => p.parameter_id === parameterId
        );
        return {
          id: `fields-${parameterId}`,
          title: param?.name ?? "Fields",
          description:
            param?.description ?? "Select fields for this parameter.",
          resetFields: [] as string[], // field_ids managed globally
        };
      }
    );

    const endSteps = [
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
          "Define instructions and example messages for the persona.",
        resetFields: ["instructions", "examples"],
      },
    ];

    return [...baseSteps, ...parameterFieldSteps, ...endSteps];
  }, [formState.parameter_ids, personaData?.parameters]);

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "color",
      "icon",
      "instructions",
      "active",
      "department_ids",
      "field_ids",
      "parameter_ids",
      "examples",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "parameters":
        return "Parameters reset";
      case "fields":
        return "Fields reset";
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

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/create/personas",
      backLabel: "Back",
      createLabel: "Create Persona",
      updateLabel: "Update Persona",
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
      // Use memoized fields to avoid dependency on personaData object reference
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
                  group_id={currentPersonaData?.group_id ?? null}
                  agent_id={currentPersonaData?.name_agent_id ?? null}
                  createNamesAction={
                    createNamesAction as
                      | ((
                          input: CreateDraftNamesIn
                        ) => Promise<CreateDraftNamesOut>)
                      | undefined
                  }
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks.names}
                />
              }
              resetFields={["name", "description", "department_ids", "active"]}
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                currentPersonaData?.basic_agent_id ? (
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
                    currentPersonaData?.description_resource ?? null
                  }
                  show_description={
                    currentPersonaData?.show_description ?? true
                  }
                  description_suggestions={
                    currentPersonaData?.description_suggestions ?? []
                  }
                  descriptions={currentPersonaData?.descriptions ?? []}
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
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  label="Description"
                  placeholder="Detailed behavior description and personality traits"
                  required={currentPersonaData?.description_required ?? false}
                  rows={4}
                  data-testid="input-persona-description"
                  group_id={currentPersonaData?.group_id ?? null}
                  agent_id={currentPersonaData?.description_agent_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks.descriptions}
                />

                {/* Department Selection */}
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    currentPersonaData?.department_resources ?? []
                  }
                  show_departments={
                    currentPersonaData?.show_departments ?? false
                  }
                  department_suggestions={
                    currentPersonaData?.department_suggestions ?? []
                  }
                  departments={currentPersonaData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  required={currentPersonaData?.departments_required ?? false}
                  group_id={currentPersonaData?.group_id ?? null}
                  agent_id={currentPersonaData?.departments_agent_id ?? null}
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={currentPersonaData?.flag_resource ?? null}
                  show_flag={currentPersonaData?.show_flag ?? false}
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
                  helpText="Inactive personas will not be available for scenarios"
                  required={currentPersonaData?.flag_required ?? false}
                  group_id={currentPersonaData?.group_id ?? null}
                  agent_id={currentPersonaData?.flag_agent_id ?? null}
                  {...((formState.icon_id ||
                    currentPersonaData?.flag_resource?.icon_id) && {
                    iconId: (formState.icon_id ||
                      currentPersonaData?.flag_resource?.icon_id) as string,
                  })}
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
                "parameterSearch",
                "parameterShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Parameters
                parameter_ids={formState.parameter_ids ?? []}
                parameter_resources={
                  currentPersonaData?.parameter_resources ?? []
                }
                show_parameters={currentPersonaData?.show_parameters ?? false}
                parameter_suggestions={
                  currentPersonaData?.parameter_suggestions ?? []
                }
                parameters={currentPersonaData?.parameters ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, parameter_ids: ids }))
                }
                label="Parameters"
                required={currentPersonaData?.parameters_required ?? false}
                group_id={currentPersonaData?.group_id ?? null}
                agent_id={currentPersonaData?.parameters_agent_id ?? null}
                searchTerm={parameterSearchTerm}
                showSelectedFilter={parameterShowSelected}
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
                stepResources["color"] && stepResources["color"].length > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "color"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "color",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["color"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["color"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["color"]!.some((rt) => canRegenerate(rt))
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              {/* Color picker - using Colors resource component */}
              <Colors
                color_id={formState.color_id ?? null}
                color_resource={currentPersonaData?.color_resource ?? null}
                show_color={currentPersonaData?.show_color ?? false}
                color_suggestions={currentPersonaData?.color_suggestions ?? []}
                colors={currentPersonaData?.colors ?? []}
                disabled={disabled}
                onColorIdChange={(colorId) =>
                  setFormState((prev) => ({ ...prev, color_id: colorId }))
                }
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
                group_id={currentPersonaData?.group_id ?? null}
                agent_id={currentPersonaData?.color_agent_id ?? null}
                createColorsAction={createColorsAction}
                required={currentPersonaData?.color_required ?? false}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks.colors}
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
                stepResources["icon"] && stepResources["icon"].length > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "icon"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "icon",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["icon"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["icon"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["icon"]!.some((rt) => canRegenerate(rt))
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              {/* Icon picker - using Icons resource component */}
              <Icons
                icon_id={formState.icon_id ?? null}
                icon_resource={currentPersonaData?.icon_resource ?? null}
                show_icon={currentPersonaData?.show_icon ?? false}
                icon_suggestions={currentPersonaData?.icon_suggestions ?? []}
                icons={currentPersonaData?.icons ?? []}
                disabled={disabled}
                onIconIdChange={(iconId) =>
                  setFormState((prev) => ({ ...prev, icon_id: iconId }))
                }
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
                group_id={currentPersonaData?.group_id ?? null}
                agent_id={currentPersonaData?.icon_agent_id ?? null}
                required={currentPersonaData?.icon_required ?? false}
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
                currentPersonaData?.content_agent_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "content"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "content",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["content"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["content"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["content"]!.some((rt) =>
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
              {/* Instructions - using Instructions resource component */}
              <Instructions
                instructions_id={formState.instructions_id ?? null}
                instructions_resource={
                  currentPersonaData?.instructions_resource ?? null
                }
                show_instructions={
                  currentPersonaData?.show_instructions ?? true
                }
                instructions_suggestions={
                  currentPersonaData?.instructions_suggestions ?? []
                }
                instructions={currentPersonaData?.instructions ?? []}
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
                onGenerate={handleGenerateInstructions}
                isGenerating={isGenerating("instructions")}
                label="Instructions"
                placeholder="Instructions that define how the persona should behave and respond."
                required={currentPersonaData?.instructions_required ?? false}
                rows={8}
                helpText="Define the persona's behavior, communication style, and response patterns"
                data-testid="input-instructions"
                group_id={currentPersonaData?.group_id ?? null}
                agent_id={currentPersonaData?.instructions_agent_id ?? null}
                createInstructionsAction={createInstructionsAction}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks.instructions}
              />

              {/* Examples Section */}
              <Examples
                example_ids={formState.example_ids ?? []}
                example_resources={currentPersonaData?.example_resources ?? []}
                show_examples={currentPersonaData?.show_examples ?? false}
                example_suggestions={
                  currentPersonaData?.example_suggestions ?? []
                }
                examples={currentPersonaData?.examples ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, example_ids: ids }))
                }
                onGenerate={handleGenerateExamples}
                isGenerating={isGenerating("examples")}
                maxItems={10}
                addButtonLabel="Add example"
                itemPlaceholder="Message"
                group_id={currentPersonaData?.group_id ?? null}
                agent_id={currentPersonaData?.examples_agent_id ?? null}
                createExamplesAction={
                  createExamplesAction
                    ? async (input: {
                        body: {
                          agent_id: string;
                          group_id: string;
                          example: string;
                          mcp?: boolean;
                        };
                      }) => {
                        // Wrap the action to add mcp field (defaults to false)
                        return await createExamplesAction({
                          body: {
                            ...input.body,
                            mcp: input.body.mcp ?? false,
                          },
                        });
                      }
                    : undefined
                }
                required={currentPersonaData?.examples_required ?? false}
                exampleMapping={
                  currentPersonaData?.examples && formState.example_ids
                    ? Object.fromEntries(
                        currentPersonaData.examples
                          .map((ex, idx) => [
                            formState.example_ids?.[idx] || "",
                            ex.example || "",
                          ])
                          .filter(([id]) => id)
                      )
                    : {}
                }
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks.examples}
              />
            </StepCard>
          );

        default:
          // Handle dynamic fields-{parameter_id} steps
          if (stepId.startsWith("fields-")) {
            const parameterId = stepId.replace("fields-", "");
            const fieldSearchTerm =
              (stepFormData["fieldSearch"] as string | null | undefined) || "";
            const fieldShowSelected =
              (stepFormData["fieldShowSelected"] as
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
                resetFields={[]}
                {...(onReset ? { onReset } : {})}
                resetLabel="Reset"
              >
                <Fields
                  field_ids={formState.field_ids ?? []}
                  field_resources={currentPersonaData?.field_resources ?? []}
                  show_fields={currentPersonaData?.show_fields ?? false}
                  field_suggestions={
                    currentPersonaData?.field_suggestions ?? []
                  }
                  fields={currentPersonaData?.fields ?? []}
                  parameterIdFilter={parameterId}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, field_ids: ids }))
                  }
                  label=""
                  required={false}
                  group_id={currentPersonaData?.group_id ?? null}
                  agent_id={currentPersonaData?.fields_agent_id ?? null}
                  searchTerm={fieldSearchTerm}
                  showSelectedFilter={fieldShowSelected}
                />
              </StepCard>
            );
          }
          return null;
      }
    },
    [
      // Use stablePersonaDataFields instead of personaData to prevent callback recreation
      // when only object reference changes (but content is same)
      stablePersonaDataFields,
      disabled,
      isEditMode,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateInstructions,
      handleGenerateDepartments,
      handleGenerateFlags,
      handleGenerateExamples,
      isGenerating,
      stepResources,
      // Depend on individual formState fields instead of whole object to prevent callback recreation
      // when object reference changes but values are same
      formState.name_id,
      formState.description_id,
      formState.color_id,
      formState.icon_id,
      formState.instructions_id,
      formState.active_flag_id,
      // Include arrays - they're used in the callback, but the formState sync effect ensures
      // they only change when content actually changes (not just reference)
      formState.department_ids,
      formState.field_ids,
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
export default React.memo(PersonaComponent, (prevProps, nextProps) => {
  // Compare personaData by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.personaData?.name_id,
    description_id: prevProps.personaData?.description_id,
    color_id: prevProps.personaData?.color_id,
    icon_id: prevProps.personaData?.icon_id,
    instructions_id: prevProps.personaData?.instructions_id,
    active_flag_id: prevProps.personaData?.active_flag_id,
    department_ids: prevProps.personaData?.department_ids,
    field_ids: prevProps.personaData?.field_ids,
    example_ids: prevProps.personaData?.example_ids,
  };
  const nextIds = {
    name_id: nextProps.personaData?.name_id,
    description_id: nextProps.personaData?.description_id,
    color_id: nextProps.personaData?.color_id,
    icon_id: nextProps.personaData?.icon_id,
    instructions_id: nextProps.personaData?.instructions_id,
    active_flag_id: nextProps.personaData?.active_flag_id,
    department_ids: nextProps.personaData?.department_ids,
    field_ids: nextProps.personaData?.field_ids,
    example_ids: nextProps.personaData?.example_ids,
  };

  // Compare primitive props
  if (
    prevProps.personaId !== nextProps.personaId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  // Compare function props by reference (should be stable from server actions)
  if (
    prevProps.savePersonaAction !== nextProps.savePersonaAction ||
    prevProps.patchPersonaDraftAction !== nextProps.patchPersonaDraftAction ||
    prevProps.createNamesAction !== nextProps.createNamesAction ||
    prevProps.createDescriptionsAction !== nextProps.createDescriptionsAction ||
    prevProps.createColorsAction !== nextProps.createColorsAction ||
    prevProps.createInstructionsAction !== nextProps.createInstructionsAction ||
    prevProps.createExamplesAction !== nextProps.createExamplesAction ||
    prevProps.createDocumentsAction !== nextProps.createDocumentsAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
