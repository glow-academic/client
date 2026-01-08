/**
 * Colors.tsx
 * Resource component for color picker fields
 * Full UI component with Label + Color picker (SelectableGrid + hex input)
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { getColorName } from "@/utils/color-helpers";
import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftColorsIn = InputOf<"/api/v4/resources/colors", "post">;
type CreateDraftColorsOut = OutputOf<"/api/v4/resources/colors", "post">;

export interface ColorItem {
  hex: string;
  name: string;
}

export interface ColorsProps {
  color_id?: string | null; // Current color_id (standardized prop name)
  color_resource?: {
    id: string | null;
    name: string | null;
    description: string | null;
    hex_code: string | null;
  } | null; // Resource data from server (standardized prop name)
  show_color?: boolean; // Whether to show this resource picker
  color_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  colors?: Array<{
    id: string | null;
    name: string | null;
    description: string | null;
    hex_code: string | null;
  }>; // All available colors from API
  disabled?: boolean; // Based on can_edit flag
  onColorIdChange: (colorId: string | null) => void; // Update color_id in parent form state
  label?: string;
  id?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  showSelectedFilter?: boolean;
  onShowSelectedChange?: (value: boolean) => void;
  createColorsAction?:
    | ((input: CreateDraftColorsIn) => Promise<CreateDraftColorsOut>)
    | undefined;
  // Legacy props for backward compatibility
  colorResource?: {
    id: string;
    name: string;
    description: string;
    hex_code: string;
  } | null;
  colorId?: string | null;
  presetColors?: ColorItem[];
  colorSuggestions?: string[];
}

export function Colors({
  color_id,
  color_resource,
  show_color = false,
  color_suggestions,
  colors,
  disabled = false,
  onColorIdChange,
  label = "Color",
  id = "color",
  searchTerm = "",
  onSearchChange: _onSearchChange,
  searchPlaceholder: _searchPlaceholder = "Search colors...",
  showSelectedFilter = false,
  onShowSelectedChange: _onShowSelectedChange,
  createColorsAction,
  // Legacy props for backward compatibility
  colorResource,
  colorId: _colorId,
  presetColors,
  colorSuggestions,
}: ColorsProps) {
  // Use standardized props with fallback to legacy props
  const resource = color_resource ?? colorResource ?? null;
  const resourceId = color_id ?? _colorId ?? null;
  const show = show_color ?? false;
  const suggestionsList = useMemo(
    () => color_suggestions ?? colorSuggestions ?? [],
    [color_suggestions, colorSuggestions]
  );

  // Convert colors array from API format to ColorItem format
  const presetColorsList = useMemo(() => {
    if (colors && colors.length > 0) {
      return colors
        .filter((c) => c.hex_code && c.name) // Filter out nulls
        .map((c) => ({
          hex: c.hex_code!,
          name: c.name!,
        }));
    }
    return presetColors ?? [];
  }, [colors, presetColors]);

  // Handle nullable resource properties
  const resourceHexCode = resource?.hex_code ?? null;
  const [internalValue, setInternalValue] = useState(resourceHexCode || "");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(resourceHexCode || "");
  const isInitialMountRef = useRef(true);

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

  // Don't render if show_color is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  // Debounced resource creation
  useEffect(() => {
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
      if (!internalValue) {
        // Clear resource ID if value is empty
        onColorIdChange(null);
      }
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const hexCode = currentColor;
        const colorName = getColorName(hexCode);
        const result = await createColorsAction({
          body: {
            name: colorName,
            description: `Color: ${hexCode}`,
            hex_code: hexCode,
          },
        });
        if (result.color_id) {
          onColorIdChange(result.color_id);
        }
        lastSavedValueRef.current = internalValue;
      } catch (error) {
        console.error("Failed to create color resource:", error);
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, currentColor, createColorsAction, onColorIdChange]);

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
  }, []);

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

  return (
    <div className="space-y-4">
      <Label htmlFor={id}>{label}</Label>

      {/* Color Grid */}
      {displayColors.length > 0 && (
        <SelectableGrid<ColorItem>
          items={displayColors}
          selectedId={currentColor}
          onSelect={(colorHex) => {
            const normalizedCurrent = currentColor;
            handleChange(colorHex === normalizedCurrent ? "" : colorHex);
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

              {/* Suggested badge - top left */}
              {!isSelected &&
                suggestedHexCodes.has(color.hex.toLowerCase()) && (
                  <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                    Suggested
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
          disabled={disabled}
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
