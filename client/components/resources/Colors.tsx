/**
 * Colors.tsx
 * Resource component for color picker fields
 * Full UI component with Label + Color picker (SelectableGrid + hex input)
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { getColorName } from "@/utils/color-helpers";
import { useResourceAi } from "@/hooks/use-resource-ai";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftColorsIn = InputOf<"/api/v4/resources/colors", "post">;
type CreateDraftColorsOut = OutputOf<"/api/v4/resources/colors", "post">;

// Derive resource item type from the GET endpoint response
type ColorsGetResponse = OutputOf<"/api/v4/resources/colors/get", "post">;
export type ColorResourceItem = NonNullable<ColorsGetResponse["items"]>[number];

export interface ColorItem {
  hex: string;
  name: string;
  id?: string | null; // Include id for unique keys when available
  index?: number; // Include index as fallback for uniqueness
}

export interface ColorsProps {
  color_id?: string | null; // Current color_id (standardized prop name)
  color_resource?: ColorResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_color?: boolean; // Whether to show this resource picker
  color_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  colors?: ColorResourceItem[]; // All available colors from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onColorIdChange?: (colorId: string | null) => void; // Update color_id in parent form state (single-select)
  color_ids?: string[]; // Current color resource IDs (multi-select)
  color_resources?: ColorResourceItem[]; // Selected color resources (multi-select)
  onChange?: (ids: string[]) => void; // Update color_ids in parent form state (multi-select)
  multiSelect?: boolean; // Whether to use multi-select mode
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  label?: string;
  id?: string;
  required?: boolean;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  showSelectedFilter?: boolean;
  onShowSelectedChange?: (value: boolean) => void;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  createColorsAction?:
    | ((input: CreateDraftColorsIn) => Promise<CreateDraftColorsOut>)
    | undefined;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<{ color_id: string | null } | void>) => void;
  // Legacy props for backward compatibility
  colorResource?: {
    id: string;
    name: string;
    description: string;
    hex_code: string;
    generated?: boolean | null;
  } | null;
  colorId?: string | null;
  presetColors?: ColorItem[];
  colorSuggestions?: string[];
  // AI diff view props
  aiResource?: { id?: string | null; name?: string | null; hex_code?: string | null } | null | undefined;
  onAccept?: () => void;
  onReject?: () => void;
  onGenerationComplete?: () => void;
}

export function Colors({
  color_id,
  color_resource,
  show_color = false,
  color_suggestions,
  colors,
  disabled = false,
  onColorIdChange,
  color_ids,
  color_resources,
  onChange,
  multiSelect = false,
  onGenerate,
  isGenerating: _isGenerating = false,
  label = "Color",
  id = "color",
  required = false,
  searchTerm = "",
  onSearchChange: _onSearchChange,
  searchPlaceholder: _searchPlaceholder = "Search colors...",
  showSelectedFilter = false,
  onShowSelectedChange: _onShowSelectedChange,
  group_id,
  create_tool_id: _create_tool_id,
  showAiGenerate = false,
  createColorsAction,
  isAutosaveEnabled = true,
  registerFlush,
  // Legacy props for backward compatibility
  colorResource,
  colorId: _colorId,
  presetColors,
  colorSuggestions,
  // AI diff view props (deprecated - kept for backward compatibility)
  aiResource: _aiResource,
  onAccept: _onAccept,
  onReject: _onReject,
  onGenerationComplete: _onGenerationComplete,
}: ColorsProps) {
  // Use standardized props with fallback to legacy props
  const resource = color_resource ?? colorResource ?? null;
  const resourceId = color_id ?? _colorId ?? null;
  const show = show_color ?? false;
  const suggestionsList = useMemo(
    () => color_suggestions ?? colorSuggestions ?? [],
    [color_suggestions, colorSuggestions]
  );
  const ids = useMemo(() => color_ids ?? [], [color_ids]);

  // AI suggestion via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, clear: clearAi } = useResourceAi({
    resourceType: "colors",
    groupId: group_id,
  });

  // AI suggestion state
  const showDiff = !!aiSuggestion?.id;
  const aiSuggestedId = aiSuggestion?.id || null;

  // Accept AI suggestion - update color selection
  const handleAcceptAi = useCallback(() => {
    if (!aiSuggestion?.id) return;
    if (onColorIdChange) {
      onColorIdChange(aiSuggestion.id);
    }
    if (aiSuggestion.hex_code) {
      setInternalValue(aiSuggestion.hex_code);
      lastSavedValueRef.current = aiSuggestion.hex_code;
    }
    clearAi();
  }, [aiSuggestion, onColorIdChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleRejectAi = useCallback(() => {
    clearAi();
  }, [clearAi]);
  
  // Track which color IDs have already had resources created (multi-select)
  const createdColorIdsRef = useRef<Set<string>>(new Set());
  
  // Initialize createdColorIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdColorIdsRef.current.add(id));
  }, [ids]);
  
  // Check if any color resource is generated (multi-select)
  const hasGenerated = useMemo(() => {
    return color_resources?.some((c) => c.generated) ?? false;
  }, [color_resources]);

  // Convert colors array from API format to ColorItem format
  const presetColorsList = useMemo(() => {
    if (colors && colors.length > 0) {
      return colors
        .filter((c) => c.hex_code && c.name) // Filter out nulls
        .map((c, index) => ({
          hex: c.hex_code!,
          name: c.name!,
          id: c.id ?? null, // Preserve id for unique keys
          index, // Include index as fallback for uniqueness
        }));
    }
    // For presetColors (legacy), add index for uniqueness
    return (presetColors ?? []).map((c, index) => ({
      ...c,
      index,
    }));
  }, [colors, presetColors]);

  // Handle nullable resource properties
  const resourceHexCode = resource?.hex_code ?? null;
  const [internalValue, setInternalValue] = useState(resourceHexCode || "");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(resourceHexCode || "");
  const isInitialMountRef = useRef(true);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ color_id: string | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ color_id: string | null } | void> => {
    // Skip if no color value
    if (!internalValue) return;

    // Skip if no change AND we already have a resource for this value
    // (pre-defined colors will have resourceId set via handleChange)
    if (internalValue === lastSavedValueRef.current && resourceId) {
      return { color_id: resourceId };
    }

    const hexCode = internalValue.toLowerCase().startsWith("#")
      ? internalValue.toLowerCase()
      : `#${internalValue.toLowerCase()}`;

    // Check if this is a pre-defined color (safety net in case handleChange didn't catch it)
    if (colors) {
      const existingColor = colors.find((c) => c.hex_code?.toLowerCase() === hexCode);
      if (existingColor?.id) {
        if (onColorIdChange) {
          onColorIdChange(existingColor.id);
        }
        lastSavedValueRef.current = internalValue;
        return { color_id: existingColor.id };
      }
    }

    // Custom color - need to create a resource
    if (!createColorsAction || !group_id) return;

    try {
      const colorName = getColorName(hexCode);
      const result = await createColorsAction({
        body: {
          group_id: group_id,
          name: colorName,
          description: `Color: ${hexCode}`,
          hex_code: hexCode,
          mcp: false,
        },
      });
      if (result.color_id) {
        if (onColorIdChange) {
          onColorIdChange(result.color_id);
        }
        lastSavedValueRef.current = internalValue;
        return { color_id: result.color_id };
      }
      return { color_id: null };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create color resource:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Update internal value when color_resource changes
  useEffect(() => {
    if (resourceHexCode) {
      setInternalValue(resourceHexCode);
      lastSavedValueRef.current = resourceHexCode;
    }
  }, [resourceHexCode]);

  // Normalize current color for comparison
  const currentColor = useMemo(() => {
    if (!internalValue) return "";
    return internalValue.toLowerCase().startsWith("#")
      ? internalValue.toLowerCase()
      : `#${internalValue.toLowerCase()}`;
  }, [internalValue]);

  // Track and report pending changes (for manual save mode only)
  useEffect(() => {
    // Only report pending changes when autosave is disabled
    // When autosave is enabled, Persona.tsx handles the "saving" state directly
    if (isAutosaveEnabled) {
      return;
    }

    // Skip on initial mount
    if (isInitialMountRef.current) {
      return;
    }

    const hasPendingChanges = internalValue !== lastSavedValueRef.current;
    if (hasPendingChanges) {
      // Notify save context that there are unsaved changes
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: true } })
      );
    }
  }, [internalValue, isAutosaveEnabled]);

  // Debounced resource creation - only for custom colors not in the pre-defined list
  useEffect(() => {
    // Skip if autosave is disabled (manual save mode - flush handles it)
    if (!isAutosaveEnabled) {
      return;
    }

    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedValueRef.current = internalValue;
      return;
    }

    // Skip if value hasn't changed
    if (internalValue === lastSavedValueRef.current) {
      return;
    }

    // Skip if no action or empty value
    if (!createColorsAction || !internalValue) {
      return;
    }

    // Skip if this is a pre-defined color with an existing ID
    // (handleChange already set the ID immediately)
    if (colors) {
      const normalizedValue = internalValue.toLowerCase().startsWith("#")
        ? internalValue.toLowerCase()
        : `#${internalValue.toLowerCase()}`;
      const existingColor = colors.find((c) => c.hex_code?.toLowerCase() === normalizedValue);
      if (existingColor?.id) {
        lastSavedValueRef.current = internalValue;
        return;
      }
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer - only for custom colors that need to be created
    debounceTimerRef.current = setTimeout(() => {
      flushRef.current?.();
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, createColorsAction, isAutosaveEnabled, colors]);

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);

    // Look up the color's existing ID from the colors array and update formState immediately
    // Pre-defined colors have IDs, so we just need to find the matching one
    if (newValue && colors) {
      const normalizedValue = newValue.toLowerCase().startsWith("#")
        ? newValue.toLowerCase()
        : `#${newValue.toLowerCase()}`;
      const selectedColor = colors.find((c) => c.hex_code?.toLowerCase() === normalizedValue);
      if (selectedColor?.id && onColorIdChange) {
        onColorIdChange(selectedColor.id);
        lastSavedValueRef.current = newValue; // Mark as saved so flush knows no creation needed
        return;
      }
    }

    // If no value, clear the selection
    if (!newValue && onColorIdChange) {
      onColorIdChange(null);
    }
  }, [colors, onColorIdChange]);

  // Map suggestion UUIDs to hex codes
  const suggestedHexCodes = useMemo(() => {
    if (suggestionsList.length === 0 || !colors) return new Set<string>();
    const suggestedSet = new Set<string>();
    suggestionsList.forEach((suggestionId) => {
      const color = colors.find((c) => c.id === suggestionId);
      if (color?.hex_code) {
        suggestedSet.add(color.hex_code.toLowerCase());
      }
    });
    return suggestedSet;
  }, [suggestionsList, colors]);

  // Filter colors by search term
  const filteredColors = useMemo(() => {
    if (!searchTerm.trim()) {
      return presetColorsList;
    }
    const searchLower = searchTerm.toLowerCase();
    return presetColorsList.filter(
      (color) =>
        color.name.toLowerCase().includes(searchLower) ||
        color.hex.toLowerCase().includes(searchLower)
    );
  }, [presetColorsList, searchTerm]);

  // Filter by showSelected if enabled
  const displayColors = useMemo(() => {
    let result = filteredColors;
    if (showSelectedFilter) {
      result = result.filter(
        (color) => color.hex.toLowerCase() === currentColor
      );
    }
    return result;
  }, [filteredColors, showSelectedFilter, currentColor]);

  // Convert colors array to items format for GenericPicker (multi-select)
  const colorItems = useMemo(() => {
    return (colors ?? [])
      .filter((c) => c.id && c.name) // Filter out nulls
      .map((c) => ({
        id: c.id!,
        name: c.name!,
        ...(c.description ? { description: c.description } : {}),
        ...(c.hex_code ? { hex_code: c.hex_code } : {}),
      }));
  }, [colors]);

  // Filter colors by search term (multi-select)
  const filteredColorItems = useMemo(() => {
    if (!searchTerm) return colorItems;
    const term = searchTerm.toLowerCase();
    return colorItems.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term) ||
        c.hex_code?.toLowerCase().includes(term)
    );
  }, [colorItems, searchTerm]);

  // Filter by showSelectedFilter if enabled (multi-select)
  const displayColorItems = useMemo(() => {
    if (showSelectedFilter) {
      return filteredColorItems.filter((c) => ids.includes(c.id));
    }
    return filteredColorItems;
  }, [filteredColorItems, showSelectedFilter, ids]);

  // Check if a color is suggested (multi-select)
  const isSuggested = useCallback(
    (colorId: string) => suggestionsList.includes(colorId),
    [suggestionsList]
  );

  const handleSelectMulti = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdColorIdsRef.current.has(id)
      );

      // Create resources for newly selected colors
      if (
        newlySelected.length > 0 &&
        createColorsAction &&
        group_id
      ) {
        for (const colorId of newlySelected) {
          try {
            const color = colors?.find((c) => c.id === colorId);
            if (color?.hex_code) {
              await createColorsAction({
                body: {
                  group_id: group_id,
                  name: color.name || "Color",
                  description: color.description || `Color: ${color.hex_code}`,
                  hex_code: color.hex_code,
                  mcp: false,
                },
              });
              createdColorIdsRef.current.add(colorId);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create color resource for ${colorId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      if (onChange) {
        onChange(selectedIds);
      }
    },
    [ids, onChange, createColorsAction, group_id, colors]
  );

  // Don't render if show_color is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  // Multi-select mode
  if (multiSelect) {
    return (
      <div className="space-y-2">
        {label && (
          <div className="flex items-center gap-2">
            <Label htmlFor={id} className="flex items-center gap-1">
              {label}
              {required && <span className="text-destructive">*</span>}
              {_onSearchChange && (
                <span className="text-xs text-muted-foreground ml-2">
                  {_searchPlaceholder}
                </span>
              )}
            </Label>
            {onGenerate && showAiGenerate && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={onGenerate}
                      disabled={disabled || aiIsGenerating}
                    >
                      {aiIsGenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {hasGenerated ? "Regenerate" : "Generate"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
        <GenericPicker<{ id: string; name: string; description?: string; hex_code?: string }>
          items={displayColorItems}
          itemIds={colors
            ?.map((c) => c.id)
            .filter((id): id is string => id !== null) ?? []}
          selectedIds={ids}
          onSelect={handleSelectMulti}
          multiSelect={true}
          getId={(item) => item.id}
          getLabel={(item) => item.name}
          renderItem={(item, isSelected) => (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isSuggested(item.id) && !isSelected && (
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                    Suggested
                  </span>
                )}
                {item.hex_code && (
                  <div
                    className="w-4 h-4 rounded border shrink-0"
                    style={{ backgroundColor: item.hex_code }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </div>
                  )}
                </div>
              </div>
              <Check
                className={cn(
                  "ml-auto flex-shrink-0 h-4 w-4",
                  isSelected ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          )}
          placeholder={_searchPlaceholder}
          disabled={disabled}
          showLabel={false}
          hideSelectedChips={false}
          showClearAll={true}
          searchTerm={searchTerm}
          onSearchChange={_onSearchChange}
        />
      </div>
    );
  }

  // Single-select mode (existing logic)
  return (
    <div className="space-y-4 min-w-0 w-full">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
        {onGenerate && showAiGenerate && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onGenerate}
                  disabled={disabled || aiIsGenerating || showDiff}
                >
                  {aiIsGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {resource?.generated ? "Regenerate" : "Generate"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {showDiff && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-success hover:text-success"
                    onClick={handleAcceptAi}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Accept</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={handleRejectAi}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reject</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>

      {/* Color Grid */}
      {displayColors.length > 0 && (
        <SelectableGrid<ColorItem>
          items={displayColors}
          selectedId={null} // Don't use selectedId since we're using unique IDs, not hex codes
          onSelect={(selectedId) => {
            // selectedId is the unique key, find the color item to get its hex
            const selectedColor = displayColors.find((color) => {
              const colorId = color.id
                ? color.id
                : `${color.hex.toLowerCase()}-${color.name}-${color.index ?? 0}`;
              return colorId === selectedId;
            });
            if (selectedColor) {
              const normalizedCurrent = currentColor;
              const selectedHex = selectedColor.hex.toLowerCase();
              handleChange(
                selectedHex === normalizedCurrent ? "" : selectedHex
              );
            }
          }}
          getId={(color) => {
            // Use id if available, otherwise use hex + name + index for uniqueness
            // This ensures unique React keys even when hex codes are duplicated
            if (color.id) {
              return color.id;
            }
            return `${color.hex.toLowerCase()}-${color.name}-${color.index ?? 0}`;
          }}
          // Use selectedIds to mark all colors with matching hex as selected
          selectedIds={
            currentColor
              ? displayColors
                  .filter(
                    (color) =>
                      color.hex.toLowerCase() === currentColor.toLowerCase()
                  )
                  .map((color) => {
                    // Map to the unique ID for each matching color
                    return color.id
                      ? color.id
                      : `${color.hex.toLowerCase()}-${color.name}-${color.index ?? 0}`;
                  })
              : undefined
          }
          renderItem={(color, isSelected) => {
            const isAiSuggested = showDiff && color.id === aiSuggestedId;

            return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              {/* Check icon - top right */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}

              {/* AI suggested badge - top right */}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}

              {/* Suggested badge - top right */}
              {!isSelected &&
                !isAiSuggested &&
                suggestedHexCodes.has(color.hex.toLowerCase()) && (
                  <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded">
                    Suggested
                  </div>
                )}

              <div className="flex items-center gap-2 flex-1 overflow-hidden">
                <div
                  className="w-8 h-8 rounded-lg border-2 border-border shrink-0"
                  style={{ backgroundColor: color.hex }}
                />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <h3 className="font-medium text-sm leading-tight truncate">
                    {color.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {color.hex}
                  </p>
                </div>
              </div>
            </div>
          );
          }}
          emptyMessage="No colors found. Try adjusting your search."
          disabled={disabled}
          horizontal
        />
      )}

      {/* Hex Input */}
      <div className="space-y-2">
        <Label htmlFor={`${id}Input`}>Hex Color</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}Input`}
            value={internalValue || ""}
            onChange={(e) => {
              const inputValue = e.target.value;
              // Allow any hex value (with or without #, any length)
              if (inputValue === "" || /^#?[0-9A-Fa-f]*$/.test(inputValue)) {
                handleChange(
                  inputValue.startsWith("#") ? inputValue : `#${inputValue}`
                );
              }
            }}
            placeholder="#000000"
            className="flex-1"
            disabled={disabled}
          />
          <div
            className="w-10 h-10 rounded border shrink-0"
            style={{
              backgroundColor: internalValue || "transparent",
            }}
          />
        </div>
      </div>
    </div>
  );
}
