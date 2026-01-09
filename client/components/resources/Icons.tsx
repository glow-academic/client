/**
 * Icons.tsx
 * Resource component for icon picker fields
 * Full UI component with Label + Icon picker (SelectableGrid)
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Label } from "@/components/ui/label";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { PERSONA_ICON_MAP } from "@/utils/persona-icons";
import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftIconsIn = InputOf<"/api/v4/resources/icons", "post">;
type CreateDraftIconsOut = OutputOf<"/api/v4/resources/icons", "post">;

export interface IconsProps {
  icon_id?: string | null; // Current icon_id (standardized prop name)
  icon_resource?: {
    id: string | null;
    name: string | null;
    description: string | null;
    value: string | null;
    generated?: boolean;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_icon?: boolean; // Whether to show this resource picker
  icon_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  icons?: Array<{
    id: string | null;
    name: string | null;
    description: string | null;
    value: string | null;
    generated?: boolean;
  }>; // All available icons from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onIconIdChange: (iconId: string | null) => void; // Update icon_id in parent form state
  label?: string;
  id?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  showSelectedFilter?: boolean;
  onShowSelectedChange?: (value: boolean) => void;
  createIconsAction?:
    | ((input: CreateDraftIconsIn) => Promise<CreateDraftIconsOut>)
    | undefined;
  // Legacy props for backward compatibility
  iconResource?: {
    id: string;
    name: string;
    description: string;
    value: string;
    generated?: boolean;
  } | null;
  iconId?: string | null;
  allIcons?: string[];
  suggestedIcons?: string[];
  iconSuggestions?: string[];
}

export function Icons({
  icon_id,
  icon_resource,
  show_icon = false,
  icon_suggestions,
  icons,
  disabled = false,
  onIconIdChange,
  label = "Icon",
  id = "icon",
  searchTerm = "",
  onSearchChange,
  searchPlaceholder = "Search icons...",
  showSelectedFilter = false,
  onShowSelectedChange,
  createIconsAction,
  // Legacy props for backward compatibility
  iconResource,
  iconId: _iconId,
  allIcons,
  suggestedIcons = [],
  iconSuggestions,
}: IconsProps) {
  // Use standardized props with fallback to legacy props
  const resource = icon_resource ?? iconResource ?? null;
  const show = show_icon ?? false;
  const suggestionsListMemo = useMemo(
    () => icon_suggestions ?? iconSuggestions ?? [],
    [icon_suggestions, iconSuggestions]
  );

  // Convert icons array from API format to string array (extract value field)
  const allIconsList = useMemo(() => {
    if (icons && icons.length > 0) {
      return icons
        .map((i) => i.value)
        .filter((v): v is string => v !== null && v !== undefined);
    }
    return allIcons ?? [];
  }, [icons, allIcons]);

  // Get suggested icon values from icon_suggestions (UUIDs) by looking up in icons array
  const suggestedIconsList = useMemo(() => {
    if (suggestionsListMemo.length > 0 && icons) {
      return suggestionsListMemo
        .map((id) => icons.find((i) => i.id === id)?.value)
        .filter((v): v is string => v !== null && v !== undefined);
    }
    return suggestedIcons ?? [];
  }, [suggestionsListMemo, icons, suggestedIcons]);

  // Handle nullable resource properties
  const resourceValue = resource?.value ?? null;
  // Use icon_id to find initial value if resource is not available
  const initialValue = useMemo(() => {
    if (resourceValue) return resourceValue;
    if (icon_id && icons) {
      const icon = icons.find((i) => i.id === icon_id);
      return icon?.value || "";
    }
    return "";
  }, [resourceValue, icon_id, icons]);
  const [internalValue, setInternalValue] = useState(initialValue);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(initialValue);
  const isInitialMountRef = useRef(true);

  // Update internal value when icon_resource or icon_id changes
  useEffect(() => {
    if (initialValue) {
      setInternalValue(initialValue);
      lastSavedValueRef.current = initialValue;
    }
  }, [initialValue]);

  // Handle search term changes
  useEffect(() => {
    if (onSearchChange && searchTerm !== undefined) {
      onSearchChange(searchTerm);
    }
  }, [searchTerm, onSearchChange]);

  // Handle showSelected filter changes
  useEffect(() => {
    if (onShowSelectedChange && showSelectedFilter !== undefined) {
      onShowSelectedChange(showSelectedFilter);
    }
  }, [showSelectedFilter, onShowSelectedChange]);

  // Filter icons based on search term
  const filteredIcons = useMemo(() => {
    if (!searchTerm.trim()) {
      return allIconsList;
    }
    const searchLower = searchTerm.toLowerCase();
    return allIconsList.filter((icon) =>
      icon.toLowerCase().includes(searchLower)
    );
  }, [allIconsList, searchTerm]);

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
        onIconIdChange(null);
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
        const iconIndex = allIconsList.indexOf(internalValue);
        const result = await createIconsAction({
          body: {
            name: internalValue,
            description: `Icon: ${internalValue}`,
            value: iconIndex >= 0 ? iconIndex : 0,
          },
        });
        if (result && typeof result === "object" && "icon_id" in result) {
          const iconId = (result as { icon_id?: string | null }).icon_id;
          if (iconId) {
            onIconIdChange(iconId);
          }
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
  }, [internalValue, createIconsAction, allIconsList, onIconIdChange]);

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
  }, []);

  // Don't render if show_icon is false (AFTER all hooks)
  if (!show) {
    return null;
  }

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

          const isSuggested = suggestedIconsList.includes(iconName);

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
