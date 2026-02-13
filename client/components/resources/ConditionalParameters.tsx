/**
 * ConditionalParameters.tsx
 * Resource component for conditional parameter selection
 * Uses SelectableGrid to display conditional parameters as horizontal scrollable cards
 * Manages conditional_parameter_ids array and reports to parent
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
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

export interface ConditionalParameterItem {
  id: string;
  parameter_id: string;
}

export interface ConditionalParametersProps {
  conditional_parameter_ids?: string[];
  conditional_parameter_resources?: Array<{
    id?: string | null;
    parameter_id?: string | null;
    generated?: boolean | null;
  }>;
  show_conditional_parameters?: boolean;
  conditional_parameter_suggestions?: string[];
  conditional_parameters?: Array<{
    id?: string | null;
    parameter_id?: string | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  // AI diff props
  aiConditionalParameterResources?: Array<{
    id?: string | null;
    parameter_id?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function ConditionalParameters({
  conditional_parameter_ids,
  conditional_parameter_resources,
  show_conditional_parameters = false,
  conditional_parameter_suggestions,
  conditional_parameters,
  disabled = false,
  onChange,
  label = "Conditional Parameters",
  // AI diff props
  aiConditionalParameterResources,
  onAccept,
  onReject,
}: ConditionalParametersProps) {
  const ids = useMemo(
    () => conditional_parameter_ids ?? [],
    [conditional_parameter_ids]
  );
  const show = show_conditional_parameters ?? false;
  const allItems = useMemo(
    () => conditional_parameters ?? [],
    [conditional_parameters]
  );
  const suggestionsList = useMemo(
    () => conditional_parameter_suggestions ?? [],
    [conditional_parameter_suggestions]
  );

  // AI suggestion state
  const showDiff = !!aiConditionalParameterResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiConditionalParameterResources
          ?.map((c) => c.id)
          .filter(Boolean) as string[]
      ),
    [aiConditionalParameterResources]
  );

  // Convert to items format for SelectableGrid
  const items = useMemo(() => {
    return allItems
      .filter((c) => c.id)
      .map((c) => ({
        id: c.id!,
        parameter_id: c.parameter_id ?? "",
      }));
  }, [allItems]);

  const isSuggested = useCallback(
    (itemId: string) => suggestionsList.includes(itemId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept AI suggestion
  const handleAccept = useCallback(() => {
    if (!aiConditionalParameterResources?.length) return;
    const newIds = aiConditionalParameterResources
      .map((c) => c.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiConditionalParameterResources, ids, onChange, onAccept]);

  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Check if any resource is generated (must be before early return)
  const _hasGenerated = useMemo(() => {
    return conditional_parameter_resources?.some((c) => c.generated) ?? false;
  }, [conditional_parameter_resources]);

  // Don't render if show is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4 min-w-0 w-full">
      {label && (
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-1">{label}</Label>
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
      )}

      <SelectableGrid<ConditionalParameterItem>
        items={items}
        selectedId={null}
        selectedIds={ids}
        onSelect={(itemId) => {
          const newIds = ids.includes(itemId)
            ? ids.filter((id) => id !== itemId)
            : [...ids, itemId];
          handleSelect(newIds);
        }}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}
              {isSuggested(item.id) && !isSelected && !isAiSuggested && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded">
                  Suggested
                </div>
              )}
              <div className="flex flex-col justify-center gap-1 flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate">
                  {item.parameter_id
                    ? `Parameter: ${item.parameter_id.slice(0, 8)}...`
                    : "Unnamed"}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No conditional parameters available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
