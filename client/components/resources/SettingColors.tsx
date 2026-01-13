/**
 * SettingColors.tsx
 * Multi-select resource component for theme colors in settings
 * Follows Departments.tsx pattern for multi-select resources
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftColorsIn = InputOf<"/api/v4/resources/colors", "post">;
type CreateDraftColorsOut = OutputOf<"/api/v4/resources/colors", "post">;

export interface SettingColorItem {
  id: string;
  name: string;
  description?: string;
  hex_code?: string;
}

export interface SettingColorsProps {
  color_ids?: string[]; // Current color resource IDs (standardized prop name)
  color_resources?: Array<{
    id: string | null;
    name: string | null;
    description: string | null;
    hex_code: string | null;
    generated?: boolean | null;
  }>; // Selected color resources (each includes generated field)
  show_colors?: boolean; // Whether to show this resource picker
  color_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  colors?: Array<{
    id: string | null;
    name: string | null;
    description: string | null;
    hex_code: string | null;
    generated?: boolean | null;
  }>; // All available colors from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update color_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  showSelectedFilter?: boolean;
  onShowSelectedChange?: (value: boolean) => void;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createColorsAction?:
    | ((input: CreateDraftColorsIn) => Promise<CreateDraftColorsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function SettingColors({
  color_ids,
  color_resources,
  show_colors = false,
  color_suggestions,
  colors,
  disabled = false,
  onChange,
  label = "Theme Colors",
  id = "colors",
  required = false,
  placeholder = "Select colors...",
  description,
  searchTerm = "",
  onSearchChange,
  showSelectedFilter = false,
  onShowSelectedChange,
  group_id,
  agent_id,
  createColorsAction,
  onGenerate,
  isGenerating = false,
}: SettingColorsProps) {
  const ids = useMemo(() => color_ids ?? [], [color_ids]);
  const show = show_colors ?? false;
  const allColors = useMemo(() => colors ?? [], [colors]);
  const suggestionsList = useMemo(
    () => color_suggestions ?? [],
    [color_suggestions]
  );

  // Track which color IDs have already had resources created
  const createdColorIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdColorIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdColorIdsRef.current.add(id));
  }, [ids]);

  // Convert colors array to SettingColorItem format for GenericPicker
  const colorItems = useMemo(() => {
    return allColors
      .filter((c) => c.id && c.name) // Filter out nulls
      .map((c) => ({
        id: c.id!,
        name: c.name!,
        ...(c.description ? { description: c.description } : {}),
        ...(c.hex_code ? { hex_code: c.hex_code } : {}),
      }));
  }, [allColors]);

  // Filter colors by search term
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

  // Filter by showSelectedFilter if enabled
  const displayColorItems = useMemo(() => {
    if (showSelectedFilter) {
      return filteredColorItems.filter((c) => ids.includes(c.id));
    }
    return filteredColorItems;
  }, [filteredColorItems, showSelectedFilter, ids]);

  // Check if a color is suggested
  const isSuggested = useCallback(
    (colorId: string) => suggestionsList.includes(colorId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdColorIdsRef.current.has(id)
      );

      // Create resources for newly selected colors
      if (
        newlySelected.length > 0 &&
        createColorsAction &&
        agent_id &&
        group_id
      ) {
        for (const colorId of newlySelected) {
          try {
            await createColorsAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                color_id: colorId,
                mcp: false,
              },
            });
            createdColorIdsRef.current.add(colorId);
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
      onChange(selectedIds);
    },
    [ids, onChange, createColorsAction, agent_id, group_id]
  );

  // Check if any color resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return color_resources?.some((c) => c.generated) ?? false;
  }, [color_resources]);

  // Don't render if show_colors is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
          </Label>
          {onGenerate && agent_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
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
      <GenericPicker<SettingColorItem>
        items={displayColorItems}
        itemIds={allColors
          .map((c) => c.id)
          .filter((id): id is string => id !== null)} // All color IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
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
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
      />
    </div>
  );
}
