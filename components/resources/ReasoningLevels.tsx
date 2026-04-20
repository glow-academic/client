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
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface ReasoningLevelResourceItem {
  id?: string | null;
  reasoning_level?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface ReasoningLevelItem {
  id: string;
  reasoning_level: string;
}

export interface ReasoningLevelsProps {
  reasoning_level_id?: string | null; // Current reasoning_level_id (standardized prop name)
  reasoning_level_resource?: ReasoningLevelResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_reasoning_levels?: boolean; // Whether to show this resource picker
  reasoning_levels?: ReasoningLevelResourceItem[]; // Array of all available reasoning level options
  disabled?: boolean; // Based on can_edit flag
  onReasoningLevelIdChange: (
    reasoningLevelId: string | null
  ) => void; // Update reasoning_level_id in parent form state
  label?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  aiReasoningLevelResources?: Array<{
    reasoning_level_id?: string | null;
    reasoning_level?: string | null;
  }> | null;
}

export function ReasoningLevels({
  reasoning_level_id,
  reasoning_level_resource: _reasoning_level_resource,
  show_reasoning_levels = true,
  reasoning_levels,
  disabled = false,
  onReasoningLevelIdChange,
  label = "Reasoning Level",
  placeholder = "Select a reasoning level",
  required = false,
  id = "reasoning_level",
  "data-testid": dataTestId,
  helpText,
  searchTerm,
  onSearchChange,
  aiReasoningLevelResources: _aiReasoningLevelResources,
}: ReasoningLevelsProps) {
  const resourceId = reasoning_level_id ?? null;
  const show = show_reasoning_levels ?? true;
  const allReasoningLevels = useMemo(() => reasoning_levels ?? [], [reasoning_levels]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allReasoningLevels.filter((rl) => rl.pending && rl.id);
  }, [allReasoningLevels]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((rl) => rl.id).filter(Boolean) as string[]),
    [pendingItems]
  );

  // Check if a reasoning level is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (reasoningLevelId: string) => {
      const rl = allReasoningLevels.find((r) => r.id === reasoningLevelId);
      return rl?.suggested === true;
    },
    [allReasoningLevels]
  );

  const filteredReasoningLevels = useMemo(() => {
    if (!searchTerm?.trim()) {
      return allReasoningLevels;
    }
    const term = searchTerm.toLowerCase();
    return allReasoningLevels.filter((level) => {
      const value = level.reasoning_level?.toLowerCase() ?? "";
      return value.includes(term);
    });
  }, [allReasoningLevels, searchTerm]);

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

  // Accept pending — keep pending selection (already in selection, no-op)
  const handleAccept = useCallback(() => {
    // Pending items are already selected, just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — clear pending selection
  const handleReject = useCallback(() => {
    if (resourceId && pendingIds.has(resourceId)) {
      onReasoningLevelIdChange(null);
    }
  }, [resourceId, pendingIds, onReasoningLevelIdChange]);

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
          const isPending = pendingIds.has(item.id);

          return (
            <div className={cn(
              "flex items-center justify-between w-full",
              isPending && "ring-2 ring-success bg-success/10 rounded px-2 py-1 -mx-2 -my-1"
            )}>
              <div className="flex items-center gap-2">
                {isPending && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                    Pending
                  </span>
                )}
                {isSuggested(item.id) && !isSelected && !isPending && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Suggested</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <span>
                  {item.reasoning_level.charAt(0).toUpperCase() +
                    item.reasoning_level.slice(1)}
                </span>
              </div>
              <Check
                className={cn(
                  "ml-auto flex-shrink-0 h-4 w-4",
                  isSelected && !isPending ? "opacity-100" : "opacity-0"
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
