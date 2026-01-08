/**
 * Icons.tsx
 * Resource component for icon picker fields
 * Full UI component with Label + Icon picker (SelectableGrid)
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Label } from "@/components/ui/label";
import { PERSONA_ICON_MAP } from "@/utils/persona-icons";
import { Check } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface IconsProps {
  value: string; // Initial display value (icon name from server data)
  resourceId: string | null; // Current resource_id (for form state)
  onChange: (value: string) => void; // Update display value (for UI only)
  onResourceIdChange: (resourceId: string | null) => void; // Update resource_id in parent form state
  allIcons: string[];
  suggestedIcons?: string[];
  label?: string;
  disabled?: boolean;
  id?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  showSelectedFilter?: boolean;
  onShowSelectedChange?: (value: boolean) => void;
  createIconsAction?:
    | ((input: {
        body: {
          name: string;
          description: string;
          value: number;
        };
      }) => Promise<{ icon_id?: string | null }>)
    | undefined;
}

export function Icons({
  value,
  resourceId,
  onChange,
  onResourceIdChange,
  allIcons,
  suggestedIcons = [],
  label = "Icon",
  disabled = false,
  id = "icon",
  searchTerm = "",
  onSearchChange,
  searchPlaceholder = "Search icons...",
  showSelectedFilter = false,
  onShowSelectedChange,
  createIconsAction,
}: IconsProps) {
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

  // Filter icons based on search term
  const filteredIcons = useMemo(() => {
    if (!searchTerm.trim()) {
      return allIcons;
    }
    const searchLower = searchTerm.toLowerCase();
    return allIcons.filter((icon) =>
      icon.toLowerCase().includes(searchLower)
    );
  }, [allIcons, searchTerm]);

  // Filter by showSelected if enabled
  const displayIcons = useMemo(() => {
    if (!showSelectedFilter) {
      return filteredIcons;
    }
    return filteredIcons.filter((icon) => icon === internalValue);
  }, [filteredIcons, showSelectedFilter, internalValue]);

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
    if (!createIconsAction || !internalValue) {
      if (!internalValue) {
        // Clear resource ID if value is empty
        onResourceIdChange(null);
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
        // Find index of icon for value (or use 0)
        const iconIndex = allIcons.indexOf(internalValue);
        const result = await createIconsAction({
          body: {
            name: internalValue,
            description: `Icon: ${internalValue}`,
            value: iconIndex >= 0 ? iconIndex : 0,
          },
        });
        if (result.icon_id) {
          onResourceIdChange(result.icon_id);
        }
        lastSavedValueRef.current = internalValue;
      } catch (error) {
        console.error("Failed to create icon resource:", error);
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, createIconsAction, allIcons, onResourceIdChange]);

  const handleChange = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      onChange(newValue); // Update display value immediately for UI
    },
    [onChange]
  );

  return (
    <div className="space-y-4">
      <Label htmlFor={id}>{label}</Label>

      <SelectableGrid
        items={displayIcons}
        selectedId={internalValue || ""}
        onSelect={(icon) => {
          handleChange(icon === internalValue ? "" : icon);
        }}
        getId={(icon) => icon}
        renderItem={(iconName, isSelected) => {
          const IconComponent =
            PERSONA_ICON_MAP[iconName as keyof typeof PERSONA_ICON_MAP];
          if (!IconComponent) return null;

          const isSuggested = suggestedIcons.includes(iconName);

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
        disabled={disabled}
      />
    </div>
  );
}
