/**
 * PersonaNew.tsx
 * New implementation using modular resource components
 * Used to create and manage personas - supports both creation and editing
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
import { Colors } from "@/components/resources/Colors";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Examples } from "@/components/resources/Examples";
import { Fields } from "@/components/resources/Fields";
import { Flags } from "@/components/resources/Flags";
import { Icons } from "@/components/resources/Icons";
import { Instructions } from "@/components/resources/Instructions";
import { Names } from "@/components/resources/Names";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { Loader2, Sparkles } from "lucide-react";
import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

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
type CreateDraftIconsIn = InputOf<"/api/v4/resources/icons", "post">;
type CreateDraftIconsOut = OutputOf<"/api/v4/resources/icons", "post">;
type CreateDraftInstructionsIn = InputOf<
  "/api/v4/resources/instructions",
  "post"
>;
type CreateDraftInstructionsOut = OutputOf<
  "/api/v4/resources/instructions",
  "post"
>;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftExamplesIn = InputOf<"/api/v4/resources/examples", "post">;
type CreateDraftExamplesOut = OutputOf<"/api/v4/resources/examples", "post">;
type PatchPersonaDraftIn = InputOf<"/api/v4/personas/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<"/api/v4/personas/draft", "patch">;

type PersonaData = OutputOf<"/api/v4/personas/get", "post">;

export interface PersonaNewProps {
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
  createIconsAction?: (
    input: CreateDraftIconsIn
  ) => Promise<CreateDraftIconsOut>;
  createInstructionsAction?: (
    input: CreateDraftInstructionsIn
  ) => Promise<CreateDraftInstructionsOut>;
  createFlagsAction?: (
    input: CreateDraftFlagsIn
  ) => Promise<CreateDraftFlagsOut>;
  createExamplesAction?: (
    input: CreateDraftExamplesIn
  ) => Promise<CreateDraftExamplesOut>;
}

function PersonaNewComponent({
  personaId,
  personaData,
  savePersonaAction,
  patchPersonaDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createColorsAction,
  createIconsAction,
  createInstructionsAction,
  createFlagsAction,
  createExamplesAction,
}: PersonaNewProps) {
  const router = useRouter();
  const isEditMode = !!personaId;
  const {
    effectiveProfile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

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

  // Helper to check if a resource type can be regenerated
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      switch (resourceType) {
        case "names":
          return personaData?.name_resource?.generated ?? false;
        case "descriptions":
          return personaData?.description_resource?.generated ?? false;
        case "colors":
          return personaData?.color_resource?.generated ?? false;
        case "icons":
          return personaData?.icon_resource?.generated ?? false;
        case "instructions":
          return personaData?.instructions_resource?.generated ?? false;
        case "flags":
          return personaData?.flag_resource?.generated ?? false;
        case "departments":
          return (
            personaData?.department_resources?.some((d) => d.generated) ?? false
          );
        case "fields":
          return (
            personaData?.field_resources?.some((f) => f.generated) ?? false
          );
        case "examples":
          return (
            personaData?.example_resources?.some((e) => e.generated) ?? false
          );
        default:
          return false;
      }
    },
    [personaData]
  );

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  const personaSearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
    // Search params (URL-backed, updated via debounced callback in StepCard)
    colorSearch: parseAsString,
    iconSearch: parseAsString,
    // Filter params (URL-backed)
    colorShowSelected: parseAsBoolean,
    iconShowSelected: parseAsBoolean,
  } as const;

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  const getInitialFormState = useCallback(() => {
    const data = personaData;
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
    };
  }, [personaData]);

  const [formState, setFormState] = useState(getInitialFormState);

  // Update form state when server data changes
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
          JSON.stringify(newState.example_ids)
      ) {
        return newState;
      }
      return prev;
    });
  }, [getInitialFormState]);

  // Draft version tracking for optimistic concurrency control
  const [lastSavedVersion, setLastSavedVersion] = useState(0);

  // Get draftId from URL for draft change listener and profile sync
  // GenericForm also manages this via nuqs, but we need it here for the draft listener
  const [draftIdState, setDraftIdState] = useQueryStates(
    { draftId: parseAsString },
    {
      history: "replace",
      shallow: true,
    }
  );
  const draftId = draftIdState.draftId || null;
  const setDraftId = useCallback(
    (value: string | null) => setDraftIdState({ draftId: value }),
    [setDraftIdState]
  );

  // Sync URL draftId to profile context
  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  // Draft change listener - watches resource IDs and patches draft
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
      formState.example_ids.length > 0;

    if (!hasResourceIds || !patchPersonaDraftAction) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const result = await patchPersonaDraftAction({
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
            expected_version: lastSavedVersion,
          },
        });
        if (!draftId && result.draft_id) {
          // Update URL when draft is created (GenericForm will also sync this)
          setDraftId(result.draft_id);
        }
        setLastSavedVersion(result.new_version ?? 0);
      } catch {
        // Failed to save draft - error already logged by API
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    formState.name_id,
    formState.description_id,
    formState.color_id,
    formState.icon_id,
    formState.instructions_id,
    formState.active_flag_id,
    formState.department_ids,
    formState.field_ids,
    formState.example_ids,
    draftId,
    lastSavedVersion,
    patchPersonaDraftAction,
    setDraftId,
  ]);

  // WebSocket handlers for AI generation - unified handler for all resource types
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleGenerationComplete = (data: {
      success: boolean;
      resource_type?: string;
      message?: string;
      [key: string]: unknown;
    }) => {
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

    const handleGenerationStart = (data: {
      resource_types?: string[];
      draft_id?: string;
      persona_id?: string;
      success?: boolean;
      message?: string;
    }) => {
      // Optional: Acknowledge generation start
      if (data.success && data.resource_types) {
        // Generation started successfully
      }
    };

    const handleGenerationError = (data: {
      success: boolean;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
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

    // Listen to unified events
    socket.on("personas_generation_start", handleGenerationStart);
    socket.on("personas_generation_complete", handleGenerationComplete);
    socket.on("personas_generation_error", handleGenerationError);

    return () => {
      socket.off("personas_generation_start", handleGenerationStart);
      socket.off("personas_generation_complete", handleGenerationComplete);
      socket.off("personas_generation_error", handleGenerationError);
    };
  }, [socket, isConnected]);

  // Multi-generation handler - accepts list of resource types and optional user instructions
  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[], userInstructions?: string) => {
      if (!socket || !isConnected || !draftId) {
        toast.error("WebSocket not connected or draft not available");
        return;
      }

      // Set all resources as generating
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      // Emit single event with resource_types array
      // Note: group_ids are fetched server-side from database, not passed from frontend
      socket.emit("persona_generate", {
        draft_id: draftId,
        resource_types: resourceTypes,
        persona_id: personaId || null,
        instructions: userInstructions || null, // Renamed from user_instructions
        context: {
          name_id: formState.name_id || null,
          description_id: formState.description_id || null,
          instructions_id: formState.instructions_id || null,
          color_id: formState.color_id || null,
          icon_id: formState.icon_id || null,
          field_ids: formState.field_ids || [],
          department_ids: formState.department_ids || [],
          example_ids: formState.example_ids || [],
        },
      });
    },
    [socket, isConnected, draftId, personaId, formState]
  );

  // Individual generation handlers - generate directly without modals
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

  // GenericForm will manage URL state via nuqs parsers
  // We'll merge formState (resource IDs) with GenericForm's formData (URL params) when needed

  // Disabled logic based on can_edit flag - standardized for all resource components
  const disabled = useMemo(() => {
    if (!isEditMode || !personaData) return false;
    return !personaData.can_edit;
  }, [isEditMode, personaData]);

  // Set breadcrumb context when persona data is loaded
  useEffect(() => {
    const personaName = personaData?.name_resource?.name;
    if (personaName && personaId && isEditMode) {
      setEntityMetadata({
        entityId: personaId,
        entityName: personaName,
        entityType: "persona",
      });
    }
    return () => clearEntityMetadata();
  }, [
    personaData,
    personaId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs
      if (!formState.name_id) {
        toast.error("Persona name is required");
        throw new Error("Persona name is required");
      }

      if (!formState.color_id) {
        toast.error("Persona color is required");
        throw new Error("Persona color is required");
      }

      if (!formState.icon_id) {
        toast.error("Persona icon is required");
        throw new Error("Persona icon is required");
      }

      if (!formState.instructions_id) {
        toast.error("Instructions are required");
        throw new Error("Instructions are required");
      }

      // Pass department_ids directly - SQL handles validation via validate_department_create_permissions/validate_department_update_permissions

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!savePersonaAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      try {
        await savePersonaAction({
          body: {
            input_persona_id: isEditMode ? personaId! : null,
            name_id: formState.name_id,
            description_id: formState.description_id || null,
            color_id: formState.color_id,
            icon_id: formState.icon_id,
            instructions_id: formState.instructions_id,
            active_flag_id: formState.active_flag_id || null,
            department_ids: formState.department_ids || [],
            field_ids: formState.field_ids || [],
            example_ids: formState.example_ids || [],
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
      effectiveProfile?.id,
      savePersonaAction,
      router,
    ]
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasFields = formState.field_ids.length > 0;
      const hasColor = !!formState.color_id;
      const hasIcon = !!formState.icon_id;
      const hasInstructions = !!formState.instructions_id;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "fields":
          if (!hasName || !hasDescription) return "pending";
          return hasFields ? "completed" : "active";
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

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions"],
      fields: ["fields"],
      color: ["colors"],
      icon: ["icons"],
      content: ["instructions", "examples"],
    }),
    []
  );

  // Resource labels for display
  const resourceLabels: Record<ResourceType, string> = useMemo(
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
          label: resourceLabels[rt],
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
      await handleGenerateResources(
        resourceTypes,
        instructions.trim() || undefined
      );
      setShowGenerateModal(false);
      setModalInstructions("");
    },
    [handleGenerateResources]
  );

  // Steps configuration for GenericForm
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
        id: "fields",
        title: "Fields",
        description: "Select fields for this persona.",
        resetFields: ["field_ids"],
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
          "Define instructions and example messages for the persona.",
        resetFields: ["instructions", "examples"],
      },
    ],
    []
  );

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
      "examples",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
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
                <>
                  <Names
                    name_id={formState.name_id ?? null}
                    name_resource={personaData?.name_resource ?? null}
                    show_name={personaData?.show_name ?? true}
                    name_suggestions={personaData?.name_suggestions ?? []}
                    disabled={disabled}
                    onNameIdChange={(nameId) =>
                      setFormState((prev) => ({ ...prev, name_id: nameId }))
                    }
                    onGenerate={handleGenerateName}
                    isGenerating={isGenerating("names")}
                    placeholder="e.g., Enthusiastic Student"
                    defaultName="New Persona"
                    required
                    createNamesAction={
                      createNamesAction as
                        | ((
                            input: CreateDraftNamesIn
                          ) => Promise<CreateDraftNamesOut>)
                        | undefined
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1 px-2">
                    {stepDescription}
                  </p>
                </>
              }
              resetFields={["name", "description", "department_ids", "active"]}
              actions={
                stepResources["basic"] && stepResources["basic"].length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const hasRegeneratable = stepResources["basic"]!.some(
                        (rt) => canRegenerate(rt)
                      );
                      handleOpenStepCardModal(
                        "basic",
                        hasRegeneratable ? "regenerate" : "generate"
                      );
                    }}
                    disabled={
                      disabled ||
                      stepResources["basic"]!.some((rt) => isGenerating(rt))
                    }
                  >
                    {stepResources["basic"]!.some((rt) => isGenerating(rt)) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
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
                    personaData?.description_resource ?? null
                  }
                  show_description={personaData?.show_description ?? true}
                  description_suggestions={
                    personaData?.description_suggestions ?? []
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
                  placeholder="Detailed behavior description and personality traits"
                  required={false}
                  rows={4}
                  data-testid="input-persona-description"
                  createDescriptionsAction={createDescriptionsAction}
                />

                {/* Department Selection */}
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={personaData?.department_resources ?? []}
                  show_departments={personaData?.show_departments ?? false}
                  department_suggestions={
                    personaData?.department_suggestions ?? []
                  }
                  departments={personaData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  active_flag_id={formState.active_flag_id ?? null}
                  flag_resource={personaData?.flag_resource ?? null}
                  show_flag={personaData?.show_flag ?? false}
                  disabled={disabled}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  label="Active"
                  helpText="Inactive personas will not be available for scenarios"
                  {...((formState.icon_id ||
                    personaData?.flag_resource?.icon_id) && {
                    iconId: (formState.icon_id ||
                      personaData?.flag_resource?.icon_id) as string,
                  })}
                  createFlagsAction={createFlagsAction}
                />
              </div>
            </StepCard>
          );

        case "fields":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["field_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["fields"] &&
                stepResources["fields"].length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const hasRegeneratable = stepResources["fields"]!.some(
                        (rt) => canRegenerate(rt)
                      );
                      handleOpenStepCardModal(
                        "fields",
                        hasRegeneratable ? "regenerate" : "generate"
                      );
                    }}
                    disabled={
                      disabled ||
                      stepResources["fields"]!.some((rt) => isGenerating(rt))
                    }
                  >
                    {stepResources["fields"]!.some((rt) => isGenerating(rt)) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                ) : undefined
              }
            >
              <Fields
                field_ids={formState.field_ids ?? []}
                field_resources={personaData?.field_resources ?? []}
                show_fields={personaData?.show_fields ?? false}
                field_suggestions={personaData?.field_suggestions ?? []}
                fields={personaData?.fields ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, field_ids: ids }))
                }
                label="Fields"
                description="Select fields for this persona"
              />
            </StepCard>
          );

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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const hasRegeneratable = stepResources["color"]!.some(
                        (rt) => canRegenerate(rt)
                      );
                      handleOpenStepCardModal(
                        "color",
                        hasRegeneratable ? "regenerate" : "generate"
                      );
                    }}
                    disabled={
                      disabled ||
                      stepResources["color"]!.some((rt) => isGenerating(rt))
                    }
                  >
                    {stepResources["color"]!.some((rt) => isGenerating(rt)) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                ) : undefined
              }
            >
              {/* Color picker - using Colors resource component */}
              <Colors
                color_id={formState.color_id ?? null}
                color_resource={personaData?.color_resource ?? null}
                show_color={personaData?.show_color ?? false}
                color_suggestions={personaData?.color_suggestions ?? []}
                colors={personaData?.colors ?? []}
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
                createColorsAction={createColorsAction}
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const hasRegeneratable = stepResources["icon"]!.some(
                        (rt) => canRegenerate(rt)
                      );
                      handleOpenStepCardModal(
                        "icon",
                        hasRegeneratable ? "regenerate" : "generate"
                      );
                    }}
                    disabled={
                      disabled ||
                      stepResources["icon"]!.some((rt) => isGenerating(rt))
                    }
                  >
                    {stepResources["icon"]!.some((rt) => isGenerating(rt)) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                ) : undefined
              }
            >
              {/* Icon picker - using Icons resource component */}
              <Icons
                icon_id={formState.icon_id ?? null}
                icon_resource={personaData?.icon_resource ?? null}
                show_icon={personaData?.show_icon ?? false}
                icon_suggestions={personaData?.icon_suggestions ?? []}
                icons={personaData?.icons ?? []}
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
                createIconsAction={createIconsAction}
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
                stepResources["content"].length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const hasRegeneratable = stepResources["content"]!.some(
                        (rt) => canRegenerate(rt)
                      );
                      handleOpenStepCardModal(
                        "content",
                        hasRegeneratable ? "regenerate" : "generate"
                      );
                    }}
                    disabled={
                      disabled ||
                      stepResources["content"]!.some((rt) => isGenerating(rt))
                    }
                  >
                    {stepResources["content"]!.some((rt) =>
                      isGenerating(rt)
                    ) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                ) : undefined
              }
            >
              {/* Instructions - using Instructions resource component */}
              <Instructions
                instructions_id={formState.instructions_id ?? null}
                instructions_resource={
                  personaData?.instructions_resource ?? null
                }
                show_instructions={personaData?.show_instructions ?? true}
                instructions_suggestions={
                  personaData?.instructions_suggestions ?? []
                }
                disabled={disabled}
                onInstructionsIdChange={(instructionsId) =>
                  setFormState((prev) => ({
                    ...prev,
                    instructions_id: instructionsId,
                  }))
                }
                onGenerate={handleGenerateInstructions}
                isGenerating={isGenerating("instructions")}
                label="Instructions"
                placeholder="Instructions that define how the persona should behave and respond."
                required
                rows={8}
                helpText="Define the persona's behavior, communication style, and response patterns"
                data-testid="input-instructions"
                createInstructionsAction={createInstructionsAction}
              />

              {/* Examples Section */}
              <Examples
                example_ids={formState.example_ids ?? []}
                example_resources={personaData?.example_resources ?? []}
                show_examples={personaData?.show_examples ?? false}
                example_suggestions={personaData?.example_suggestions ?? []}
                examples={personaData?.examples ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, example_ids: ids }))
                }
                maxItems={10}
                addButtonLabel="Add example"
                itemPlaceholder="Message"
                createExamplesAction={createExamplesAction}
                exampleMapping={
                  personaData?.examples && formState.example_ids
                    ? Object.fromEntries(
                        personaData.examples
                          .map((ex, idx) => [
                            formState.example_ids?.[idx] || "",
                            ex.example || "",
                          ])
                          .filter(([id]) => id)
                      )
                    : {}
                }
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      personaData,
      disabled,
      isEditMode,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateInstructions,
      isGenerating,
      stepResources,
      formState,
      createNamesAction,
      createDescriptionsAction,
      createColorsAction,
      createIconsAction,
      createInstructionsAction,
      createFlagsAction,
      createExamplesAction,
      canRegenerate,
      handleOpenStepCardModal,
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
export default React.memo(PersonaNewComponent);
