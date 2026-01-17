/**
 * Qualities.tsx
 * Resource component for qualities selection
 * Uses GenericPicker to select existing qualities resources
 * Manages quality_ids array and reports to parent
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

type CreateDraftQualitiesIn = InputOf<"/api/v4/resources/qualities", "post">;
type CreateDraftQualitiesOut = OutputOf<"/api/v4/resources/qualities", "post">;

export interface QualitiesItem {
  id: string;
  name: string;
  description?: string;
}

export interface QualitiesProps {
  quality_ids?: string[]; // Current qualities resource IDs (standardized prop name)
  quality_resources?: Array<{
    quality_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected qualities resources (each includes generated field)
  show_qualities?: boolean; // Whether to show this resource picker
  quality_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  qualities?: Array<{
    quality_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available qualities from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update quality_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createQualitiesAction?:
    | ((input: CreateDraftQualitiesIn) => Promise<CreateDraftQualitiesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Qualities({
  quality_ids,
  quality_resources,
  show_qualities = false,
  quality_suggestions,
  qualities,
  disabled = false,
  onChange,
  label = "Qualities",
  id = "qualities",
  required = false,
  placeholder = "Select qualities...",
  description,
  group_id,
  agent_id,
  createQualitiesAction,
  onGenerate,
  isGenerating = false,
}: QualitiesProps) {
  const ids = useMemo(() => quality_ids ?? [], [quality_ids]);
  const show = show_qualities ?? false;
  const allQualities = useMemo(() => qualities ?? [], [qualities]);
  const suggestionsList = useMemo(
    () => quality_suggestions ?? [],
    [quality_suggestions]
  );

  // Track which qualities IDs have already had resources created
  const createdQualitiesIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdQualitiesIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdQualitiesIdsRef.current.add(id));
  }, [ids]);

  // Convert qualities array to QualitiesItem format for GenericPicker
  const qualitiesItems = useMemo(() => {
    return allQualities
      .filter((m) => m.quality_id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.quality_id!,
        name: m.name!,
        ...(m.description ? { description: m.description } : {}),
      }));
  }, [allQualities]);

  // Check if a qualities is suggested
  const isSuggested = useCallback(
    (qualitiesId: string) => suggestionsList.includes(qualitiesId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Qualities are generated, not selected from existing artifacts
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any qualities resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return quality_resources?.some((m) => m.generated) ?? false;
  }, [quality_resources]);

  // Don't render if show_qualities is false (AFTER all hooks)
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
      <GenericPicker<QualitiesItem>
        items={qualitiesItems}
        itemIds={allQualities
          .map((m) => m.quality_id)
          .filter((id): id is string => id !== null)} // All qualities IDs from array, filter nulls
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
