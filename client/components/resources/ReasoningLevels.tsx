/**
 * ReasoningLevels.tsx
 * Resource component for reasoning level selection
 * Uses GenericPicker for selection
 * Creates resources independently and reports resource IDs to parent
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
import { Loader2, Sparkles } from "lucide-react";
import { useMemo } from "react";

type CreateDraftReasoningLevelsIn = InputOf<
  "/api/v4/resources/reasoning_levels",
  "post"
>;
type CreateDraftReasoningLevelsOut = OutputOf<
  "/api/v4/resources/reasoning_levels",
  "post"
>;

export interface ReasoningLevelItem {
  id: string;
  reasoning_level: string;
}

export interface ReasoningLevelsProps {
  reasoning_level_id?: string | null; // Current reasoning_level_id (standardized prop name)
  reasoning_level_resource?: {
    id: string | null;
    reasoning_level: string | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_reasoning_levels?: boolean; // Whether to show this resource picker
  reasoning_level_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  reasoning_levels?: Array<{
    id: string | null;
    reasoning_level: string | null;
    generated?: boolean | null;
  }>; // Array of all available reasoning level options
  disabled?: boolean; // Based on can_edit flag
  onReasoningLevelIdChange: (
    reasoningLevelId: string | null
  ) => void; // Update reasoning_level_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createReasoningLevelsAction?:
    | ((input: CreateDraftReasoningLevelsIn) => Promise<CreateDraftReasoningLevelsOut>)
    | undefined;
}

export function ReasoningLevels({
  reasoning_level_id,
  reasoning_level_resource,
  show_reasoning_levels = true,
  reasoning_level_suggestions,
  reasoning_levels,
  disabled = false,
  onReasoningLevelIdChange,
  onGenerate,
  isGenerating = false,
  label = "Reasoning Level",
  placeholder = "Select a reasoning level",
  required = false,
  id = "reasoning_level",
  "data-testid": dataTestId,
  helpText,
  group_id,
  agent_id,
  createReasoningLevelsAction,
}: ReasoningLevelsProps) {
  const resource = reasoning_level_resource ?? null;
  const resourceId = reasoning_level_id ?? null;
  const show = show_reasoning_levels ?? true;
  const suggestionsList = useMemo(
    () => reasoning_level_suggestions ?? [],
    [reasoning_level_suggestions]
  );

  // Convert reasoning_levels array to ReasoningLevelItem format for GenericPicker
  const pickerItems = useMemo(() => {
    if (reasoning_levels && reasoning_levels.length > 0) {
      return reasoning_levels
        .filter((rl) => rl.id && rl.reasoning_level) // Filter out nulls
        .map((rl) => ({
          id: rl.id!,
          reasoning_level: rl.reasoning_level!,
        }));
    }
    return [];
  }, [reasoning_levels]);

  // Don't render if show_reasoning_levels is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
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
                  {resource?.generated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <GenericPicker<ReasoningLevelItem>
        items={pickerItems}
        selectedIds={resourceId ? [resourceId] : []}
        onSelect={(ids) => onReasoningLevelIdChange(ids[0] || null)}
        multiSelect={false}
        getId={(item) => item.id}
        getLabel={(item) =>
          item.reasoning_level.charAt(0).toUpperCase() +
          item.reasoning_level.slice(1)
        }
        getSearchText={(item) => item.reasoning_level}
        renderPreview={(item) => (
          <div className="space-y-1">
            <div className="font-medium">
              {item.reasoning_level.charAt(0).toUpperCase() +
                item.reasoning_level.slice(1)}
            </div>
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        label={label}
        description={helpText}
        emptyMessage="No reasoning levels available"
        groupHeading="Reasoning Levels"
        id={id}
        data-testid={dataTestId}
      />
    </div>
  );
}
