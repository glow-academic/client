/**
 * Audios.tsx
 * Resource component for audios selection
 * Uses GenericPicker to select existing audios resources
 * Manages audio_ids array and reports to parent
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

type CreateDraftAudiosIn = InputOf<"/api/v4/resources/audios", "post">;
type CreateDraftAudiosOut = OutputOf<"/api/v4/resources/audios", "post">;

export interface AudiosItem {
  id: string;
  name: string;
  description?: string;
}

export interface AudiosProps {
  audio_ids?: string[]; // Current audios resource IDs (standardized prop name)
  audio_resources?: Array<{
    audio_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected audios resources (each includes generated field)
  show_audios?: boolean; // Whether to show this resource picker
  audio_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  audios?: Array<{
    audio_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available audios from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update audio_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createAudiosAction?:
    | ((input: CreateDraftAudiosIn) => Promise<CreateDraftAudiosOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Audios({
  audio_ids,
  audio_resources,
  show_audios = false,
  audio_suggestions,
  audios,
  disabled = false,
  onChange,
  label = "Audios",
  id = "audios",
  required = false,
  placeholder = "Select audios...",
  description,
  group_id,
  agent_id,
  createAudiosAction,
  onGenerate,
  isGenerating = false,
}: AudiosProps) {
  const ids = useMemo(() => audio_ids ?? [], [audio_ids]);
  const show = show_audios ?? false;
  const allAudios = useMemo(() => audios ?? [], [audios]);
  const suggestionsList = useMemo(
    () => audio_suggestions ?? [],
    [audio_suggestions]
  );

  // Track which audios IDs have already had resources created
  const createdAudiosIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdAudiosIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdAudiosIdsRef.current.add(id));
  }, [ids]);

  // Convert audios array to AudiosItem format for GenericPicker
  const audiosItems = useMemo(() => {
    return allAudios
      .filter((m) => m.audio_id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.audio_id!,
        name: m.name!,
        ...(m.description ? { description: m.description } : {}),
      }));
  }, [allAudios]);

  // Check if a audios is suggested
  const isSuggested = useCallback(
    (audiosId: string) => suggestionsList.includes(audiosId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Audios are generated, not selected from existing artifacts
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any audios resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return audio_resources?.some((m) => m.generated) ?? false;
  }, [audio_resources]);

  // Don't render if show_audios is false (AFTER all hooks)
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
      <GenericPicker<AudiosItem>
        items={audiosItems}
        itemIds={allAudios
          .map((m) => m.audio_id)
          .filter((id): id is string => id !== null)} // All audios IDs from array, filter nulls
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
