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

import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";

import type {
  CreateDraftColorsIn,
  CreateDraftColorsOut,
  CreateDraftDescriptionsIn,
  CreateDraftDescriptionsOut,
  CreateDraftFlagsIn,
  CreateDraftFlagsOut,
  CreateDraftIconsIn,
  CreateDraftIconsOut,
  CreateDraftInstructionsIn,
  CreateDraftInstructionsOut,
  CreateDraftNamesIn,
  CreateDraftNamesOut,
  SavePersonaIn,
  SavePersonaOut,
} from "@/app/(main)/create/personas/p/[personaId]/page";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import { Colors } from "@/components/resources/Colors";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Examples } from "@/components/resources/Examples";
import { Fields } from "@/components/resources/Fields";
import { Flags } from "@/components/resources/Flags";
import { Icons } from "@/components/resources/Icons";
import { Instructions } from "@/components/resources/Instructions";
import { Names } from "@/components/resources/Names";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { transformDepartmentIdsForSubmit } from "@/utils/department-picker-helpers";
import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

type PersonaDetailOut = OutputOf<"/api/v4/personas/get", "post">;
type PersonaNewOut = OutputOf<"/api/v4/personas/get", "post">;

export interface PersonaNewProps {
  personaId?: string;
  mode?: "create" | "edit";
  // Server-provided data (for server-side rendering)
  personaDetail?: PersonaDetailOut;
  personaDetailDefault?: PersonaNewOut;
  // Server actions (replaces useMutation)
  savePersonaAction?: (input: SavePersonaIn) => Promise<SavePersonaOut>;
  patchPersonaDraftAction?: (input: {
    body: {
      input_draft_id: string | null;
      name_id: string | null;
      description_id: string | null;
      color_id: string | null;
      icon_id: string | null;
      instructions_id: string | null;
      active_flag_id: string | null;
      department_ids: string[];
      field_ids: string[];
      example_ids: string[];
      expected_version: number;
    };
  }) => Promise<{
    draft_id: string;
    new_version: number;
    draft_exists: boolean;
  }>;
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
    input: InputOf<"/api/v4/resources/examples", "post">
  ) => Promise<OutputOf<"/api/v4/resources/examples", "post">>;
}

function PersonaNewComponent({
  personaId,
  mode = personaId ? "edit" : "create",
  personaDetail: serverPersonaDetail,
  personaDetailDefault: serverPersonaDetailDefault,
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
  const isEditMode = mode === "edit" && !!personaId;
  const {
    effectiveProfile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Generation state for AI workflows
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingInstructions, setIsGeneratingInstructions] =
    useState(false);

  // Stabilize server props to prevent unnecessary re-renders from object reference changes
  // Generate stable ID from server props content (same logic as in GenericForm)
  const stabilizeServerProp = React.useCallback(
    (
      data: typeof serverPersonaDetail | typeof serverPersonaDetailDefault
    ): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("persona_id" in data && data.persona_id) {
          return `persona_id:${String(data.persona_id)}`;
        }
        const keyFields: Record<string, unknown> = {};
        if ("colors" in data) {
          keyFields["colors"] = Array.isArray(data["colors"])
            ? data["colors"].length
            : data["colors"];
        }
        if ("icons" in data) {
          keyFields["icons"] = Array.isArray(data["icons"])
            ? data["icons"].length
            : data["icons"];
        }
        if ("icon_suggestions" in data) {
          keyFields["icon_suggestions"] = Array.isArray(
            data["icon_suggestions"]
          )
            ? data["icon_suggestions"].length
            : data["icon_suggestions"];
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

  const personaDetailId = React.useMemo(
    () => stabilizeServerProp(serverPersonaDetail),
    [serverPersonaDetail, stabilizeServerProp]
  );
  const personaDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverPersonaDetailDefault),
    [serverPersonaDetailDefault, stabilizeServerProp]
  );

  // Use refs to track latest server props (for effect access) and stable props (for render)
  const latestServerPersonaDetailRef = React.useRef(serverPersonaDetail);
  const latestServerPersonaDetailDefaultRef = React.useRef(
    serverPersonaDetailDefault
  );

  // Update latest refs on every render (no effect needed - just sync)
  latestServerPersonaDetailRef.current = serverPersonaDetail;
  latestServerPersonaDetailDefaultRef.current = serverPersonaDetailDefault;

  // Use refs to track stable server props - only update when ID changes
  const stablePersonaDetailRef = React.useRef<{
    data: typeof serverPersonaDetail;
    id: string | null;
  }>({
    data: serverPersonaDetail,
    id: personaDetailId,
  });
  const stablePersonaDetailDefaultRef = React.useRef<{
    data: typeof serverPersonaDetailDefault;
    id: string | null;
  }>({
    data: serverPersonaDetailDefault,
    id: personaDetailDefaultId,
  });

  React.useEffect(() => {
    // Only update when ID actually changes, use latest ref for data
    if (stablePersonaDetailRef.current.id !== personaDetailId) {
      stablePersonaDetailRef.current = {
        data: latestServerPersonaDetailRef.current,
        id: personaDetailId,
      };
    }
  }, [personaDetailId]); // Only depend on ID, not object reference

  React.useEffect(() => {
    // Only update when ID actually changes, use latest ref for data
    if (stablePersonaDetailDefaultRef.current.id !== personaDetailDefaultId) {
      stablePersonaDetailDefaultRef.current = {
        data: latestServerPersonaDetailDefaultRef.current,
        id: personaDetailDefaultId,
      };
    }
  }, [personaDetailDefaultId]); // Only depend on ID, not object reference

  // Use stable references
  const personaDetail = stablePersonaDetailRef.current.data;
  const personaDetailDefault = stablePersonaDetailDefaultRef.current.data;

  // Use edit detail when editing, default detail when creating
  // Stabilize based on content ID, not object reference, to prevent unnecessary re-renders
  const personaDataId = React.useMemo(() => {
    const data = isEditMode ? personaDetail : personaDetailDefault;
    if (!data) return null;
    if (typeof data === "object" && data !== null) {
      if ("persona_id" in data && data.persona_id) {
        return `persona_id:${String(data.persona_id)}`;
      }
      // For new personas, create stable hash from immutable fields
      const keyFields: Record<string, unknown> = {};
      if ("colors" in data) {
        keyFields["colors"] = Array.isArray(data["colors"])
          ? data["colors"].length
          : data["colors"];
      }
      if ("icons" in data) {
        keyFields["icons"] = Array.isArray(data["icons"])
          ? data["icons"].length
          : data["icons"];
      }
      if ("icon_suggestions" in data) {
        keyFields["icon_suggestions"] = Array.isArray(data["icon_suggestions"])
          ? data["icon_suggestions"].length
          : data["icon_suggestions"];
      }
      if ("valid_department_ids" in data) {
        keyFields["valid_department_ids"] = Array.isArray(
          data["valid_department_ids"]
        )
          ? data["valid_department_ids"].sort().join(",")
          : data["valid_department_ids"];
      }
      const sortedKeys = Object.keys(keyFields).sort();
      const hash = sortedKeys
        .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
        .join("|");
      return `new:${hash.length}:${hash.slice(0, 100)}`;
    }
    return String(data);
  }, [isEditMode, personaDetail, personaDetailDefault]);

  // Use ref to track stable personaData - only update when ID changes
  const stablePersonaDataRef = React.useRef<{
    data: typeof personaDetail | typeof personaDetailDefault;
    id: string | null;
  }>({
    data: isEditMode ? personaDetail : personaDetailDefault,
    id: personaDataId,
  });

  React.useEffect(() => {
    if (stablePersonaDataRef.current.id !== personaDataId) {
      stablePersonaDataRef.current = {
        data: isEditMode ? personaDetail : personaDetailDefault,
        id: personaDataId,
      };
    }
  }, [isEditMode, personaDetail, personaDetailDefault, personaDataId]);

  const personaData = stablePersonaDataRef.current.data;

  // Inline parsers for URL-backed state (navigation/search params only - form fields moved to local state)
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

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams, setUrlParams] = useQueryStates(personaSearchParamsClient, {
    history: "replace",
    shallow: true, // Use shallow routing to prevent server component re-renders
  });

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  const getInitialFormState = useCallback(() => {
    const data = isEditMode ? personaDetail : personaDetailDefault;
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
      name_id:
        (data as PersonaDetailOut & { name_id?: string | null })?.name_id ||
        null,
      description_id:
        (data as PersonaDetailOut & { description_id?: string | null })
          ?.description_id || null,
      color_id:
        (data as PersonaDetailOut & { color_id?: string | null })?.color_id ||
        null,
      icon_id:
        (data as PersonaDetailOut & { icon_id?: string | null })?.icon_id ||
        null,
      instructions_id:
        (data as PersonaDetailOut & { instructions_id?: string | null })
          ?.instructions_id || null,
      active_flag_id:
        (data as PersonaDetailOut & { active_flag_id?: string | null })
          ?.active_flag_id || null,
      department_ids: data.department_ids || [],
      field_ids:
        (data as PersonaDetailOut & { field_ids?: string[] })?.field_ids || [],
      example_ids:
        (data as PersonaDetailOut & { example_ids?: string[] })?.example_ids ||
        [],
    };
  }, [isEditMode, personaDetail, personaDetailDefault]);

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
          // Update URL when draft is created
          setUrlParams({ draftId: result.draft_id });
        }
        setLastSavedVersion(result.new_version);
      } catch (error) {
        console.error("Failed to save draft:", error);
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
    setUrlParams,
  ]);

  // WebSocket handlers for AI generation
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNamesComplete = (data: {
      success: boolean;
      name?: string;
      message?: string;
    }) => {
      setIsGeneratingName(false);
      if (data.success && data.name) {
        // Component manages its own state - no need to update formState
        toast.success(data.message || "Name generated successfully");
      } else {
        toast.error(data.message || "Failed to generate name");
      }
    };

    const handleDescriptionsComplete = (data: {
      success: boolean;
      description?: string;
      message?: string;
    }) => {
      setIsGeneratingDescription(false);
      if (data.success && data.description) {
        // Component manages its own state - no need to update formState
        toast.success(data.message || "Description generated successfully");
      } else {
        toast.error(data.message || "Failed to generate description");
      }
    };

    const handleInstructionsComplete = (data: {
      success: boolean;
      instructions?: string;
      message?: string;
    }) => {
      setIsGeneratingInstructions(false);
      if (data.success && data.instructions) {
        // Component manages its own state - no need to update formState
        toast.success(data.message || "Instructions generated successfully");
      } else {
        toast.error(data.message || "Failed to generate instructions");
      }
    };

    const handleGenerationError = (data: {
      success: boolean;
      message?: string;
      resource_type?: string;
    }) => {
      if (data.resource_type === "names") {
        setIsGeneratingName(false);
      } else if (data.resource_type === "descriptions") {
        setIsGeneratingDescription(false);
      } else if (data.resource_type === "instructions") {
        setIsGeneratingInstructions(false);
      }
      toast.error(data.message || "Generation failed");
    };

    socket.on("personas_names_generation_complete", handleNamesComplete);
    socket.on(
      "personas_descriptions_generation_complete",
      handleDescriptionsComplete
    );
    socket.on(
      "personas_instructions_generation_complete",
      handleInstructionsComplete
    );
    socket.on("personas_generation_error", handleGenerationError);

    return () => {
      socket.off("personas_names_generation_complete", handleNamesComplete);
      socket.off(
        "personas_descriptions_generation_complete",
        handleDescriptionsComplete
      );
      socket.off(
        "personas_instructions_generation_complete",
        handleInstructionsComplete
      );
      socket.off("personas_generation_error", handleGenerationError);
    };
  }, [socket, isConnected]);

  // Generation handlers
  const handleGenerateName = useCallback(async () => {
    if (!socket || !isConnected || !draftId) {
      toast.error("WebSocket not connected or draft not available");
      return;
    }

    setIsGeneratingName(true);
    socket.emit("persona_generate", {
      draft_id: draftId,
      resource_type: "names",
      persona_id: personaId || null,
      context: {
        name_id: formState.name_id || null,
        description_id: formState.description_id || null,
      },
    });
  }, [socket, isConnected, draftId, personaId, formState]);

  const handleGenerateDescription = useCallback(async () => {
    if (!socket || !isConnected || !draftId) {
      toast.error("WebSocket not connected or draft not available");
      return;
    }

    setIsGeneratingDescription(true);
    socket.emit("persona_generate", {
      draft_id: draftId,
      resource_type: "descriptions",
      persona_id: personaId || null,
      context: {
        name_id: formState.name_id || null,
        description_id: formState.description_id || null,
      },
    });
  }, [socket, isConnected, draftId, personaId, formState]);

  const handleGenerateInstructions = useCallback(async () => {
    if (!socket || !isConnected || !draftId) {
      toast.error("WebSocket not connected or draft not available");
      return;
    }

    setIsGeneratingInstructions(true);
    socket.emit("persona_generate", {
      draft_id: draftId,
      resource_type: "instructions",
      persona_id: personaId || null,
      context: {
        name_id: formState.name_id || null,
        description_id: formState.description_id || null,
        instructions_id: formState.instructions_id || null,
      },
    });
  }, [socket, isConnected, draftId, personaId, formState]);

  // Merge formState with urlParams for formData (GenericForm expects single formData object)
  const formData = useMemo(() => {
    return {
      ...formState,
      colorSearch: urlParams.colorSearch || null,
      iconSearch: urlParams.iconSearch || null,
      colorShowSelected: urlParams.colorShowSelected || null,
      iconShowSelected: urlParams.iconShowSelected || null,
    } as Record<string, unknown>;
  }, [formState, urlParams]);

  // Wrapper for setFormData that updates formState for form fields, urlParams for navigation
  const setFormData = useCallback(
    (
      updates:
        | Partial<Record<string, unknown>>
        | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>)
    ) => {
      // Handle function form
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      const formUpdates: Partial<typeof formState> = {};
      const urlUpdates: Partial<Record<string, unknown>> = {};

      Object.entries(resolvedUpdates).forEach(([key, value]) => {
        if (
          key === "name" ||
          key === "description" ||
          key === "instructions" ||
          key === "color" ||
          key === "icon" ||
          key === "active" ||
          key === "departmentIds" ||
          key === "field_ids" ||
          key === "examples"
        ) {
          formUpdates[key as keyof typeof formState] = value as never;
        } else if (
          key === "colorSearch" ||
          key === "iconSearch" ||
          key === "colorShowSelected" ||
          key === "iconShowSelected"
        ) {
          urlUpdates[key] = value;
        }
      });

      if (Object.keys(formUpdates).length > 0) {
        setFormState((prev) => ({ ...prev, ...formUpdates }));
      }
      if (Object.keys(urlUpdates).length > 0) {
        // Check if URL params actually changed before updating
        const hasChanges = Object.keys(urlUpdates).some((key) => {
          const newValue = urlUpdates[key];
          const currentValue = urlParams[key as keyof typeof urlParams];
          return newValue !== currentValue;
        });

        if (hasChanges) {
          setUrlParams(urlUpdates as Parameters<typeof setUrlParams>[0]);
        }
      }
    },
    [formData, setUrlParams, urlParams]
  );

  // Extract specific form values to avoid re-renders when formData object reference changes
  const colorSearch = urlParams.colorSearch || "";
  const iconSearch = urlParams.iconSearch || "";

  // Get color options from server, convert to ColorItem format
  const presetColorsAll = useMemo(() => {
    const colors =
      (
        personaData as PersonaDetailOut & {
          colors?: Array<{
            id: string;
            name: string;
            description: string;
            hex_code: string;
          }>;
        }
      )?.colors || [];

    // Convert resource format to ColorItem format
    return colors.map((c: { hex_code: string; name: string }) => ({
      hex: c.hex_code,
      name: c.name,
    }));
  }, [personaData]);

  // Filter colors client-side based on search state from URL
  // Also include custom colors that aren't in the preset list
  // NOTE: Colors component now handles this internally, but keeping for backward compatibility
  const _presetColors = useMemo(() => {
    // Get current color from color_resource
    const currentColorResource = (
      personaData as PersonaDetailOut & {
        color_resource?: {
          id: string;
          name: string;
          description: string;
          hex_code: string;
        } | null;
      }
    )?.color_resource;

    const currentColorHex = currentColorResource?.hex_code || null;

    // Normalize current color for comparison
    const normalizedCurrentColor = currentColorHex
      ? currentColorHex.toUpperCase().startsWith("#")
        ? currentColorHex.toUpperCase()
        : `#${currentColorHex.toUpperCase()}`
      : null;

    // Check if current color is custom (not in preset list)
    const isCustomColor =
      normalizedCurrentColor &&
      !presetColorsAll.some(
        (c: { hex: string }) => c.hex.toUpperCase() === normalizedCurrentColor
      );

    // Build colors list: custom color first (if exists), then preset colors
    let colors = [...presetColorsAll];
    if (isCustomColor && normalizedCurrentColor && currentColorResource) {
      colors = [
        {
          hex: normalizedCurrentColor,
          name: currentColorResource.name || normalizedCurrentColor,
        },
        ...presetColorsAll,
      ];
    }

    // Filter by search term if present (from URL-backed state)
    if (!colorSearch.trim()) {
      return colors;
    }
    const searchLower = colorSearch.toLowerCase();
    return colors.filter(
      (color: { name: string; hex: string }) =>
        color.name.toLowerCase().includes(searchLower) ||
        color.hex.toLowerCase().includes(searchLower)
    );
  }, [presetColorsAll, colorSearch, personaData]);

  // Get icon options from server
  const iconOptions = useMemo(
    () =>
      (
        personaData as PersonaDetailOut & {
          icons?: Array<{
            id: string;
            name: string;
            description: string;
            value: string;
          }>;
        }
      )?.icons || [],
    [personaData]
  );

  // Get icon suggestions (IDs) and map to icon names
  const iconSuggestionsIds = useMemo(
    () =>
      (
        personaData as PersonaDetailOut & {
          icon_suggestions?: string[];
        }
      )?.icon_suggestions || [],
    [personaData]
  );

  // Map icon suggestion IDs to icon names
  const suggestedIconsAll = useMemo(() => {
    const iconMap = new Map(
      iconOptions.map((icon: { id: string; value: string }) => [
        icon.id,
        icon.value,
      ])
    );
    return iconSuggestionsIds
      .map((id: string) => iconMap.get(id))
      .filter((name): name is string => !!name);
  }, [iconOptions, iconSuggestionsIds]);

  // All icons from options (suggested first, then others)
  const allIconsAll = useMemo(() => {
    const suggestedSet = new Set(suggestedIconsAll);
    const allIconNames = iconOptions.map(
      (icon: { value: string }) => icon.value
    );
    const otherIcons = allIconNames.filter(
      (iconName: string) => !suggestedSet.has(iconName)
    );
    return [...suggestedIconsAll, ...otherIcons];
  }, [suggestedIconsAll, iconOptions]);

  // Filter icons client-side based on search state from URL
  const allIcons = useMemo(() => {
    if (!iconSearch.trim()) {
      return allIconsAll;
    }
    const searchLower = iconSearch.toLowerCase();
    return allIconsAll.filter((icon: string) =>
      icon.toLowerCase().includes(searchLower)
    );
  }, [allIconsAll, iconSearch]);

  // Disabled logic based on can_edit flag - standardized for all resource components
  const disabled = useMemo(() => {
    if (!isEditMode || !personaData) return false;
    return !personaData.can_edit;
  }, [isEditMode, personaData]);

  // Keep isReadonly for backward compatibility with existing code
  const isReadonly = disabled;

  // Examples component manages its own mapping via exampleMapping prop

  // Helper to filter example_suggestions based on selected departments
  const getExamplesHistory = useCallback(
    (departmentIds: string[] | null | undefined) => {
      if (!personaData || !("example_suggestions" in personaData)) return [];
      const rawHistory =
        (
          personaData as PersonaDetailOut & {
            example_suggestions?: Array<{
              example: string;
              department_ids?: string[];
            }>;
          }
        )?.example_suggestions || [];
      const selectedDeptIds = departmentIds || [];

      // Convert to array of strings for autocomplete
      const examples: string[] = [];

      // If no departments selected, return all examples
      if (selectedDeptIds.length === 0) {
        rawHistory.forEach((ex) => {
          if (typeof ex === "string") {
            examples.push(ex);
          } else if (ex && typeof ex === "object") {
            const exWithDept = ex as {
              example: string;
              department_ids?: string[];
            };
            if ("example" in exWithDept) {
              examples.push(exWithDept.example);
            }
          }
        });
        return examples;
      }

      // Filter examples that:
      // 1. Have department_ids that intersect with selected departments
      // 2. Are cross-department (empty department_ids array)
      rawHistory.forEach(
        (ex: { example: string; department_ids?: string[] } | string) => {
          // Handle both new format (object with department_ids) and legacy format (string)
          if (typeof ex === "string") {
            examples.push(ex); // Legacy format - include all
          } else if (ex && typeof ex === "object") {
            const exWithDept = ex as {
              example: string;
              department_ids?: string[];
            };
            if ("example" in exWithDept) {
              const exDeptIds = exWithDept.department_ids || [];
              // Include if cross-department (empty) or intersects with selected departments
              if (
                exDeptIds.length === 0 ||
                exDeptIds.some((deptId) => selectedDeptIds.includes(deptId))
              ) {
                examples.push(exWithDept.example);
              }
            }
          }
        }
      );

      return examples;
    },
    [personaData]
  );

  // Form initialization function for GenericForm
  const initializeForm = useCallback(
    (serverData: unknown, editMode: boolean) => {
      if (
        !editMode ||
        !serverData ||
        typeof serverData !== "object" ||
        !("department_ids" in serverData)
      ) {
        return {};
      }

      // Components manage their own display state - formState only stores IDs
      // Resource IDs are already set via getInitialFormState, so no updates needed here
      // Return empty object for GenericForm compatibility
      return {};
    },
    []
  );

  // Set breadcrumb context when persona data is loaded
  useEffect(() => {
    const personaName = (
      personaDetail as PersonaDetailOut & {
        name_resource?: { name: string } | null;
      }
    )?.name_resource?.name;
    if (personaName && personaId && isEditMode) {
      setEntityMetadata({
        entityId: personaId,
        entityName: personaName,
        entityType: "persona",
      });
    }
    return () => clearEntityMetadata();
  }, [
    personaDetail,
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

      // Transform department IDs for submit (database handles superadmin logic)
      // Derive valid_department_ids from departments array
      const validDepartmentIds =
        personaData?.departments
          ?.map((d) => d.department_id)
          .filter((id): id is string => id !== null) || [];
      const finalDepartmentIds =
        transformDepartmentIdsForSubmit(
          formState.department_ids || [],
          false, // Always false - database handles superadmin logic via show_departments flag
          validDepartmentIds
        ) ?? [];

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
            department_ids: finalDepartmentIds,
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
      personaData,
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
      const hasColor = !!formState.color_id;
      const hasIcon = !!formState.icon_id;
      const hasInstructions = !!formState.instructions_id;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
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

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the persona name, description, departments, and active status.",
        resetFields: [
          "name",
          "description",
          "departmentIds",
          "field_ids",
          "active",
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
      "departmentIds",
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

  // Create stable filter onChange callbacks using memoized setFormData
  const createColorFilterOnChange = useCallback(
    (value: boolean) => {
      setFormData({ colorShowSelected: value || null });
    },
    [setFormData]
  );

  const createIconFilterOnChange = useCallback(
    (value: boolean) => {
      setFormData({ iconShowSelected: value || null });
    },
    [setFormData]
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
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              editableTitle={{
                value:
                  (stepFormData["name"] as string | null | undefined) ?? "",
                onChange: (value) => setStepFormData({ name: value || null }),
                placeholder: "e.g., Enthusiastic Student",
                defaultName: "New Persona",
                required: true,
              }}
              resetFields={[
                "name",
                "description",
                "departmentIds",
                "field_ids",
                "active",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                {/* Name field - using Names resource component */}
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
                  isGenerating={isGeneratingName}
                  label="Name"
                  placeholder="e.g., Enthusiastic Student"
                  required
                  createNamesAction={createNamesAction}
                />

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
                  isGenerating={isGeneratingDescription}
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

                {/* Fields Selection */}
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
              isReadonly={isReadonly}
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
                  onChange: createColorFilterOnChange,
                },
              ]}
              resetFields={["color", "colorSearch", "colorShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
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
                searchTerm={colorSearch}
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
              isReadonly={isReadonly}
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
                  onChange: createIconFilterOnChange,
                },
              ]}
              resetFields={["icon", "iconSearch", "iconShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              {/* Icon picker - using Icons resource component */}
              <Icons
                iconResource={
                  (
                    personaData as PersonaDetailOut & {
                      icon_resource?: {
                        id: string;
                        name: string;
                        description: string;
                        value: string;
                      } | null;
                    }
                  )?.icon_resource || null
                }
                iconId={formState.icon_id}
                onIconIdChange={(iconId) =>
                  setFormState((prev) => ({ ...prev, icon_id: iconId }))
                }
                allIcons={allIcons}
                suggestedIcons={suggestedIconsAll}
                disabled={isReadonly}
                searchTerm={iconSearch}
                onSearchChange={(term) =>
                  setStepFormData({ iconSearch: term || null })
                }
                showSelectedFilter={iconShowSelected}
                onShowSelectedChange={(value) =>
                  setStepFormData({ iconShowSelected: value || null })
                }
                {...((
                  personaData as PersonaDetailOut & {
                    icon_suggestions?: string[];
                  }
                )?.icon_suggestions && {
                  iconSuggestions: (
                    personaData as PersonaDetailOut & {
                      icon_suggestions?: string[];
                    }
                  ).icon_suggestions,
                })}
                createIconsAction={
                  createIconsAction as
                    | ((input: {
                        body: {
                          name: string;
                          description: string;
                          value: number;
                        };
                      }) => Promise<{ icon_id?: string | null }>)
                    | undefined
                }
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
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["instructions", "examples"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              {/* Instructions - using Instructions resource component */}
              <Instructions
                instructionsResource={
                  (
                    personaData as PersonaDetailOut & {
                      instructions_resource?: {
                        id: string;
                        template: string;
                      } | null;
                    }
                  )?.instructions_resource || null
                }
                instructionsId={formState.instructions_id}
                onInstructionsIdChange={(instructionsId) =>
                  setFormState((prev) => ({
                    ...prev,
                    instructions_id: instructionsId,
                  }))
                }
                onGenerate={handleGenerateInstructions}
                isGenerating={isGeneratingInstructions}
                label="Instructions"
                placeholder="Instructions that define how the persona should behave and respond."
                required
                disabled={isReadonly}
                rows={8}
                helpText="Define the persona's behavior, communication style, and response patterns"
                data-testid="input-instructions"
                {...((
                  personaData as PersonaDetailOut & {
                    instructions_suggestions?: string[]; // Note: Now UUIDs, but component expects strings - needs lookup
                  }
                )?.instructions_suggestions && {
                  suggestions: (
                    personaData as PersonaDetailOut & {
                      instructions_suggestions?: string[];
                    }
                  ).instructions_suggestions,
                })}
                createInstructionsAction={
                  createInstructionsAction as
                    | ((input: {
                        body: { template: string };
                      }) => Promise<{ instruction_id?: string | null }>)
                    | undefined
                }
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
      getExamplesHistory,
      createColorFilterOnChange,
      createIconFilterOnChange,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateInstructions,
      isGeneratingName,
      isGeneratingDescription,
      isGeneratingInstructions,
      colorSearch,
      iconSearch,
      formState,
      createNamesAction,
      createDescriptionsAction,
      createColorsAction,
      createIconsAction,
      createInstructionsAction,
      createFlagsAction,
      createExamplesAction,
      setStepFormData,
      stepFormData,
      onReset,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`persona-${isEditMode ? "edit" : "new"}`}
      >
        {isReadonly && (
          <div className="bg-muted border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-muted-foreground"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-foreground">
                  Persona is read-only
                </h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>
                    {(personaData as PersonaDetailOut)?.department_ids
                      ?.length === 0
                      ? "This is a default persona that cannot be edited. You can view the details but cannot make changes."
                      : "This persona is currently in use by scenarios and cannot be edited. You can view the details but cannot make changes."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <GenericForm
          nuqsParsers={
            personaSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          formData={formData}
          setFormData={setFormData}
          serverData={personaData}
          initializeForm={initializeForm}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={resetSuccessMessage}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={isReadonly}
          isEditMode={isEditMode}
          renderStep={renderStep}
        />
      </div>
    </TooltipProvider>
  );
}

// Helper function to generate stable ID from server prop (same logic as inside component)
function getStableServerPropId(
  data: PersonaDetailOut | PersonaNewOut | undefined
): string | null {
  if (!data) return null;
  if (typeof data === "object" && data !== null) {
    if ("persona_id" in data && data.persona_id) {
      return `persona_id:${String(data.persona_id)}`;
    }
    const keyFields: Record<string, unknown> = {};
    if ("preset_colors" in data) {
      keyFields["preset_colors"] = Array.isArray(data["preset_colors"])
        ? data["preset_colors"].length
        : data["preset_colors"];
    }
    if ("valid_icons" in data) {
      keyFields["valid_icons"] = Array.isArray(data["valid_icons"])
        ? data["valid_icons"].length
        : data["valid_icons"];
    }
    if ("suggested_icons" in data) {
      keyFields["suggested_icons"] = Array.isArray(data["suggested_icons"])
        ? data["suggested_icons"].length
        : data["suggested_icons"];
    }
    if ("valid_department_ids" in data) {
      keyFields["valid_department_ids"] = Array.isArray(
        data["valid_department_ids"]
      )
        ? data["valid_department_ids"].sort().join(",")
        : data["valid_department_ids"];
    }
    const sortedKeys = Object.keys(keyFields).sort();
    const hash = sortedKeys
      .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
      .join("|");
    return `new:${hash.length}:${hash.slice(0, 100)}`;
  }
  return String(data);
}

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(PersonaNewComponent, (prevProps, nextProps) => {
  const prevDetailId = getStableServerPropId(prevProps.personaDetail);
  const nextDetailId = getStableServerPropId(nextProps.personaDetail);
  const prevDefaultId = getStableServerPropId(prevProps.personaDetailDefault);
  const nextDefaultId = getStableServerPropId(nextProps.personaDetailDefault);

  // Compare primitive props (exclude server actions - they may be new references but functionally equivalent)
  if (
    prevProps.personaId !== nextProps.personaId ||
    prevProps.mode !== nextProps.mode
  ) {
    return false; // Props changed, re-render
  }

  // Compare server props by content ID, not reference
  if (prevDetailId !== nextDetailId) {
    return false; // Content changed, re-render
  }

  if (prevDefaultId !== nextDefaultId) {
    return false; // Content changed, re-render
  }

  // All props are equivalent (same content), skip re-render
  return true;
});
