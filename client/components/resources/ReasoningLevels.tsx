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
import { useResourceAi } from "@/hooks/use-resource-ai";
import { cn } from "@/lib/utils";
import type { OutputOf } from "@/lib/api/types";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type ReasoningLevelsGetResponse = OutputOf<"/api/v4/resources/reasoning_levels/get", "post">;
export type ReasoningLevelResourceItem = NonNullable<ReasoningLevelsGetResponse["items"]>[number];

export interface ReasoningLevelItem {
  id: string;
  reasoning_level: string;
}

export interface ReasoningLevelsProps {
  reasoning_level_id?: string | null; // Current reasoning_level_id (standardized prop name)
  reasoning_level_resource?: ReasoningLevelResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_reasoning_levels?: boolean; // Whether to show this resource picker
  reasoning_level_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  reasoning_levels?: ReasoningLevelResourceItem[]; // Array of all available reasoning level options
  disabled?: boolean; // Based on can_edit flag
  onReasoningLevelIdChange: (
    reasoningLevelId: string | null
  ) => void; // Update reasoning_level_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  label?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  group_id?: string | null; // Group ID for linking resources
  // AI diff view props
  aiReasoningLevelResources?: Array<{
    reasoning_level_id?: string | null;
    reasoning_level?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function ReasoningLevels({
  reasoning_level_id,
  reasoning_level_resource,
  show_reasoning_levels = true,
  reasoning_levels,
  disabled = false,
  onReasoningLevelIdChange,
  onGenerate,
  isGenerating: _isGenerating = false,
  showAiGenerate = false,
  label = "Reasoning Level",
  placeholder = "Select a reasoning level",
  required = false,
  id = "reasoning_level",
  "data-testid": dataTestId,
  helpText,
  searchTerm,
  onSearchChange,
  group_id,
  // AI diff view props (deprecated - now handled by useResourceAi hook)
  aiReasoningLevelResources: _aiReasoningLevelResources,
  onAccept: _onAccept,
  onReject: _onReject,
}: ReasoningLevelsProps) {
  const resource = reasoning_level_resource ?? null;
  const resourceId = reasoning_level_id ?? null;
  const show = show_reasoning_levels ?? true;
  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, accept: acceptAi, reject: rejectAi } = useResourceAi({
    resourceType: "reasoning_levels",
    groupId: group_id,
  });

  // AI suggestion state
  const showDiff = !!aiSuggestion;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestion?.reasoning_level_id
          ? [aiSuggestion.reasoning_level_id]
          : []
      ),
    [aiSuggestion]
  );

  const filteredReasoningLevels = useMemo(() => {
    if (!searchTerm?.trim()) {
      return reasoning_levels ?? [];
    }
    const term = searchTerm.toLowerCase();
    return (reasoning_levels ?? []).filter((level) => {
      const value = level.reasoning_level?.toLowerCase() ?? "";
      return value.includes(term);
    });
  }, [reasoning_levels, searchTerm]);

  // Convert reasoning_levels array to ReasoningLevelItem format for GenericPicker
  const pickerItems = useMemo(() => {
    if (filteredReasoningLevels.length > 0) {
      return filteredReasoningLevels
        .filter((rl) => rl.id && rl.reasoning_level) // Filter out nulls
        .map((rl) => ({
          id: rl.id!,
          reasoning_level: rl.reasoning_level!,
        }));
    }
    return [];
  }, [filteredReasoningLevels]);

  // Accept AI suggestion - set the AI-suggested reasoning level
  const handleAccept = useCallback(() => {
    if (!aiSuggestion) return;
    const suggestedId = aiSuggestion.reasoning_level_id;
    if (suggestedId && suggestedId !== resourceId) {
      onReasoningLevelIdChange(suggestedId);
    }
    acceptAi();
  }, [aiSuggestion, resourceId, onReasoningLevelIdChange, acceptAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    rejectAi();
  }, [rejectAi]);

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
          {onGenerate && showAiGenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || aiIsGenerating || showDiff}
                  >
                    {aiIsGenerating ? (
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
          {showDiff && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-success hover:text-success"
                      onClick={handleAccept}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={handleReject}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
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
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div className={cn(
              "flex items-center justify-between w-full",
              isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10 rounded px-2 py-1 -mx-2 -my-1"
            )}>
              <div className="flex items-center gap-2">
                {isAiSuggested && !isSelected && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                    AI Suggested
                  </span>
                )}
                <span>
                  {item.reasoning_level.charAt(0).toUpperCase() +
                    item.reasoning_level.slice(1)}
                </span>
              </div>
              <Check
                className={cn(
                  "ml-auto flex-shrink-0 h-4 w-4",
                  isSelected ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          );
        }}
        renderPreview={(item) => (
          <div className="space-y-1">
            <div className="font-medium">
              {item.reasoning_level.charAt(0).toUpperCase() +
                item.reasoning_level.slice(1)}
            </div>
          </div>
        )}
        {...(searchTerm !== undefined ? { initialSearchTerm: searchTerm } : {})}
        {...(onSearchChange ? { onSearchChange } : {})}
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
