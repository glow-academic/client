/**
 * Options.tsx
 * Resource component for option selection
 * Uses SelectableGrid to display options as horizontal scrollable cards
 * Manages option_ids array and reports to parent
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
import type { OutputOf } from "@/lib/api/types";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type OptionsGetResponse = OutputOf<"/api/v4/resources/options/get", "post">;
export type OptionResourceItem = NonNullable<OptionsGetResponse["items"]>[number];

export interface OptionItem {
  id: string;
  option_text: string;
  is_correct: boolean;
}

export interface OptionsProps {
  option_ids?: string[];
  option_resources?: OptionResourceItem[];
  show_options?: boolean;
  option_suggestions?: string[];
  options?: OptionResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  // AI diff props
  aiOptionResources?: Array<{
    option_id?: string | null;
    option_text?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Options({
  option_ids,
  option_resources: _option_resources,
  show_options = false,
  option_suggestions,
  options,
  disabled = false,
  onChange,
  label = "Options",
  // AI diff props
  aiOptionResources,
  onAccept,
  onReject,
}: OptionsProps) {
  const ids = useMemo(() => option_ids ?? [], [option_ids]);
  const show = show_options ?? false;
  const allOptions = useMemo(() => options ?? [], [options]);
  const suggestionsList = useMemo(
    () => option_suggestions ?? [],
    [option_suggestions]
  );

  // AI suggestion state
  const showDiff = !!aiOptionResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiOptionResources
          ?.map((o) => o.option_id)
          .filter(Boolean) as string[]
      ),
    [aiOptionResources]
  );

  // Convert to items format for SelectableGrid
  const optionItems = useMemo(() => {
    return allOptions
      .filter((o) => o.option_id)
      .map((o) => ({
        id: o.option_id!,
        option_text: o.option_text ?? "",
        is_correct: o.is_correct ?? false,
      }));
  }, [allOptions]);

  const isSuggested = useCallback(
    (optionId: string) => suggestionsList.includes(optionId),
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
    if (!aiOptionResources?.length) return;
    const newIds = aiOptionResources
      .map((o) => o.option_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiOptionResources, ids, onChange, onAccept]);

  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

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

      <SelectableGrid<OptionItem>
        items={optionItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={(optionId) => {
          const newIds = ids.includes(optionId)
            ? ids.filter((id) => id !== optionId)
            : [...ids, optionId];
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
                isAiSuggested &&
                  !isSelected &&
                  "ring-2 ring-success bg-success/10"
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
                  {item.option_text || "Unnamed"}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    item.is_correct
                      ? "text-success"
                      : "text-muted-foreground"
                  )}
                >
                  {item.is_correct ? "Correct" : "Incorrect"}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No options available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
