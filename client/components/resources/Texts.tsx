/**
 * Texts.tsx
 * Resource component for texts selection
 * Uses GenericPicker to select existing texts resources
 * Manages text_ids array and reports to parent
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

type CreateDraftTextsIn = InputOf<"/api/v4/resources/texts", "post">;
type CreateDraftTextsOut = OutputOf<"/api/v4/resources/texts", "post">;

export interface TextsItem {
  id: string;
  name: string;
  description?: string;
}

export interface TextsProps {
  text_ids?: string[]; // Current texts resource IDs (standardized prop name)
  text_resources?: Array<{
    text_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected texts resources (each includes generated field)
  show_texts?: boolean; // Whether to show this resource picker
  text_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  texts?: Array<{
    text_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available texts from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update text_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createTextsAction?:
    | ((input: CreateDraftTextsIn) => Promise<CreateDraftTextsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Texts({
  text_ids,
  text_resources,
  show_texts = false,
  text_suggestions,
  texts,
  disabled = false,
  onChange,
  label = "Texts",
  id = "texts",
  required = false,
  placeholder = "Select texts...",
  description,
  group_id,
  agent_id,
  createTextsAction,
  onGenerate,
  isGenerating = false,
}: TextsProps) {
  const ids = useMemo(() => text_ids ?? [], [text_ids]);
  const show = show_texts ?? false;
  const allTexts = useMemo(() => texts ?? [], [texts]);
  const suggestionsList = useMemo(
    () => text_suggestions ?? [],
    [text_suggestions]
  );

  // Track which texts IDs have already had resources created
  const createdTextsIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdTextsIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdTextsIdsRef.current.add(id));
  }, [ids]);

  // Convert texts array to TextsItem format for GenericPicker
  const textsItems = useMemo(() => {
    return allTexts
      .filter((m) => m.text_id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.text_id!,
        name: m.name!,
        ...(m.description ? { description: m.description } : {}),
      }));
  }, [allTexts]);

  // Check if a texts is suggested
  const isSuggested = useCallback(
    (textsId: string) => suggestionsList.includes(textsId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Texts are generated, not selected from existing artifacts
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any texts resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return text_resources?.some((m) => m.generated) ?? false;
  }, [text_resources]);

  // Don't render if show_texts is false (AFTER all hooks)
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
      <GenericPicker<TextsItem>
        items={textsItems}
        itemIds={allTexts
          .map((m) => m.text_id)
          .filter((id): id is string => id !== null)} // All texts IDs from array, filter nulls
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
