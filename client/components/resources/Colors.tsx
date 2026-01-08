/**
 * Colors.tsx
 * Resource component for color picker fields
 * Full UI component with Label + Color picker (SelectableGrid + hex input)
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getColorName } from "@/utils/color-helpers";
import { Check } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ColorItem {
  hex: string;
  name: string;
}

export interface ColorsProps {
  value: string;
  onChange: (value: string) => void;
  draftId: string | null;
  presetColors: ColorItem[];
  label?: string;
  disabled?: boolean;
  id?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  showSelectedFilter?: boolean;
  onShowSelectedChange?: (value: boolean) => void;
  createDraftColorsAction?:
    | ((input: {
        body: {
          draft_id: string;
          name: string;
          description: string;
          hex_code: string;
        };
      }) => Promise<{ color_id?: string | null; version?: number | null }>)
    | undefined;
}

export function Colors({
  value,
  onChange,
  draftId,
  presetColors,
  label = "Color",
  disabled = false,
  id = "color",
  searchTerm = "",
  onSearchChange,
  searchPlaceholder = "Search colors...",
  showSelectedFilter = false,
  onShowSelectedChange,
  createDraftColorsAction,
}: ColorsProps) {
  const [internalValue, setInternalValue] = useState(value);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(value);
  const isInitialMountRef = useRef(true);

  // Sync external value changes
  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
      lastSavedValueRef.current = value;
    }
  }, [value]);

  // Normalize current color for comparison
  const currentColor = useMemo(() => {
    if (!internalValue) return "";
    return internalValue.toLowerCase().startsWith("#")
      ? internalValue.toLowerCase()
      : `#${internalValue.toLowerCase()}`;
  }, [internalValue]);

  // Debounced autosave
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

    // Skip if no draftId, no action, or empty value
    if (!draftId || !createDraftColorsAction || !internalValue) {
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
        await createDraftColorsAction({
          body: {
            draft_id: draftId,
            name: colorName,
            description: `Color: ${hexCode}`,
            hex_code: hexCode,
          },
        });
        lastSavedValueRef.current = internalValue;
      } catch (error) {
        console.error("Failed to save draft color:", error);
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, currentColor, draftId, createDraftColorsAction]);

  const handleChange = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      onChange(newValue);
    },
    [onChange]
  );

  // Filter by showSelected if enabled (presetColors already filtered by search in parent)
  const displayColors = useMemo(() => {
    if (!showSelectedFilter) {
      return presetColors;
    }
    return presetColors.filter(
      (color) => color.hex.toLowerCase() === currentColor
    );
  }, [presetColors, showSelectedFilter, currentColor]);

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
            value={value || ""}
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
