/**
 * Thresholds.tsx
 * Resource component for threshold selection
 * Uses SelectableGrid to display thresholds as horizontal scrollable cards
 * Manages threshold_ids array and reports to parent
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
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type ThresholdsGetResponse = OutputOf<"/api/v4/resources/thresholds/get", "post">;
export type ThresholdResourceItem = NonNullable<ThresholdsGetResponse["items"]>[number];

export interface ThresholdItem {
  id: string;
  value: number | null;
}

export interface ThresholdsProps {
  threshold_ids?: string[];
  threshold_resources?: ThresholdResourceItem[];
  show_thresholds?: boolean;
  threshold_suggestions?: string[];
  thresholds?: ThresholdResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  group_id?: string | null;
  // AI diff props (deprecated - now handled by useResourceAi hook)
  aiThresholdResources?: Pick<ThresholdResourceItem, "id" | "value">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Thresholds({
  threshold_ids,
  threshold_resources,
  show_thresholds = false,
  threshold_suggestions,
  thresholds,
  disabled = false,
  onChange,
  label = "Thresholds",
  group_id,
  showAiGenerate = false,
  onGenerate,
}: ThresholdsProps) {
  const ids = useMemo(() => threshold_ids ?? [], [threshold_ids]);
  const show = show_thresholds ?? false;
  const allThresholds = useMemo(() => thresholds ?? [], [thresholds]);
  const suggestionsList = useMemo(
    () => threshold_suggestions ?? [],
    [threshold_suggestions]
  );

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "thresholds",
    groupId: group_id,
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((t) => t.id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Convert to items format for SelectableGrid
  const thresholdItems = useMemo(() => {
    return allThresholds
      .filter((t) => t.id)
      .map((t) => ({
        id: t.id!,
        value: t.value ?? null,
      }));
  }, [allThresholds]);

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

  // Check if any threshold resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return threshold_resources?.some((t) => t.generated) ?? false;
  }, [threshold_resources]);

  // Accept AI suggestion - add AI-suggested thresholds to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((t) => t.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    clearAi();
  }, [aiSuggestions, ids, onChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Don't render if show is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4 min-w-0 w-full">
      {label && (
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-1">{label}</Label>
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
                  {hasGenerated ? "Regenerate" : "Generate"}
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
      )}

      <SelectableGrid<ThresholdItem>
        items={thresholdItems}
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
                <span className="text-sm font-medium">
                  Threshold: {item.value ?? "\u2014"}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No thresholds available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
