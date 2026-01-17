/**
 * Values.tsx
 * Resource component for values selection
 * Uses GenericPicker to select existing values resources
 * Manages value_ids array and reports to parent
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

type CreateDraftValuesIn = InputOf<"/api/v4/resources/values", "post">;
type CreateDraftValuesOut = OutputOf<"/api/v4/resources/values", "post">;

export interface ValuesItem {
  id: string;
  name: string;
  description?: string;
}

export interface ValuesProps {
  value_ids?: string[]; // Current values resource IDs (standardized prop name)
  value_resources?: Array<{
    value_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected values resources (each includes generated field)
  show_values?: boolean; // Whether to show this resource picker
  value_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  values?: Array<{
    value_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available values from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update value_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createValuesAction?:
    | ((input: CreateDraftValuesIn) => Promise<CreateDraftValuesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Values({
  value_ids,
  value_resources,
  show_values = false,
  value_suggestions,
  values,
  disabled = false,
  onChange,
  label = "Values",
  id = "values",
  required = false,
  placeholder = "Select values...",
  description,
  group_id,
  agent_id,
  createValuesAction,
  onGenerate,
  isGenerating = false,
}: ValuesProps) {
  const ids = useMemo(() => value_ids ?? [], [value_ids]);
  const show = show_values ?? false;
  const allValues = useMemo(() => values ?? [], [values]);
  const suggestionsList = useMemo(
    () => value_suggestions ?? [],
    [value_suggestions]
  );

  // Track which values IDs have already had resources created
  const createdValuesIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdValuesIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdValuesIdsRef.current.add(id));
  }, [ids]);

  // Convert values array to ValuesItem format for GenericPicker
  const valuesItems = useMemo(() => {
    return allValues
      .filter((m) => m.value_id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.value_id!,
        name: m.name!,
        ...(m.description ? { description: m.description } : {}),
      }));
  }, [allValues]);

  // Check if a values is suggested
  const isSuggested = useCallback(
    (valuesId: string) => suggestionsList.includes(valuesId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Values are generated, not selected from existing artifacts
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any values resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return value_resources?.some((m) => m.generated) ?? false;
  }, [value_resources]);

  // Don't render if show_values is false (AFTER all hooks)
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
      <GenericPicker<ValuesItem>
        items={valuesItems}
        itemIds={allValues
          .map((m) => m.value_id)
          .filter((id): id is string => id !== null)} // All values IDs from array, filter nulls
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
      />
    </div>
  );
}
