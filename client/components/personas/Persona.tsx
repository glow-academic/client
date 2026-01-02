/**
 * Persona.tsx
 * Used to create and manage personas - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";

import type {
  CreatePersonaIn,
  CreatePersonaOut,
  PatchPersonaDraftIn,
  PatchPersonaDraftOut,
  PersonaDetailOut,
  PersonaNewOut,
  UpdatePersonaIn,
  UpdatePersonaOut,
} from "@/app/(main)/create/personas/p/[personaId]/page";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { ReorderableList } from "@/components/common/forms/ReorderableList";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { ParameterSelector } from "@/components/parameters/ParameterSelector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { transformDepartmentIdsForSubmit } from "@/utils/department-picker-helpers";
import { PERSONA_ICON_MAP } from "@/utils/persona-icons";
import { Check, Power } from "lucide-react";
import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

// Color name mapping for common hex colors (similar to Settings)
const getColorName = (hex: string): string => {
  const colorMap: Record<string, string> = {
    "#000000": "Black",
    "#FFFFFF": "White",
    "#FF0000": "Red",
    "#00FF00": "Green",
    "#0000FF": "Blue",
    "#FFFF00": "Yellow",
    "#FF00FF": "Magenta",
    "#00FFFF": "Cyan",
    "#FFA500": "Orange",
    "#800080": "Purple",
    "#FFC0CB": "Pink",
    "#A52A2A": "Brown",
    "#808080": "Gray",
    "#FFD700": "Gold",
    "#C0C0C0": "Silver",
    "#008000": "Dark Green",
    "#000080": "Navy",
    "#800000": "Maroon",
    "#EF4444": "Red",
    "#F97316": "Orange",
    "#F59E0B": "Amber",
    "#EAB308": "Yellow",
    "#84CC16": "Lime",
    "#22C55E": "Green",
    "#10B981": "Emerald",
    "#14B8A6": "Teal",
    "#06B6D4": "Cyan",
    "#0EA5E9": "Sky",
    "#3B82F6": "Blue",
    "#6366F1": "Indigo",
    "#8B5CF6": "Violet",
    "#A855F7": "Purple",
    "#D946EF": "Fuchsia",
    "#EC4899": "Pink",
    "#F43F5E": "Rose",
  };

  const normalizedHex = hex.toUpperCase().startsWith("#")
    ? hex.toUpperCase()
    : `#${hex.toUpperCase()}`;

  return colorMap[normalizedHex] || "Custom";
};

export interface PersonaProps {
  personaId?: string;
  mode?: "create" | "edit";
  // Server-provided data (for server-side rendering)
  personaDetail?: PersonaDetailOut;
  personaDetailDefault?: PersonaNewOut;
  // Server actions (replaces useMutation)
  createPersonaAction?: (input: CreatePersonaIn) => Promise<CreatePersonaOut>;
  updatePersonaAction?: (input: UpdatePersonaIn) => Promise<UpdatePersonaOut>;
  patchPersonaDraftAction?: (
    input: PatchPersonaDraftIn
  ) => Promise<PatchPersonaDraftOut>;
}

function PersonaComponent({
  personaId,
  mode = personaId ? "edit" : "create",
  personaDetail: serverPersonaDetail,
  personaDetailDefault: serverPersonaDetailDefault,
  createPersonaAction,
  updatePersonaAction,
  patchPersonaDraftAction,
}: PersonaProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = mode === "edit" && !!personaId;
  const { effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Get draftId from URL - will be read from urlParams after it's defined below

  const isSuperadmin = effectiveProfile?.role === "superadmin";

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

  // Convert departments array to department_mapping Record (for GenericPicker)
  const departmentMapping = useMemo(() => {
    // Check if department_mapping already exists (edit mode)
    if (
      personaData &&
      "department_mapping" in personaData &&
      (
        personaData as PersonaDetailOut & {
          department_mapping?: Record<string, unknown>;
        }
      ).department_mapping
    ) {
      return (
        (
          personaData as PersonaDetailOut & {
            department_mapping?: Record<
              string,
              { id: string; name: string; description?: string }
            >;
          }
        ).department_mapping || {}
      );
    }
    // Convert departments array to mapping (new mode)
    if (
      personaData &&
      "departments" in personaData &&
      Array.isArray(
        (
          personaData as PersonaNewOut & {
            departments?: Array<{
              department_id: string;
              name: string;
              description?: string;
            }>;
          }
        ).departments
      )
    ) {
      const departments =
        (
          personaData as PersonaNewOut & {
            departments?: Array<{
              department_id: string;
              name: string;
              description?: string;
            }>;
          }
        ).departments || [];
      const mapping: Record<
        string,
        { id: string; name: string; description?: string }
      > = {};
      departments.forEach((dept) => {
        if (dept.department_id) {
          mapping[dept.department_id] = {
            id: dept.department_id,
            name: dept.name || "",
            ...(dept.description ? { description: dept.description } : {}),
          };
        }
      });
      return mapping;
    }
    return {};
  }, [personaData]);

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

  // Local draft state (not in URL) - initialized from server data or draft payload
  type DraftState = {
    name: string;
    description: string;
    instructions: string;
    color: string;
    icon: string;
    active: boolean;
    departmentIds: string[];
    parameterIds: string[];
    parameterFieldIds: string[];
    examples: string[];
  };

  // Initialize draft state from server data or draft payload
  // Use stable refs (personaDetail/personaDetailDefault) instead of raw props to prevent recomputation on every server render
  // IMPORTANT: Include actual data fields in dependencies, not just IDs, so it recomputes when content changes
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? personaDetail : personaDetailDefault;
    if (!data) {
      return {
        name: "",
        description: "",
        instructions: "",
        color: "#3B82F6",
        icon: "Sparkles",
        active: true,
        departmentIds: [],
        parameterIds: [],
        parameterFieldIds: [],
        examples: [],
      };
    }

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    return {
      name: data.name || "",
      description: data.description || "",
      instructions: data.instructions || "",
      color: data.color || "#3B82F6",
      icon: data.icon || "Sparkles",
      active: data.active ?? true,
      departmentIds: data.department_ids || [],
      parameterIds: [],
      parameterFieldIds: [],
      examples: [],
    };
  }, [
    isEditMode,
    personaDetail,
    personaDetailDefault,
    personaDetailId,
    personaDetailDefaultId,
    draftId, // Add draftId to dependencies so it recomputes when draft changes
    urlDraftId, // Add urlDraftId to dependencies so it recomputes when URL draft changes
    // Include actual content fields so it recomputes when server data changes (not just object reference)
    personaDetailDefault?.name,
    personaDetailDefault?.description,
    personaDetailDefault?.instructions,
    personaDetailDefault?.color,
    personaDetailDefault?.icon,
    personaDetailDefault?.department_ids,
    personaDetail?.name,
    personaDetail?.description,
    personaDetail?.instructions,
    personaDetail?.color,
    personaDetail?.icon,
    personaDetail?.department_ids,
  ]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

  // Track previous initialDraftState content to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
  );

  // Update draft state when server data changes (e.g., draft selected)
  // Only update if content actually changed (deep comparison to prevent unnecessary re-renders)
  useEffect(() => {
    // Deep compare to avoid unnecessary state updates
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    // Only update if content actually changed
    if (currentStateStr !== newStateStr) {
      prevInitialDraftStateRef.current = newStateStr;
      setDraftState(initialDraftState);
    }
  }, [initialDraftState]);

  // Integrate autosave hook
  const {
    saveStatus: _saveStatus,
    saveNow: _saveNow,
    lastSavedVersion: _lastSavedVersion,
  } = useDraftAutosave({
    draftId,
    draftState,
    patchDraftAction: patchPersonaDraftAction
      ? async (input) => {
          // Transform input to match API structure (API uses input_draft_id, patch, expected_version)
          // Note: profile_id is added server-side from header
          const result = await patchPersonaDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: input.body.patch as Record<string, unknown>,
              expected_version: input.body.expected_version,
            } as PatchPersonaDraftIn["body"],
          });
          // Transform response to match hook expectations (API returns draft_id, new_version, draft_exists)
          return {
            draftId: result.draft_id || "",
            newVersion: result.new_version || 0,
            draftExists: result.draft_exists || false,
          };
        }
      : async () => ({ draftId: "", newVersion: 0, draftExists: false }),
    debounceMs: 1000,
    onDraftCreated: useCallback(
      (newDraftId: string) => {
        // Only update URL if draftId actually changed
        const currentUrlDraftId = searchParams.get("draftId");
        if (newDraftId === currentUrlDraftId) {
          return;
        }
        // Update URL with new draftId and trigger server-side refetch
        // This ensures the server component gets fresh data with the new draft
        const params = new URLSearchParams(searchParams.toString());
        params.set("draftId", newDraftId);
        const newUrl = `?${params.toString()}`;
        router.replace(newUrl, { scroll: false });
        // Force server components to re-render with updated search params
        router.refresh();
      },
      [router, searchParams]
    ),
  });

  // Merge draftState with urlParams for formData (GenericForm expects single formData object)
  const formData = useMemo(() => {
    return {
      ...draftState,
      colorSearch: urlParams.colorSearch || null,
      iconSearch: urlParams.iconSearch || null,
      colorShowSelected: urlParams.colorShowSelected || null,
      iconShowSelected: urlParams.iconShowSelected || null,
    } as Record<string, unknown>;
  }, [draftState, urlParams]);

  // Wrapper for setFormData that updates draftState for form fields, urlParams for navigation
  const setFormData = useCallback(
    (
      updates:
        | Partial<Record<string, unknown>>
        | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>)
    ) => {
      // Handle function form
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      const draftUpdates: Partial<DraftState> = {};
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
          key === "parameterIds" ||
          key === "parameterFieldIds" ||
          key === "examples"
        ) {
          draftUpdates[key as keyof DraftState] = value as never;
        } else if (
          key === "colorSearch" ||
          key === "iconSearch" ||
          key === "colorShowSelected" ||
          key === "iconShowSelected"
        ) {
          urlUpdates[key] = value;
        }
      });

      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
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

  // Get preset colors and valid icons from server (all colors/icons, filtered client-side)
  // Server returns colors as list of objects: [{hex: "#ef4444", name: "Red"}, ...]
  const presetColorsAll = useMemo(() => {
    const colors =
      (
        personaData as PersonaDetailOut & {
          preset_colors?: Array<{ hex: string; name: string }> | string[];
        }
      )?.preset_colors || [];

    // Handle both old format (string[]) and new format (Array<{hex, name}>)
    if (colors.length > 0 && typeof colors[0] === "string") {
      // Old format - convert to new format (shouldn't happen after migration)
      return (colors as string[]).map((hex) => ({ hex, name: hex }));
    }
    return colors as Array<{ hex: string; name: string }>;
  }, [personaData]);

  // Extract specific form values to avoid re-renders when formData object reference changes
  const colorValue = draftState.color;
  const colorSearch = urlParams.colorSearch || "";
  const iconSearch = urlParams.iconSearch || "";

  // Filter colors client-side based on search state from URL
  // Also include custom colors that aren't in the preset list
  const presetColors = useMemo(() => {
    // Get current color from form data or default
    const currentColor =
      colorValue !== undefined
        ? colorValue
        : (personaData as { color?: string })?.color || null;

    // Normalize current color for comparison
    const normalizedCurrentColor = currentColor
      ? currentColor.toUpperCase().startsWith("#")
        ? currentColor.toUpperCase()
        : `#${currentColor.toUpperCase()}`
      : null;

    // Check if current color is custom (not in preset list)
    const isCustomColor =
      normalizedCurrentColor &&
      !presetColorsAll.some(
        (c) => c.hex.toUpperCase() === normalizedCurrentColor
      );

    // Build colors list: custom color first (if exists), then preset colors
    let colors = [...presetColorsAll];
    if (isCustomColor && normalizedCurrentColor) {
      colors = [
        {
          hex: normalizedCurrentColor,
          name: getColorName(normalizedCurrentColor),
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
      (color) =>
        color.name.toLowerCase().includes(searchLower) ||
        color.hex.toLowerCase().includes(searchLower)
    );
  }, [presetColorsAll, colorValue, colorSearch, personaData]);

  const suggestedIconsAll = useMemo(
    () =>
      (
        personaData as PersonaDetailOut & {
          suggested_icons?: string[];
        }
      )?.suggested_icons || [],
    [personaData]
  );

  const validIconsAll = useMemo(
    () =>
      (
        personaData as PersonaDetailOut & {
          valid_icons?: string[];
        }
      )?.valid_icons || [],
    [personaData]
  );

  // Combine suggested icons first, then valid icons
  const allIconsAll = useMemo(() => {
    const suggestedSet = new Set(suggestedIconsAll);
    const otherIcons = validIconsAll.filter(
      (iconName) => !suggestedSet.has(iconName)
    );
    return [...suggestedIconsAll, ...otherIcons].filter(
      (iconName) => iconName in PERSONA_ICON_MAP
    );
  }, [suggestedIconsAll, validIconsAll]);

  // Filter icons client-side based on search state from URL
  const allIcons = useMemo(() => {
    if (!iconSearch.trim()) {
      return allIconsAll;
    }
    const searchLower = iconSearch.toLowerCase();
    return allIconsAll.filter((icon) =>
      icon.toLowerCase().includes(searchLower)
    );
  }, [allIconsAll, iconSearch]);

  // Readonly logic using v2 permission flags
  const isReadonly = useMemo(() => {
    if (!isEditMode || !personaData) return false;
    if ("can_edit" in personaData) {
      return !(personaData as PersonaDetailOut).can_edit;
    }
    return false;
  }, [isEditMode, personaData]);

  // Extract examples from example_mapping or convert from examples array
  const exampleMapping = useMemo(() => {
    // Check if example_mapping already exists (backward compatibility)
    if (
      personaData &&
      "example_mapping" in personaData &&
      (
        personaData as PersonaDetailOut & {
          example_mapping?: Record<string, { name: string }>;
        }
      ).example_mapping
    ) {
      return (
        (
          personaData as PersonaDetailOut & {
            example_mapping?: Record<string, { name: string }>;
          }
        ).example_mapping || {}
      );
    }
    // Convert examples array to mapping (current pattern)
    if (
      personaData &&
      "examples" in personaData &&
      Array.isArray(
        (
          personaData as PersonaDetailOut & {
            examples?: Array<{
              example_id: string | null;
              name: string | null;
              description?: string | null;
            }>;
          }
        ).examples
      )
    ) {
      const examples =
        (
          personaData as PersonaDetailOut & {
            examples?: Array<{
              example_id: string | null;
              name: string | null;
              description?: string | null;
            }>;
          }
        ).examples || [];
      const mapping: Record<string, { name: string }> = {};
      examples.forEach((ex) => {
        if (ex.example_id) {
          // Convert UUID to string for mapping key
          mapping[String(ex.example_id)] = {
            name: ex.name || "",
          };
        }
      });
      return mapping;
    }
    return {};
  }, [personaData]);

  // Extract examples from example_ids and example_mapping
  const getExamplesFromMapping = useCallback(
    (
      exampleIds: string[],
      mapping: Record<string, { name: string }>
    ): string[] => {
      return exampleIds.map((id) => mapping[id]?.name || "");
    },
    []
  );

  // Helper to filter examples_history based on selected departments
  const getExamplesHistory = useCallback(
    (departmentIds: string[] | null | undefined) => {
      if (!personaData || !("examples_history" in personaData)) return [];
      const rawHistory =
        (
          personaData as PersonaDetailOut & {
            examples_history?: Array<{
              example: string;
              department_ids?: string[];
            }>;
          }
        )?.examples_history || [];
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
      rawHistory.forEach((ex) => {
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
      });

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

      const personaDetail = serverData as PersonaDetailOut;
      const deptIds = personaDetail.department_ids || [];
      const exampleIdsRaw =
        (
          personaDetail as PersonaDetailOut & {
            example_ids?: Array<string | { toString(): string }>;
          }
        )?.example_ids || [];
      // Convert example_ids to strings for mapping lookup (UUIDs may come as objects or strings)
      const exampleIds = exampleIdsRaw.map((id) => String(id));
      const examples = getExamplesFromMapping(exampleIds, exampleMapping);

      // Update draftState directly (form fields are now in local state, not URL)
      const draftUpdates: Partial<DraftState> = {};

      if (personaDetail.name) draftUpdates.name = personaDetail.name;
      if (personaDetail.description)
        draftUpdates.description = personaDetail.description;
      if (personaDetail.instructions)
        draftUpdates.instructions = personaDetail.instructions;
      if (personaDetail.color) draftUpdates.color = personaDetail.color;
      if (personaDetail.icon) draftUpdates.icon = personaDetail.icon;
      if (personaDetail.active !== undefined)
        draftUpdates.active = personaDetail.active ?? true;
      if (deptIds.length > 0) draftUpdates.departmentIds = deptIds;
      if (
        (
          personaDetail as PersonaDetailOut & {
            linked_parameter_ids?: string[];
          }
        )?.linked_parameter_ids &&
        (
          personaDetail as PersonaDetailOut & {
            linked_parameter_ids?: string[];
          }
        ).linked_parameter_ids!.length > 0
      ) {
        draftUpdates.parameterIds = (
          personaDetail as PersonaDetailOut & {
            linked_parameter_ids?: string[];
          }
        ).linked_parameter_ids!;
      }
      if (
        (personaDetail as PersonaDetailOut & { parameter_field_ids?: string[] })
          ?.parameter_field_ids &&
        (
          personaDetail as PersonaDetailOut & {
            parameter_field_ids?: string[];
          }
        ).parameter_field_ids!.length > 0
      ) {
        draftUpdates.parameterFieldIds = (
          personaDetail as PersonaDetailOut & {
            parameter_field_ids?: string[];
          }
        ).parameter_field_ids!;
      }
      if (examples.length > 0) draftUpdates.examples = examples;

      // Apply updates to draftState
      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }

      // Return empty object for GenericForm compatibility (form fields are handled via draftState)
      return {};
    },
    [exampleMapping, getExamplesFromMapping]
  );

  // Set breadcrumb context when persona data is loaded
  useEffect(() => {
    if (personaDetail?.name && personaId && isEditMode) {
      setEntityMetadata({
        entityId: personaId,
        entityName: personaDetail.name,
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

  // Submit handler for GenericForm (uses draftState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (!draftState.name) {
        toast.error("Persona name is required");
        throw new Error("Persona name is required");
      }

      if (!draftState.description) {
        toast.error("Persona description is required");
        throw new Error("Persona description is required");
      }

      if (!draftState.instructions) {
        toast.error("Instructions are required");
        throw new Error("Instructions are required");
      }

      // Transform department IDs for submit (non-superadmin: empty -> all valid departments)
      const finalDepartmentIds =
        transformDepartmentIdsForSubmit(
          draftState.departmentIds || [],
          isSuperadmin,
          (
            personaData as PersonaDetailOut & {
              valid_department_ids?: string[];
            }
          )?.valid_department_ids || []
        ) ?? [];

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (isEditMode) {
        if (!updatePersonaAction) {
          toast.error("Update action not available");
          throw new Error("Update action not available");
        }
        try {
          await updatePersonaAction({
            body: {
              persona_id: personaId!,
              name: draftState.name,
              description: draftState.description || "",
              instructions: draftState.instructions || "",
              color: draftState.color || "#000000",
              icon: draftState.icon || "Zap",
              active: draftState.active ?? true,
              department_ids: finalDepartmentIds,
              example_ids: [],
            },
          });
          toast.success("Persona updated successfully!");
          router.push("/create/personas");
        } catch (error) {
          toast.error(
            `Failed to update persona: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      } else {
        if (!createPersonaAction) {
          toast.error("Create action not available");
          throw new Error("Create action not available");
        }
        try {
          await createPersonaAction({
            body: {
              name: draftState.name,
              description: draftState.description || "",
              instructions: draftState.instructions || "",
              color: draftState.color || "#000000",
              icon: draftState.icon || "Zap",
              active: draftState.active ?? true,
              department_ids: finalDepartmentIds,
              example_ids: (draftState.examples || []).filter((ex: string) =>
                ex.trim()
              ),
            },
          });
          toast.success("Persona created successfully!");
          router.push("/create/personas");
        } catch (error) {
          toast.error(
            `Failed to create persona: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      }
    },
    [
      draftState,
      isEditMode,
      personaId,
      isSuperadmin,
      personaData,
      effectiveProfile?.id,
      updatePersonaAction,
      createPersonaAction,
      router,
    ]
  );

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasName = !!(formData["name"] as string | null | undefined)?.trim();
      const hasDescription = !!(
        formData["description"] as string | null | undefined
      )?.trim();
      const hasColor = !!(
        formData["color"] as string | null | undefined
      )?.trim();
      const hasIcon = !!(formData["icon"] as string | null | undefined)?.trim();
      const hasInstructions = !!(
        formData["instructions"] as string | null | undefined
      )?.trim();

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
    []
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
          "parameterFieldIds",
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
      "parameterIds",
      "parameterFieldIds",
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
                "parameterFieldIds",
                "active",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    data-testid="input-persona-description"
                    value={
                      (stepFormData["description"] as
                        | string
                        | null
                        | undefined) || ""
                    }
                    onChange={(e) =>
                      setStepFormData({
                        description: e.target.value || null,
                      })
                    }
                    placeholder="Detailed behavior description and personality traits"
                    rows={4}
                    disabled={isReadonly}
                  />
                </div>

                {/* Department Selection */}
                {personaData?.valid_department_ids &&
                personaData.valid_department_ids.length > 1 ? (
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <GenericPicker
                      items={departmentMapping}
                      itemIds={
                        (
                          personaData as PersonaDetailOut & {
                            valid_department_ids?: string[];
                          }
                        )?.valid_department_ids || []
                      }
                      selectedIds={
                        (stepFormData["departmentIds"] as
                          | string[]
                          | null
                          | undefined) || []
                      }
                      onSelect={(ids) =>
                        setStepFormData({
                          departmentIds: ids.length > 0 ? ids : null,
                        })
                      }
                      getId={(dept) => (dept as { id: string }).id}
                      getLabel={(dept) => (dept as { name: string }).name || ""}
                      getSearchText={(dept) =>
                        `${(dept as { name: string }).name} ${(dept as { description?: string }).description || ""}`
                      }
                      placeholder="All Departments"
                      disabled={isReadonly}
                      multiSelect={true}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                    />
                  </div>
                ) : null}

                {/* Required Parameters */}
                {personaData &&
                "linked_parameter_ids" in personaData &&
                (
                  personaData as PersonaDetailOut & {
                    linked_parameter_ids?: string[];
                  }
                ).linked_parameter_ids &&
                (
                  personaData as PersonaDetailOut & {
                    linked_parameter_ids?: string[];
                  }
                ).linked_parameter_ids!.length > 0 ? (
                  <div className="space-y-4">
                    <Label>Required Parameters</Label>
                    <ParameterSelector
                      parameterMapping={
                        (
                          personaData as PersonaDetailOut & {
                            parameter_mapping?: Record<
                              string,
                              {
                                name: string;
                                description: string;
                                numerical: boolean;
                                document_parameter: boolean;
                                persona_parameter: boolean;
                              }
                            >;
                          }
                        ).parameter_mapping || {}
                      }
                      fieldMapping={
                        (
                          personaData as PersonaDetailOut & {
                            field_mapping?: Record<
                              string,
                              {
                                name: string;
                                description: string;
                                parameter_id: string;
                                parameter_name: string;
                                value: string;
                              }
                            >;
                          }
                        ).field_mapping || {}
                      }
                      validParameterItemIds={
                        (
                          personaData as PersonaDetailOut & {
                            valid_parameter_item_ids?: string[];
                          }
                        ).valid_parameter_item_ids || []
                      }
                      selectedParameterItemIds={
                        (stepFormData["parameterFieldIds"] as
                          | string[]
                          | null
                          | undefined) || []
                      }
                      onParameterItemIdsChange={(ids) =>
                        setStepFormData({
                          parameterFieldIds: ids.length > 0 ? ids : null,
                        })
                      }
                      disabled={isReadonly}
                    />
                  </div>
                ) : null}

                {/* Active Switch */}
                <div className="space-y-2 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="active"
                        className="text-sm flex items-center gap-1.5"
                      >
                        <Power className="h-3.5 w-3.5 text-muted-foreground" />
                        Active
                      </Label>
                      <Switch
                        id="active"
                        checked={
                          (stepFormData["active"] as
                            | boolean
                            | null
                            | undefined) ??
                          (personaData as { active?: boolean })?.active ??
                          true
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ active: checked })
                        }
                        disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Inactive personas will not be available for scenarios
                    </p>
                  </div>
                </div>
              </div>
            </StepCard>
          );

        case "color": {
          // Use URL param if present, otherwise use API default
          // Check if explicitly set (even if null) vs undefined (not set yet)
          const colorValue = stepFormData["color"] as string | null | undefined;
          const currentColorRaw =
            colorValue !== undefined
              ? colorValue
              : (personaData as { color?: string })?.color || "#000000";

          // Normalize currentColor to match preset color format (lowercase) for SelectableGrid comparison
          const currentColor = currentColorRaw
            ? currentColorRaw.toLowerCase().startsWith("#")
              ? currentColorRaw.toLowerCase()
              : `#${currentColorRaw.toLowerCase()}`
            : "#000000";

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
                  onChange: (value) =>
                    setStepFormData({ colorShowSelected: value || null }),
                },
              ]}
              resetFields={["color", "colorSearch", "colorShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              {presetColors.length > 0 && (
                <SelectableGrid<{ hex: string; name: string }>
                  items={presetColors}
                  selectedId={currentColor}
                  onSelect={(colorHex) => {
                    const current = stepFormData["color"] as
                      | string
                      | null
                      | undefined;
                    const normalizedCurrent = current
                      ? current.toLowerCase().startsWith("#")
                        ? current.toLowerCase()
                        : `#${current.toLowerCase()}`
                      : null;
                    setStepFormData({
                      color: colorHex === normalizedCurrent ? null : colorHex,
                    });
                  }}
                  getId={(color) => color.hex.toLowerCase()}
                  renderItem={(color, isSelected) => (
                    <div
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                        "hover:shadow-md hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isSelected && "ring-2 ring-primary bg-accent"
                      )}
                    >
                      {/* Check icon - top right */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg border-2 border-border shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight">
                            {color.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {color.hex}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  emptyMessage="No colors found. Try adjusting your search."
                  disabled={isReadonly}
                />
              )}

              {/* Hex Input */}
              <div className="space-y-2">
                <Label htmlFor="colorInput">Hex Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="colorInput"
                    value={currentColorRaw || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow any hex value (with or without #, any length)
                      if (value === "" || /^#?[0-9A-Fa-f]*$/.test(value)) {
                        setStepFormData({
                          color: value.startsWith("#") ? value : `#${value}`,
                        });
                      }
                    }}
                    placeholder="#000000"
                    className="flex-1"
                    disabled={isReadonly}
                  />
                  <div
                    className="w-10 h-10 rounded border shrink-0"
                    style={{
                      backgroundColor: currentColorRaw || "#000000",
                    }}
                  />
                </div>
              </div>
            </StepCard>
          );
        }

        case "icon": {
          // Use URL param if present, otherwise use API default
          // Check if explicitly set (even if null) vs undefined (not set yet)
          const iconValue = stepFormData["icon"] as string | null | undefined;
          const currentIcon =
            iconValue !== undefined
              ? iconValue
              : (personaData as { icon?: string })?.icon || "Zap";

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
                  onChange: (value) =>
                    setStepFormData({ iconShowSelected: value || null }),
                },
              ]}
              resetFields={["icon", "iconSearch", "iconShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <SelectableGrid
                items={allIcons}
                selectedId={currentIcon}
                onSelect={(icon) => {
                  const current = stepFormData["icon"] as
                    | string
                    | null
                    | undefined;
                  setStepFormData({
                    icon: icon === current ? null : icon,
                  });
                }}
                getId={(icon) => icon}
                renderItem={(iconName, isSelected) => {
                  const IconComponent =
                    PERSONA_ICON_MAP[iconName as keyof typeof PERSONA_ICON_MAP];
                  if (!IconComponent) return null;

                  const isSuggested = suggestedIconsAll.includes(iconName);

                  return (
                    <div
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                        "hover:shadow-md hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isSelected && "ring-2 ring-primary bg-accent"
                      )}
                    >
                      {/* Check icon - top right */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}

                      {/* Suggested badge - top left */}
                      {isSuggested && !isSelected && (
                        <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                          Suggested
                        </div>
                      )}

                      <div className="flex flex-col items-center gap-2">
                        <IconComponent className="h-8 w-8 text-foreground" />
                        <span className="text-sm font-medium text-center">
                          {iconName}
                        </span>
                      </div>
                    </div>
                  );
                }}
                emptyMessage="No icons found. Try adjusting your search."
                disabled={isReadonly}
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
              {/* Instructions */}
              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions *</Label>
                <Textarea
                  id="instructions"
                  data-testid="input-instructions"
                  value={
                    (stepFormData["instructions"] as
                      | string
                      | null
                      | undefined) || ""
                  }
                  onChange={(e) =>
                    setStepFormData({
                      instructions: e.target.value || null,
                    })
                  }
                  placeholder="Instructions that define how the persona should behave and respond."
                  rows={8}
                  required
                  disabled={isReadonly}
                />
                <p className="text-xs text-muted-foreground">
                  Define the persona's behavior, communication style, and
                  response patterns
                </p>
              </div>

              {/* Examples Section */}
              <div className="space-y-2 pt-2">
                <Label className="text-sm">Example Messages</Label>
                <ReorderableList
                  items={
                    (stepFormData["examples"] as string[] | null | undefined) &&
                    (stepFormData["examples"] as string[]).length > 0
                      ? (stepFormData["examples"] as string[])
                      : [""]
                  }
                  onItemsChange={(items) => {
                    // Save items as-is (including empty strings for editing)
                    // This allows ReorderableList to work properly when adding new items
                    // Empty strings will be filtered when submitting the form
                    if (items.length === 0) {
                      setStepFormData({ examples: null });
                    } else {
                      setStepFormData({ examples: items });
                    }
                  }}
                  suggestions={getExamplesHistory(
                    stepFormData["departmentIds"] as string[] | null | undefined
                  )}
                  maxItems={10}
                  addButtonLabel="Add example"
                  disabled={isReadonly}
                  itemPlaceholder="Message"
                />
              </div>
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      personaData,
      departmentMapping,
      isReadonly,
      isEditMode,
      presetColors,
      allIcons,
      suggestedIconsAll,
      getExamplesHistory,
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
export default React.memo(PersonaComponent, (prevProps, nextProps) => {
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
